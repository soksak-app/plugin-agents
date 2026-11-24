// The definition dialog of the definitions section (A28, A31): a dialog of the window with the fields of a definition in a group. Its start
// values name the group and an identifier. Without an identifier the save defines a new definition (agents.definition.define); with one,
// the dialog shows the stored definition and its role from core.roles, and the save changes it (agents.definition.change). A success closes
// the dialog. A refusal shows its text in the dialog and is written to the application log. The account select shows the login of each
// account, the login button opens the login of the selected account, and the new account row adds an account (A36,
// docs/spec/definitions.md#controls-and-dialogs).
import { createExpose } from "@soksak/plugin-api";
import { createViewBridge } from "@soksak/plugin-api/view";
import { exposurePort } from "./exposure-port.js";
import { parseAccounts } from "./accounts.js";
import { parseDefinitions } from "./definition-records.js";
import { definitionFormValues, definitionParams } from "./dialog-rules.js";
import { accountLogins, changeDefinitionRecord, defineAccountRecord, defineDefinitionRecord, loginAccount, newDefinitionId, removeAccountRecord } from "./definition-commands.js";

const DEFINE = "agents.definition.define";
const CHANGE = "agents.definition.change";
const CANCEL = "agents.dialog.cancel";
const ACCOUNT_DEFINE = "agents.account.define";
const ACCOUNT_REMOVE = "agents.account.remove";
const ACCOUNT_LOGIN = "agents.account.login";
const LOGINS = "agents.definition-dialog.accounts";
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

const api = { data: bridge.runtime.data, calls: bridge.calls, settings: bridge.runtime.settings, program: bridge.runtime.program, dataFolder: start.dataFolder };
const exposure = createExpose(exposurePort(bridge, WHERE, reportError), () => start.declarations);
const nameField = document.getElementById("name");
const accountField = document.getElementById("account");
const cwdField = document.getElementById("cwd");
const textField = document.getElementById("text");
const koField = document.getElementById("ko");
const filesField = document.getElementById("files");
const loginButton = document.getElementById("login");
const accountIdField = document.getElementById("account-id");
const accountCliField = document.getElementById("account-cli");
const accountAddButton = document.getElementById("account-add");
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

// The login of each account, {id, cli, login}, as the select shows it and the status agents.definition-dialog.accounts publishes it.
let logins = [];
const loginWatchers = new Set();

// Reads the accounts and their logins, fills the account select and publishes the status. selected names the account to select.
async function showAccounts(selected) {
  const accounts = parseAccounts((await bridge.runtime.data.get(ACCOUNTS)) ?? []);
  logins = await accountLogins(api, accounts);
  accountField.replaceChildren(...logins.map((row) => new Option(row.login === false ? `${row.id} (로그인 필요)` : row.id, row.id)));
  if (selected !== undefined) accountField.value = selected;
  showLogin();
  for (const watcher of loginWatchers) watcher({ accounts: logins });
}

// The login button is enabled while the selected account has no login in its home.
function showLogin() {
  loginButton.disabled = logins.find((row) => row.id === accountField.value)?.login !== false;
}

// The command agents.account.define {id, cli, args, env}: adds the account and selects it.
async function addAccount(values) {
  const result = await defineAccountRecord(api, values);
  await showAccounts(result.id);
  accountIdField.value = "";
  accountCliField.value = "";
  return result;
}

// The command agents.account.remove {id}: removes the account from the project.
async function removeAccount(values) {
  const result = await removeAccountRecord(api, values);
  await showAccounts();
  return result;
}

// The command agents.account.login {id}: opens the login tab of the account and closes the dialog, which covers that tab.
async function login(values) {
  const result = await loginAccount(api, values);
  await bridge.runtime.dialog.close(null);
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
  exposure.status(LOGINS, () => ({ accounts: logins }), (watcher) => { loginWatchers.add(watcher); return () => loginWatchers.delete(watcher); }),
  exposure.command(ACCOUNT_DEFINE, addAccount), bridge.commands.register(ACCOUNT_DEFINE, addAccount),
  exposure.command(ACCOUNT_REMOVE, removeAccount), bridge.commands.register(ACCOUNT_REMOVE, removeAccount),
  exposure.command(ACCOUNT_LOGIN, login), bridge.commands.register(ACCOUNT_LOGIN, login),
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
  exposure.element("agents.definition-dialog.login", loginButton),
  exposure.element("agents.definition-dialog.account-id", accountIdField),
  exposure.element("agents.definition-dialog.account-cli", accountCliField),
  exposure.element("agents.definition-dialog.account-add", accountAddButton),
  exposure.bind(loginButton, ACCOUNT_LOGIN, () => ({ id: accountField.value }), { failed: refused }),
  exposure.mark(accountIdField, ACCOUNT_DEFINE, null, "id"),
  exposure.mark(accountCliField, ACCOUNT_DEFINE, null, "cli"),
  exposure.bind(accountAddButton, ACCOUNT_DEFINE, () => ({ id: accountIdField.value.trim(), cli: accountCliField.value.trim(), args: [], env: [] }), { failed: refused }),
]);
accountField.addEventListener("change", showLogin);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") exposure.run(CANCEL, {}).catch(refused);
});

// The accounts fill the account field. A stored definition fills every field from its record and its role in core.roles.
try {
  await showAccounts();
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
    showLogin();
    cwdField.value = values.cwd;
    textField.value = values.text;
    koField.value = values.ko;
    filesField.value = values.files;
  }
} catch (error) {
  refused(error);
}
nameField.focus();
