# AE MCP Bridge

Die AE MCP Bridge verbindet Claude Desktop mit Adobe After Effects, sodass Claude direkt JSX-Befehle in einem offenen AE-Projekt ausführen kann (Compositions auflisten, Shapes erstellen, Expressions setzen, Render Queue starten).

**Voraussetzung:** After Effects und Claude Desktop sind bereits installiert. Keine weiteren Tools sind vorausgesetzt.

---

## 1. Node.js installieren

Die Bridge benötigt Node.js (enthält `npm`).

**Windows:**
1. https://nodejs.org öffnen
2. **LTS-Version** herunterladen und installieren
3. Installation prüfen – PowerShell öffnen und ausführen:
   ```
   node --version
   npm --version
   ```
   Beide Befehle müssen eine Versionsnummer ausgeben.

**macOS (Apple Silicon):**
1. https://nodejs.org öffnen
2. **LTS-Version** herunterladen (der Installer erkennt Apple Silicon automatisch, kein Rosetta nötig) und installieren

   Alternativ über Homebrew, falls bereits installiert:
   ```
   brew install node
   ```
3. Installation prüfen – Terminal öffnen und ausführen:
   ```
   node --version
   npm --version
   ```
   Beide Befehle müssen eine Versionsnummer ausgeben.

---

## 2. Projektordner einrichten

1. Den erhaltenen `ae-mcp`-Ordner an einem beliebigen Ort speichern, z. B.:
   ```
   C:\Tools\ae-mcp
   ```
   Der Ordner enthält: `server.js`, `package.json`, `ae-bridge.jsx`, `claude_desktop_config.json`

2. Terminal (macOS) bzw. PowerShell (Windows) im `ae-mcp`-Ordner öffnen und ausführen:
   ```
   npm install
   ```
   Lädt die benötigten Abhängigkeiten herunter (Ordner `node_modules` wird angelegt).

---

## 3. AE-Bridge-Script installieren

1. `ae-bridge.jsx` in den AE-Scripts-Ordner kopieren:

   **Windows:**
   ```
   C:\Program Files\Adobe\Adobe After Effects [Version]\Support Files\Scripts\ScriptUI Panels\
   ```

   **macOS:**
   ```
   /Applications/Adobe After Effects [Version]/Scripts/ScriptUI Panels/
   ```

2. **Wichtig:** Im Script `ae-bridge.jsx` den Pfad anpassen, bevor es kopiert wird. Datei mit einem Texteditor öffnen und diese Zeile suchen:
   ```javascript
   var SCRIPT_DIR = "C:/Active_EDIT/GITHUB/ae_MCPBridge/ae-mcp";
   ```
   Den Pfad durch den tatsächlichen Speicherort des `ae-mcp`-Ordners aus Schritt 2 ersetzen.

   **Windows** (Forward-Slashes verwenden, keine Backslashes):
   ```javascript
   var SCRIPT_DIR = "C:/Tools/ae-mcp";
   ```

   **macOS** (Pfad beginnt mit `/`):
   ```javascript
   var SCRIPT_DIR = "/Users/DEINNAME/Tools/ae-mcp";
   ```

3. **macOS – Gatekeeper-Hinweis:** Falls AE beim Laden des Scripts eine Sicherheitswarnung anzeigt oder das Script kommentarlos ignoriert wird, kann das Quarantäne-Attribut der Datei entfernt werden. Terminal öffnen:
   ```
   xattr -d com.apple.quarantine "/Applications/Adobe After Effects [Version]/Scripts/ScriptUI Panels/ae-bridge.jsx"
   ```

4. **Scripting-Berechtigung in AE aktivieren** (falls noch nicht geschehen):
   *Edit > Preferences > Scripting & Expressions* → *„Allow Scripts to Write Files and Access Network"* aktivieren.

---

## 4. Claude Desktop konfigurieren

