// The agent definitions section (A4): lists the groups of the project and creates an empty group. The groups are project data
// under the key groups (plugin.json data), read and changed through the view bridge; the rules are those of groups.js.
import { createExpose } from "@soksak/plugin-api";
import { createViewBridge } from "@soksak/plugin-api/view";
import { createGroup, groupRows, parseGroups } from "./groups.js";

const COMMAND = "agents.group.create";
const KEY = "groups";

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
if (start === null || typeof start !== "object") throw new Error("the definitions section has no start values: window.sokSurface is missing");

const list = document.getElementById("groups");
const empty = document.getElementById("empty");
const form = document.getElementById("create");
const input = document.getElementById("name");

// Draws the rows of the groups that the project stores, or the empty state.
function render(groups) {
  const rows = groupRows(groups);
  list.replaceChildren(...rows.map((row) => {
    const item = document.createElement("li");
    item.textContent = `${row.name} (${row.count})`;
    return item;
  }));
  empty.hidden = rows.length > 0;
}

// Reads the groups of the project and draws them; a stored value that does not match the rule is written to the log.
async function reload() {
  try {
    render(parseGroups((await bridge.runtime.data.get(KEY)) ?? {}));
  } catch (error) {
    reportError("agents.definitions", `groups could not be read: ${error?.message ?? error}`);
  }
}

// A new group identifier: a letter first, then the time and a random part, so two groups created at once differ.
const newId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// The command agents.group.create {name}: adds an empty group to the stored groups and returns its identifier.
async function create({ name }) {
  const id = newId();
  await bridge.runtime.data.change(KEY, (current) => createGroup(current, { id, name }));
  return { id };
}

const exposure = createExpose({
  register: (kind, name) => kind === "command"
    ? Promise.resolve()
    : bridge.calls.request("runtime.native.call", { name: "registered", payload: { kind, name } }).then(() => undefined),
  onRequest: (answer) => bridge.runtime.native.on("exposure-request", answer),
  reply: (id, payload) => bridge.calls.request("runtime.native.call", { name: "exposureReply", payload: { id, ...payload } }),
  report: (text) => reportError("agents.definitions", String(text)),
}, () => start.declarations);

// The form enters the name through the input; Enter runs the command instead of submitting the page.
form.addEventListener("submit", (event) => event.preventDefault());
await Promise.all([exposure.command(COMMAND, create), bridge.commands.register(COMMAND, create)]);
await exposure.mark(input, COMMAND, {}, "name");
await exposure.delegate(form);
bridge.runtime.data.on(() => { reload(); });
await reload();
