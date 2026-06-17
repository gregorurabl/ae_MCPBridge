// server.js
// MCP-Server: Bruecke zwischen Claude Desktop und After Effects via File-IPC
// Liest Pfade aus ae-bridge-config.json (wird von ae-bridge.jsx angelegt)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

// Pfad zu diesem Script - Basis fuer relative Config-Referenz
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Config liegt neben server.js im ae-mcp/-Ordner
// Wird von ae-bridge.jsx beim ersten Start angelegt
const CONFIG_PATH = path.join(__dirname, "ae-bridge-config.json");

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error(
            "ae-bridge-config.json nicht gefunden unter: " + CONFIG_PATH +
            "\nBitte zuerst ae-bridge.jsx in After Effects starten und Ordner waehlen."
        );
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

const config = loadConfig();
const COMMANDS_DIR = config.commands;
const RESPONSES_DIR = config.responses;
const TIMEOUT_MS = 10000;

fs.mkdirSync(COMMANDS_DIR, { recursive: true });
fs.mkdirSync(RESPONSES_DIR, { recursive: true });

async function runInAE(jsxCode) {
    const id = randomUUID();
    const cmdPath = path.join(COMMANDS_DIR, `${id}.jsx`);
    const resPath = path.join(RESPONSES_DIR, `${id}.json`);

    fs.writeFileSync(cmdPath, jsxCode, "utf8");

    const start = Date.now();
    while (Date.now() - start < TIMEOUT_MS) {
        await new Promise(r => setTimeout(r, 200));
        if (fs.existsSync(resPath)) {
            const raw = fs.readFileSync(resPath, "utf8");
            fs.unlinkSync(resPath);
            const result = JSON.parse(raw);
            if (!result.success) throw new Error(result.error);
            return result.data;
        }
    }
    if (fs.existsSync(cmdPath)) fs.unlinkSync(cmdPath);
    throw new Error("AE response timeout - ist ae-bridge.jsx aktiv und gestartet?");
}

const server = new McpServer({
    name: "ae-mcp",
    version: "1.0.0"
});

// Beliebiges JSX in AE ausfuehren
server.tool(
    "run_jsx",
    { code: z.string().describe("JSX/ExtendScript code to execute in After Effects") },
    async ({ code }) => {
        const data = await runInAE(code);
        return { content: [{ type: "text", text: data }] };
    }
);

// Alle Compositions mit Dauer und Auflosung auflisten
server.tool(
    "get_compositions",
    {},
    async () => {
        const jsx = `
            var comps = [];
            for (var i = 1; i <= app.project.numItems; i++) {
                var item = app.project.item(i);
                if (item instanceof CompItem) {
                    comps.push(item.name + " (" + item.duration.toFixed(2) + "s, " + item.width + "x" + item.height + ")");
                }
            }
            comps.join("\\n");
        `;
        const data = await runInAE(jsx);
        return { content: [{ type: "text", text: data }] };
    }
);

// Expression auf eine Layer-Property setzen
server.tool(
    "set_expression",
    {
        comp_name: z.string(),
        layer_name: z.string(),
        property: z.string().describe("z.B. 'position', 'opacity', 'rotation'"),
        expression: z.string()
    },
    async ({ comp_name, layer_name, property, expression }) => {
        const safeExpr = expression.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        const jsx = `
            var comp = null;
            for (var i = 1; i <= app.project.numItems; i++) {
                if (app.project.item(i).name === "${comp_name}") { comp = app.project.item(i); break; }
            }
            if (!comp) throw new Error("Comp not found: ${comp_name}");
            var layer = comp.layer("${layer_name}");
            if (!layer) throw new Error("Layer not found: ${layer_name}");
            var prop = layer.property("${property}") || layer.transform["${property}"];
            if (!prop) throw new Error("Property not found: ${property}");
            prop.expression = "${safeExpr}";
            "Expression set on ${layer_name}.${property}";
        `;
        const data = await runInAE(jsx);
        return { content: [{ type: "text", text: data }] };
    }
);

// Comp zur Render Queue hinzufuegen und rendern
server.tool(
    "render_queue",
    { comp_name: z.string().optional().describe("Wenn leer: gesamte bestehende Queue rendern") },
    async ({ comp_name }) => {
        const jsx = comp_name ? `
            var comp = null;
            for (var i = 1; i <= app.project.numItems; i++) {
                if (app.project.item(i).name === "${comp_name}") { comp = app.project.item(i); break; }
            }
            if (!comp) throw new Error("Comp not found: ${comp_name}");
            app.project.renderQueue.items.add(comp);
            app.project.renderQueue.render();
            "Render gestartet: ${comp_name}";
        ` : `
            app.project.renderQueue.render();
            "Render Queue gestartet";
        `;
        const data = await runInAE(jsx);
        return { content: [{ type: "text", text: data }] };
    }
);

const transport = new StdioServerTransport();
await server.connect(transport);