1. Datei `claude_desktop_config.json` öffnen (im `ae-mcp`-Ordner enthalten)
2. Pfad zu `server.js` eintragen – den Platzhalter ersetzen:

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
         "args": ["/Users/DEINNAME/Tools/ae-mcp/server.js"]
       }
     }
   }
   ```

   Den Pfad im `args`-Feld an den eigenen Speicherort anpassen.

3. Inhalt in die echte Claude-Desktop-Konfigurationsdatei einfügen:

   **Windows:**
   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```

   **macOS:**
   ```
   ~/Library/Application Support/Claude/claude_desktop_config.json
   ```

   Falls die Datei bereits existiert und andere MCP-Server enthält: den `after-effects`-Block innerhalb von `mcpServers` ergänzen, nicht die ganze Datei überschreiben.

4. Claude Desktop **vollständig beenden** (auch aus dem System-Tray/Menüleiste) und neu starten.

---

## 5. Erststart

1. After Effects öffnen
2. Im Menü *Window* das Panel **„ae-bridge"** öffnen (taucht ganz unten in der Liste auf)
3. Panel zeigt direkt: **„Active - Polling every 500ms"**

Beim allerersten Start wird `ae-bridge-config.json` automatisch im `ae-mcp`-Ordner angelegt (Pfade basieren auf `SCRIPT_DIR` aus Schritt 3.2). Bei jedem weiteren AE-Start läuft die Bridge automatisch ohne Interaktion.

**Polling pausieren:** Button „Pause Polling" im Panel. Erneutes Klicken setzt das Polling fort.

---

## 6. Verbindung testen

1. In Claude Desktop: Stecker-/Werkzeug-Icon im Eingabefeld öffnen → unter *Konnektoren* prüfen, ob „after-effects" aktiv ist und als **running** angezeigt wird (in *Einstellungen > Entwickler*)
2. Ein AE-Projekt mit mindestens einer Composition öffnen
3. In Claude Desktop fragen:
   ```
   Liste alle Compositions im aktuellen After Effects Projekt auf.
   ```

**Erwartetes Ergebnis:** Liste der Compositions mit Dauer und Auflösung.

---

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| `npm` wird nicht erkannt | Node.js ist nicht installiert oder Terminal wurde nicht neu gestartet – siehe Schritt 1 |
| Claude Desktop zeigt „Server disconnected" | Pfad in `claude_desktop_config.json` prüfen – muss exakt auf `server.js` zeigen |
| `ae-bridge-config.json nicht gefunden` (im Terminal sichtbar) | AE-Panel wurde noch nicht geöffnet – Schritt 5 ausführen, Config wird beim ersten Öffnen automatisch angelegt |
| Panel zeigt keinen Status / bleibt leer | Pfad in `SCRIPT_DIR` (Schritt 3.2) stimmt nicht mit dem tatsächlichen Speicherort überein |
| macOS: Script wird beim Laden ignoriert oder Sicherheitswarnung erscheint | Quarantäne-Attribut entfernen, siehe Schritt 3.3 (`xattr -d com.apple.quarantine ...`) |
| Claude-Anfrage läuft in Timeout | AE-Panel-Status prüfen – muss „Aktiv" zeigen; AE darf nicht durch einen Render-Vorgang blockiert sein |
| Tool „after-effects" taucht in Claude nicht auf | Unter *Konnektoren > Tool-Zugriff* prüfen, ob „Tools bei Bedarf laden" aktiv ist – Claude lädt die Tools dann erst bei Bedarf automatisch nach |

---

## Funktionsumfang

Aktuell verfügbare Tools:

- **get_compositions** – listet alle Compositions im Projekt
- **run_jsx** – führt beliebigen JSX-Code in AE aus
- **set_expression** – setzt eine Expression auf eine Layer-Property
- **render_queue** – startet die Render Queue

Das AE-Panel zeigt den Status der Bridge an und erlaubt das Pausieren des Pollings über den Button „Pause Polling", ohne AE schließen zu müssen.

---
 
## Beispiel-Prompts
 
**get_compositions:**
```
Liste alle Compositions im aktuellen Projekt auf.
```
 
**run_jsx:**
```
Erstelle eine neue Textebene mit dem Inhalt "Hello World" in der aktiven Composition.
```
 
**set_expression:**
```
Setze auf der Ebene "Logo" in der Composition "Intro" eine Wiggle-Expression
auf die Position mit Frequenz 2 und Amplitude 30.
```
 
**render_queue:**
```
Starte das Rendern der Composition "Final Cut".
```
 