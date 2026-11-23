// The running agents section (A3): draws the group, card and tab tree of the agent tabs of the window from core.grid and the
// activity of each tab from core.activity, both watched through the view bridge. A press on a row runs agents.running.select,
// which selects the tab through core.layout.select. The tree rules are those of running.js.
import { createExpose } from "@soksak/plugin-api";
import { createViewBridge } from "@soksak/plugin-api/view";
import { exposurePort } from "./exposure-port.js";
import { runningTree } from "./running.js";
import { showSession } from "./sessions.js";

const SELECT = "agents.running.select";
const SHOW = "agents.session.show";

// Errors that occur before the bridge exists wait in losses and are written to the application log once it does.
const losses = [];
let reportError = (where, text) => losses.push([where, text]);
const bridge = createViewBridge({
  handler: window.webkit.messageHandlers["sok-view"],
  report: (event) => { if (event.kind !== "open-calls") reportError("view calls", JSON.stringify(event)); },
});
reportError = (where, text) => bridge.runtime.error(where, text);
for (const [where, text] of losses.splice(0)) reportError(where, text);

const start = window.sokSurface;
if (start === null || typeof start !== "object") throw new Error("the running agents section has no start values: window.sokSurface is missing");

const list = document.getElementById("tree");
const empty = document.getElementById("empty");

const exposure = createExpose(exposurePort(bridge, "agents.running", reportError), () => start.declarations);

// The values of the two statuses, each replaced when its watch delivers a new one.
let grid = null;
let activity = {};

// The program detail of a row: its state, and its process id when the tab runs a program (core docs/spec/program-state.md).
function programDetail(program) {
  if (program === null) return "-";
  return program.pid === null ? program.state : `${program.state} (pid ${program.pid})`;
}

// Draws the tree: a list item per group and card, and a button per agent tab that selects it.
async function render() {
  if (grid === null || sessions === null) return;
  let tree;
  try {
    tree = runningTree(grid, activity, sessions);
  } catch (error) {
    reportError("agents.running", `the tree could not be drawn: ${error?.message ?? error}`);
    return;
  }
  const items = [];
  const draw = (nodes, depth) => {
    for (const node of nodes) {
      if (node.kind === "tab" || node.kind === "session") {
        const row = document.createElement("button");
        row.type = "button";
        row.style.paddingLeft = `${depth * 12}px`;
        row.textContent = `${node.name} · ${node.activity ?? "-"} · ${programDetail(node.program)}`;
        items.push(row);
        // The row runs the command with its tab; the binder connects the element to the declared command.
        const [command, params] = node.kind === "tab" ? [SELECT, { tab: node.id }] : [SHOW, { session: node.id }];
        exposure.bind(row, command, params).catch((error) => reportError("agents.running", `bind ${node.id}: ${error?.message ?? error}`));
      } else {
        const head = document.createElement("p");
        head.style.paddingLeft = `${depth * 12}px`;
        head.textContent = node.kind === "group" ? node.name : node.id;
        items.push(head);
        draw(node.children, depth + 1);
      }
    }
  };
  draw(tree, 0);
  list.replaceChildren(...items);
  empty.hidden = tree.length > 0;
}

// The command agents.running.select {tab}: selects the tab of the row in the window.
async function select({ tab }) {
  await bridge.calls.request("core.layout.select", { tab });
  return null;
}

// The open sessions of core.sessions, replaced when its watch delivers a new value (A6).
let sessions = null;

// The core command call of this view: the view may call the core commands (core docs/spec/native-surfaces.md#view-surfaces).
const callCore = (name, params) => bridge.calls.request(name, params);

// The command agents.session.show {session}: shows the open session in the current card.
async function showAgentSession({ session }) {
  await showSession(callCore, { session }, sessions);
  return null;
}

await Promise.all([
  exposure.command(SELECT, select), bridge.commands.register(SELECT, select),
  exposure.command(SHOW, showAgentSession), bridge.commands.register(SHOW, showAgentSession),
]);
bridge.runtime.status.watch("core.grid", (value) => { grid = value; render(); });
bridge.runtime.status.watch("core.activity", (value) => { activity = value?.tabs ?? {}; render(); });
bridge.runtime.status.watch("core.sessions", (value) => { sessions = value; render(); });
