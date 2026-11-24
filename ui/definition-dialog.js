// The definition dialog of the definitions section (A28, A31): a dialog of the window with the fields of a definition in a group. Its start
// values name the group and an identifier. Without an identifier the save defines a new definition (agents.definition.define); with one,
// the dialog shows the stored definition and its role from core.roles, and the save changes it (agents.definition.change). A success closes
// the dialog. A refusal shows its text in the dialog and is written to the application log.
import { createExpose } from "@soksak/plugin-api";
import { createViewBridge } from "@soksak/plugin-api/view";
import { exposurePort } from "./exposure-port.js";
import { parseAccounts } from "./accounts.js";
import { parseDefinitions } from "./definition-records.js";
import { definitionFormValues, definitionParams } from "./dialog-rules.js";
import { changeDefinitionRecord, defineDefinitionRecord, newDefinitionId } from "./definition-commands.js";

const DEFINE = "agents.definition.define";
const CHANGE = "agents.definition.change";
const CANCEL = "agents.dialog.cancel";
const ACCOUNTS = "accounts";
const DEFINITIONS = "definitions";
const WHERE = "agents.definition-dialog";

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
if (start === null || typeof start !== "object") throw new Error("the definition dialog has no start values: window.sokSurface is missing");
const params = start.params;
if (params === null || typeof params !== "object" || typeof params.group !== "string") {
  throw new Error("the definition dialog has no group in its parameters");
}
if (params.id !== null && typeof params.id !== "string") throw new Error("the definition dialog id must be text or null");
const group = params.group;
const editing = params.id !== null;
// The identifier of a new definition is made once, so a refused save that is repeated names the same identifier.
const id = editing ? params.id : newDefinitionId();
const save = editing ? CHANGE : DEFINE;

const api = { data: bridge.runtime.data, calls: bridge.calls, settings: bridge.runtime.settings };
const exposure = createExpose(exposurePort(bridge, WHERE, reportError), () => start.declarations);
const nameField = document.getElementById("name");
const accountField = document.getElementById("account");
const cwdField = document.getElementById("cwd");
const textField = document.getElementById("text");
const koField = document.getElementById("ko");
const filesField = document.getElementById("files");
const saveButton = document.getElementById("save");
const cancelButton = document.getElementById("cancel");
const message = document.getElementById("error");

// Shows the text of a refusal on the dialog page, its error display, and records it at that moment through runtime.error.
function refused(error) {
  const text = error?.message ?? String(error);
  message.textContent = text;
  reportError(WHERE, text);
}

// The command of the save: runs the rules of agents.definition.define or agents.definition.change, then closes the dialog with the
// identifier of the definition.
async function saveDefinition(values) {
  const result = await (editing ? changeDefinitionRecord(api, values) : defineDefinitionRecord(api, values));
  await bridge.runtime.dialog.close(result);
  return result;
}

// The command agents.dialog.cancel: closes the dialog without a change.
async function cancel() {
  await bridge.runtime.dialog.close(null);
  return null;
}

await Promise.all([
  exposure.command(save, saveDefinition), bridge.commands.register(save, saveDefinition),
  exposure.command(CANCEL, cancel), bridge.commands.register(CANCEL, cancel),
]);
await Promise.all([
  exposure.element("agents.definition-dialog.name", nameField),
  exposure.element("agents.definition-dialog.account", accountField),
  exposure.element("agents.definition-dialog.cwd", cwdField),
  exposure.element("agents.definition-dialog.text", textField),
  exposure.element("agents.definition-dialog.ko", koField),
  exposure.element("agents.definition-dialog.files", filesField),
  exposure.element("agents.definition-dialog.save", saveButton),
  exposure.element("agents.definition-dialog.cancel", cancelButton),
  // Each field gives one parameter of the save command, which the save button runs.
  ...[[nameField, "name"], [accountField, "account"], [cwdField, "cwd"], [textField, "text"], [koField, "ko"], [filesField, "files"]]
    .map(([field, parameter]) => exposure.mark(field, save, null, parameter)),
  exposure.bind(saveButton, save, () => definitionParams({
    group, id, name: nameField.value, account: accountField.value, cwd: cwdField.value, text: textField.value, ko: koField.value, files: filesField.value,
  }), { failed: refused }),
  exposure.bind(cancelButton, CANCEL, {}, { failed: refused }),
]);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") exposure.run(CANCEL, {}).catch(refused);
});

// The accounts fill the account field. A stored definition fills every field from its record and its role in core.roles.
try {
  const accounts = parseAccounts((await bridge.runtime.data.get(ACCOUNTS)) ?? []);
  accountField.replaceChildren(...accounts.map((account) => new Option(account.id, account.id)));
  if (editing) {
    const records = parseDefinitions((await bridge.runtime.data.get(DEFINITIONS)) ?? {});
    if (!Object.hasOwn(records, id)) throw new Error(`definition ${id} is not defined`);
    // The first value of core.roles is the value at the time of the dialog, and the watch ends with it.
    let stop;
    const roles = await new Promise((resolve) => { stop = bridge.runtime.status.watch("core.roles", resolve); });
    stop();
    const values = definitionFormValues(records[id], roles);
    nameField.value = values.name;
    accountField.value = values.account;
    cwdField.value = values.cwd;
    textField.value = values.text;
    koField.value = values.ko;
    filesField.value = values.files;
  }
} catch (error) {
  refused(error);
}
nameField.focus();
