# AE MCP Bridge

The AE MCP Bridge connects Claude Desktop to Adobe After Effects, allowing Claude to execute JSX commands directly inside an open AE project (list compositions, create shapes, set expressions, trigger the render queue).

**Prerequisite:** After Effects and Claude Desktop are already installed. No other tools are required beforehand.

---

## 1. Install Node.js

The bridge requires Node.js (includes `npm`).

**Windows:**
1. Open https://nodejs.org
2. Download and install the **LTS version**
3. Verify the installation – open PowerShell and run:
   ```
   node --version
   npm --version
   ```
   Both commands must print a version number.

**macOS (Apple Silicon):**
1. Open https://nodejs.org
2. Download the **LTS version** (the installer detects Apple Silicon automatically, no Rosetta needed) and install it

   Alternatively via Homebrew, if already installed:
   ```
   brew install node
   ```
3. Verify the installation – open Terminal and run:
   ```
   node --version
   npm --version
   ```
   Both commands must print a version number.

---

## 2. Set Up the Project Folder

1. Save the provided `ae-mcp` folder anywhere on disk, e.g.:
   ```
   C:\Tools\ae-mcp
   ```
   The folder contains: `server.js`, `package.json`, `ae-bridge.jsx`, `claude_desktop_config.json`

2. Open a Terminal (macOS) or PowerShell (Windows) inside the `ae-mcp` folder and run:
   ```
   npm install
   ```
   This downloads the required dependencies (creates a `node_modules` folder).

---

## 3. Install the AE Bridge Script

1. Copy `ae-bridge.jsx` into the AE Scripts folder:

   **Windows:**
   ```
   C:\Program Files\Adobe\Adobe After Effects [Version]\Support Files\Scripts\ScriptUI Panels\
   ```

   **macOS:**
   ```
   /Applications/Adobe After Effects [Version]/Scripts/ScriptUI Panels/
   ```

2. **Important:** Edit the path inside `ae-bridge.jsx` before copying it. Open the file in a text editor and find this line:
   ```javascript
   var SCRIPT_DIR = "C:/Active_EDIT/GITHUB/ae_MCPBridge/ae-mcp";
   ```
   Replace the path with the actual location of your `ae-mcp` folder from step 2.

   **Windows** (use forward slashes, not backslashes):
   ```javascript
   var SCRIPT_DIR = "C:/Tools/ae-mcp";
   ```

   **macOS** (path starts with `/`):
   ```javascript
   var SCRIPT_DIR = "/Users/YOURNAME/Tools/ae-mcp";
   ```

3. **macOS – Gatekeeper note:** If AE shows a security warning when loading the script, or silently ignores it, the quarantine attribute can be removed. Open Terminal:
   ```
   xattr -d com.apple.quarantine "/Applications/Adobe After Effects [Version]/Scripts/ScriptUI Panels/ae-bridge.jsx"
   ```

4. **Enable scripting permissions in AE** (if not already enabled):
   *Edit > Preferences > Scripting & Expressions* → enable *"Allow Scripts to Write Files and Access Network"*.

---

## 4. Configure Claude Desktop

1. Open `claude_desktop_config.json` (included in the `ae-mcp` folder)
2. Enter the path to `server.js` – replace the placeholder:

   **Windows:**
   ```json
   {
     "mcpServers": {
       "after-effects": {
         "command": "node",
         "args": ["C:/Tools/ae-mcp/server.js"]
       }
     }
   }
   ```

   **macOS:**
   ```json
   {
     "mcpServers": {
       "after-effects": {
         "command": "node",
         "args": ["/Users/YOURNAME/Tools/ae-mcp/server.js"]
       }
     }
   }
   ```

   Adjust the path in the `args` field to match your own installation location.

3. Paste the content into the actual Claude Desktop configuration file:

   **Windows:**
   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```

   **macOS:**
   ```
   ~/Library/Application Support/Claude/claude_desktop_config.json
   ```

   If the file already exists and contains other MCP servers: add the `after-effects` block inside `mcpServers`, do not overwrite the whole file.

4. **Fully quit** Claude Desktop (including from the system tray/menu bar) and restart it.

---

## 5. First Launch

1. Open After Effects
2. Open the **"ae-bridge"** panel from the *Window* menu (appears at the bottom of the list)
3. The panel shows directly: **"Active - Polling every 500ms"**

On the very first launch, `ae-bridge-config.json` is created automatically inside the `ae-mcp` folder (paths derived from `SCRIPT_DIR` in step 3.2). On every subsequent AE launch, the bridge starts automatically without any interaction.

**Pause polling:** click the "Pause Polling" button in the panel. Click again to resume.

---

## 6. Test the Connection

1. In Claude Desktop: open the plug/tools icon in the input field → under *Connectors*, verify "after-effects" is enabled and shows as **running** (under *Settings > Developer*)
2. Open an AE project containing at least one composition
3. In Claude Desktop, ask:
   ```
   List all compositions in the currently open After Effects project.
   ```

**Expected result:** A list of compositions with duration and resolution.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `npm` is not recognized | Node.js is not installed, or the terminal wasn't restarted after install – see step 1 |
| Claude Desktop shows "Server disconnected" | Check the path in `claude_desktop_config.json` – it must point exactly to `server.js` |
| `ae-bridge-config.json nicht gefunden` (shown in terminal) | The AE panel hasn't been opened yet – complete step 5, the config is created automatically on first open |
| Panel shows no status / stays empty | The path in `SCRIPT_DIR` (step 3.2) doesn't match the actual folder location |
| macOS: script is ignored on load or a security warning appears | Remove the quarantine attribute, see step 3.3 (`xattr -d com.apple.quarantine ...`) |
| Claude request times out | Check the AE panel status – must show "Aktiv"; AE must not be blocked by an active render |
| "after-effects" tool doesn't appear in Claude | Check under *Connectors > Tool Access* whether "Load tools as needed" is enabled – Claude will then load the tools automatically on demand |

---

## Available Features

Currently available tools:

- **get_compositions** – lists all compositions in the project
- **run_jsx** – executes arbitrary JSX code in AE
- **set_expression** – sets an expression on a layer property
- **render_queue** – starts the render queue

The AE panel shows the bridge status and allows pausing the polling via the "Pause Polling" button, without having to close AE.

---
 
## Example Prompts
 
**get_compositions:**
```
List all compositions in the current project.
```
 
**run_jsx:**
```
Create a new text layer with the content "Hello World" in the active composition.
```
 
**set_expression:**
```
On the layer "Logo" in the composition "Intro", set a wiggle expression
on position with frequency 2 and amplitude 30.
```
 
**render_queue:**
```
Start rendering the composition "Final Cut".
```
 