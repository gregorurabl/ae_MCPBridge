// ae-bridge.jsx
// Dockable ScriptUI panel - place in ScriptUI Panels/
// Polls a commands/ directory and writes responses into responses/

// Panel initialization: works as dockable panel and as standalone dialog
var panel = (this instanceof Panel) ? this : new Window("palette", "AE Bridge", undefined, { resizeable: true });

// Path to the config file next to this script.
// $.fileName is not reliably available in dockable panels at AE startup,
// so a fixed path to the install location of this script is used instead.
// ADJUST: must exactly match the ae-mcp project folder (not the ScriptUI Panels/ folder)
var SCRIPT_DIR = "C:/Active_EDIT/GITHUB/ae_MCPBridge/ae-mcp";
var CONFIG_PATH = SCRIPT_DIR + "/ae-bridge-config.json";

var config = {
    commands: SCRIPT_DIR + "/bridge/commands",
    responses: SCRIPT_DIR + "/bridge/responses"
};

var isPaused = false;

// Minimal JSON parser for ExtendScript (no native JSON object available)
// Supports flat objects with string values only - sufficient for the config
function parseJSON(str) {
    var obj = {};
    str = str.replace(/^\s*\{/, "").replace(/\}\s*$/, "");
    var re = /"([^"]+)"\s*:\s*"([^"]*)"/g;
    var m;
    while ((m = re.exec(str)) !== null) {
        obj[m[1]] = m[2];
    }
    return obj;
}

// Serializes a flat object with string values only into JSON
function serializeJSON(obj) {
    var parts = [];
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            parts.push('"' + key + '": "' + obj[key].replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"');
        }
    }
    return "{\n  " + parts.join(",\n  ") + "\n}";
}

// Serializes the result object from pollCommands { success, data, error }
function serializeResult(result) {
    var successStr = result.success ? "true" : "false";
    var dataStr = result.data !== null ? '"' + String(result.data).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"' : "null";
    var errorStr = result.error !== null ? '"' + String(result.error).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"' : "null";
    return '{"success":' + successStr + ',"data":' + dataStr + ',"error":' + errorStr + '}';
}

// Read config from disk; creates it with defaults on first run
function loadConfig() {
    var f = new File(CONFIG_PATH);
    if (!f.exists) {
        saveConfig();
        return;
    }
    f.open("r");
    var raw = f.read();
    f.close();
    try {
        config = parseJSON(raw);
    } catch (e) {
        // fall back to defaults already set above
    }
}

// Write config to disk
function saveConfig() {
    var f = new File(CONFIG_PATH);
    f.open("w");
    f.write(serializeJSON(config));
    f.close();
}

// Create bridge directories if missing
function ensureDirectories() {
    var dirs = [
        new Folder(config.commands),
        new Folder(config.responses)
    ];
    for (var i = 0; i < dirs.length; i++) {
        if (!dirs[i].exists) dirs[i].create();
    }
}

// Polling function, invoked repeatedly via scheduleTask
function pollCommands() {
    if (isPaused) return;

    var dir = new Folder(config.commands);
    if (!dir.exists) return;

    var files = dir.getFiles("*.jsx");
    if (files.length === 0) return;

    // Oldest file first (getFiles returns alphabetically sorted, UUID-based names)
    var cmdFile = files[0];
    var cmdId = cmdFile.name.replace(".jsx", "");

    cmdFile.open("r");
    var code = cmdFile.read();
    cmdFile.close();
    cmdFile.remove(); // remove before eval to prevent double execution

    var result = { success: false, data: null, error: null };

    try {
        var output = eval(code);
        result.success = true;
        result.data = (output !== undefined) ? String(output) : "ok";
    } catch (e) {
        result.error = e.toString();
    }

    var responseFile = new File(config.responses + "/" + cmdId + ".json");
    responseFile.open("w");
    responseFile.write(serializeResult(result));
    responseFile.close();
}

// Update status label text
function updateStatusLabel() {
    panel.statusLabel.text = isPaused ? "Paused" : "Active - Polling every 500ms";
}

// Toggle pause state
function togglePause() {
    isPaused = !isPaused;
    updateStatusLabel();
    panel.pauseBtn.text = isPaused ? "Resume Polling" : "Pause Polling";
}

// Build panel UI
panel.orientation = "column";
panel.alignChildren = ["fill", "top"];
panel.spacing = 8;
panel.margins = 10;

var titleGroup = panel.add("group");
titleGroup.alignment = ["fill", "top"];
var titleLabel = titleGroup.add("statictext", undefined, "AE MCP Bridge");
titleLabel.graphics.font = ScriptUI.newFont("dialog", "BOLD", 12);

panel.statusLabel = panel.add("statictext", undefined, "", { multiline: false });
panel.statusLabel.alignment = ["fill", "top"];

panel.pauseBtn = panel.add("button", undefined, "Pause Polling");
panel.pauseBtn.alignment = ["fill", "top"];
panel.pauseBtn.onClick = function() { togglePause(); };

// Initialization
loadConfig();
ensureDirectories();
app.scheduleTask("pollCommands()", 500, true);
updateStatusLabel();

// Force layout (required for dockable panels)
if (panel instanceof Window) {
    panel.show();
} else {
    panel.layout.layout(true);
}
