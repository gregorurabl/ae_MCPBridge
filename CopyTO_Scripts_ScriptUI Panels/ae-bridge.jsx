// ae-bridge.jsx
// Dockable ScriptUI panel - place in ScriptUI Panels/
// Polls a commands/ directory and writes responses into responses/

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
var isStarted = false; // guards against double-registering scheduleTask
var lastPollTime = 0; // heartbeat written by pollCommands()
var watchdogStarted = false; // guards against double-registering the watchdog

// Minimal JSON parser for ExtendScript (no native JSON object available)
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

function serializeJSON(obj) {
    var parts = [];
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            parts.push('"' + key + '": "' + obj[key].replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"');
        }
    }
    return "{\n  " + parts.join(",\n  ") + "\n}";
}

function serializeResult(result) {
    var successStr = result.success ? "true" : "false";
    var dataStr = result.data !== null ? '"' + String(result.data).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"' : "null";
    var errorStr = result.error !== null ? '"' + String(result.error).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"' : "null";
    return '{"success":' + successStr + ',"data":' + dataStr + ',"error":' + errorStr + '}';
}

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

function saveConfig() {
    var f = new File(CONFIG_PATH);
    f.open("w");
    f.write(serializeJSON(config));
    f.close();
}

function ensureDirectories() {
    var dirs = [
        new Folder(config.commands),
        new Folder(config.responses)
    ];
    for (var i = 0; i < dirs.length; i++) {
        if (!dirs[i].exists) dirs[i].create();
    }
}

function pollCommands() {
    lastPollTime = new Date().getTime(); // heartbeat - proves the scheduled task actually fired
    if (isPaused) return;

    var dir = new Folder(config.commands);
    if (!dir.exists) return;

    var files = dir.getFiles("*.jsx");
    if (files.length === 0) return;

    var cmdFile = files[0];
    var cmdId = cmdFile.name.replace(".jsx", "");

    cmdFile.open("r");
    var code = cmdFile.read();
    cmdFile.close();
    cmdFile.remove();

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

function updateStatusLabel() {
    if (!isStarted) {
        panel.statusLabel.text = "Initializing...";
        return;
    }
    panel.statusLabel.text = isPaused ? "Paused" : "Active - Polling every 500ms";
}

// Idempotent: safe to call multiple times, only registers scheduleTask once per "session"
function engagePolling() {
    if (isStarted) return;
    try {
        app.scheduleTask("pollCommands()", 500, true);
        isStarted = true;
    } catch (eSchedule) {
        isStarted = false;
    }
    updateStatusLabel();
}

// Checks the heartbeat written by pollCommands() instead of trusting isStarted alone.
// Runs every 3s for the lifetime of the panel.
function verifyAndRecover() {
    var now = new Date().getTime();
    var stale = (lastPollTime === 0) || ((now - lastPollTime) > 2000);
    $.writeln("[ae-bridge] verifyAndRecover: lastPollTime=" + lastPollTime + " stale=" + stale + " isPaused=" + isPaused + " isStarted=" + isStarted);
    if (stale && !isPaused) {
        isStarted = false;
        engagePolling();
    }
}

// Arms the recurring watchdog. Called from multiple independent trigger points
// (top-level load, "show" event, onDraw) so a failed registration attempt at one
// trigger point doesn't permanently block recovery.
function armWatchdog() {
    if (watchdogStarted) return;
    watchdogStarted = true;
    $.writeln("[ae-bridge] armWatchdog: arming at " + new Date().toString());
    try {
        app.scheduleTask("verifyAndRecover()", 3000, true);
    } catch (eWatchdog) {
        watchdogStarted = false;
        $.writeln("[ae-bridge] armWatchdog: scheduleTask threw - " + eWatchdog.toString());
    }
}

// Manual recovery: mirrors what closing and reopening the panel via the Window menu
// currently does, without requiring the user to leave the panel.
// Forces a fresh scheduleTask registration attempt and reloads config/directories.
function reconnect() {
    isPaused = false;
    loadConfig();
    ensureDirectories();
    isStarted = false; // force re-registration even if engagePolling ran before
    engagePolling();
    armWatchdog();
}

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

panel.reconnectBtn = panel.add("button", undefined, "Reconnect");
panel.reconnectBtn.alignment = ["fill", "top"];
panel.reconnectBtn.onClick = function() { reconnect(); };

// Initialization
loadConfig();
ensureDirectories();
updateStatusLabel();

// Primary attempt: register immediately, as before.
engagePolling();
armWatchdog();

// Secondary safety net: also (re-)attempt once the panel actually finishes rendering.
// On a dockable panel restored as part of a saved workspace at AE launch, app.scheduleTask
// calls made during the panel's raw script-load phase can silently fail to register
// before AE's main idle loop is fully active. Binding to "show" defers the call until
// the panel is genuinely rendered, which happens later and more reliably.
// engagePolling() and armWatchdog() are both idempotent, so this is safe even if the
// primary attempt above already succeeded.
try {
    panel.addEventListener("show", function() {
        engagePolling();
        armWatchdog();
    });
} catch (eShow) {
    // some hosts may not support this listener on Panel objects; primary attempt above
    // and the manual Reconnect button remain as fallbacks
}

// Third trigger point: onDraw fires on first paint regardless of how the panel became
// visible, including workspace-restored panels at AE launch where "show" never fires.
// Not independently verified for plain statictext controls in this AE version.
panel.statusLabel.onDraw = function() {
    armWatchdog();
};

// Force layout (required for dockable panels)
if (panel instanceof Window) {
    panel.show();
} else {
    panel.layout.layout(true);
}
