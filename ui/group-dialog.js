// The group dialog of the definitions section (A28): a dialog of the window with the group name field and the add button. The field holds
// default while no stored group is named default, and empty otherwise. Enter or the add button runs agents.group.create, and a success
// closes the dialog with the identifier of the group. A refusal shows its text in the dialog and is written to the application log.
import { createExpose } from "@soksak/plugin-api";
import { createViewBridge } from "@soksak/plugin-api/view";
import { exposurePort } from "./exposure-port.js";
import { parseGroups } from "./groups.js";
import { defaultGroupName } from "./dialog-rules.js";
import { createGroupRecord } from "./definition-commands.js";

const CREATE = "agents.group.create";
const CANCEL = "agents.dialog.cancel";
const KEY = "groups";
const WHERE = "agents.group-dialog";

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
if (start === null || typeof start !== "object") throw new Error("the group dialog has no start values: window.sokSurface is missing");

const api = { data: bridge.runtime.data, calls: bridge.calls, settings: bridge.runtime.settings };
const exposure = createExpose(exposurePort(bridge, WHERE, reportError), () => start.declarations);
const nameField = document.getElementById("name");
const addButton = document.getElementById("add");
const cancelButton = document.getElementById("cancel");
const message = document.getElementById("error");

// Shows the text of a refusal on the dialog page, its error display, and records it at that moment through runtime.error.
function refused(error) {
  const text = error?.message ?? String(error);
  message.textContent = text;
  reportError(WHERE, text);
}

// The command agents.group.create {name} of this dialog: stores the group, then closes the dialog with the identifier of the group.
async function create(params) {
  const result = await createGroupRecord(api, params);
  await bridge.runtime.dialog.close(result);
  return result;
}

// The command agents.dialog.cancel: closes the dialog without a change.
async function cancel() {
  await bridge.runtime.dialog.close(null);
  return null;
}

await Promise.all([
  exposure.command(CREATE, create), bridge.commands.register(CREATE, create),
  exposure.command(CANCEL, cancel), bridge.commands.register(CANCEL, cancel),
]);
await Promise.all([
  exposure.element("agents.group-dialog.name", nameField),
  exposure.element("agents.group-dialog.add", addButton),
  exposure.element("agents.group-dialog.cancel", cancelButton),
  exposure.bind(nameField, CREATE, () => ({ name: nameField.value }), { event: "keydown", when: (event) => event.key === "Enter", failed: refused }),
  exposure.bind(addButton, CREATE, () => ({ name: nameField.value }), { failed: refused }),
  exposure.bind(cancelButton, CANCEL, {}, { failed: refused }),
]);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") exposure.run(CANCEL, {}).catch(refused);
});

try {
  const groups = parseGroups((await bridge.runtime.data.get(KEY)) ?? {});
  nameField.value = defaultGroupName(groups);
} catch (error) {
  refused(error);
}
nameField.focus();
