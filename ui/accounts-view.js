// The agent accounts section (A2 in docs/features.md): lists the accounts of the project, defines an account and removes one. The
// accounts are project data under the key accounts (plugin.json data), read and changed through the view bridge; the rules are
// those of accounts.js.
import { createExpose } from "@soksak/plugin-api";
import { createViewBridge } from "@soksak/plugin-api/view";
import { accountFromText, accountRows, parseAccounts, removeAccount } from "./accounts.js";
import { definitionsUsingAccount, parseDefinitions } from "./definition-records.js";

const DEFINE = "agents.account.define";
const REMOVE = "agents.account.remove";
const KEY = "accounts";

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
if (start === null || typeof start !== "object") throw new Error("the accounts section has no start values: window.sokSurface is missing");

const list = document.getElementById("accounts");
const empty = document.getElementById("empty");
const form = document.getElementById("define");

// The accounts of the project, replaced when the project data changes.
let accounts = [];

// Draws each account with its program, its arguments, its environment names and a button that removes it.
function render() {
  const rows = accountRows(accounts);
  list.replaceChildren(...rows.map((row) => {
    const item = document.createElement("li");
    const text = document.createElement("span");
    const args = row.args.length > 0 ? ` ${row.args.join(" ")}` : "";
    const env = row.env.length > 0 ? ` (env: ${row.env.join(", ")})` : "";
    text.textContent = `${row.id}: ${row.cli}${args}${env}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "제거";
    item.append(text, remove);
    // The button runs the command with its identifier; the binder connects the element to the declared command.
    exposure.bind(remove, REMOVE, { id: row.id }).catch((error) => reportError("agents.accounts", `bind ${row.id}: ${error?.message ?? error}`));
    return item;
  }));
  empty.hidden = rows.length > 0;
}

// Reads the accounts of the project and draws them; a stored value that does not match the rule is written to the log.
async function reload() {
  try {
    accounts = parseAccounts((await bridge.runtime.data.get(KEY)) ?? []);
    render();
  } catch (error) {
    reportError("agents.accounts", `accounts could not be read: ${error?.message ?? error}`);
  }
}

// The command agents.account.define {id, cli, args, env}: adds the account, or replaces the one with the same identifier.
async function define({ id, cli, args, env }) {
  await bridge.runtime.data.change(KEY, (current) => accountFromText(parseAccounts(current ?? []), { id, cli, args, env }));
  return { id };
}

// The command agents.account.remove {id}: removes the account from the project. An account that a definition names is refused,
// because the definition would have no program to start.
async function remove({ id }) {
  const users = definitionsUsingAccount(parseDefinitions((await bridge.runtime.data.get("definitions")) ?? {}), id);
  if (users.length > 0) throw new Error(`account ${id} is used by definition ${users.join(", ")}`);
  await bridge.runtime.data.change(KEY, (current) => removeAccount(parseAccounts(current ?? []), id));
  return null;
}

const exposure = createExpose({
  register: (kind, name) => kind === "command"
    ? Promise.resolve()
    : bridge.calls.request("runtime.native.call", { name: "registered", payload: { kind, name } }).then(() => undefined),
  onRequest: (answer) => bridge.runtime.native.on("exposure-request", answer),
  reply: (id, payload) => bridge.calls.request("runtime.native.call", { name: "exposureReply", payload: { id, ...payload } }),
  report: (text) => reportError("agents.accounts", String(text)),
}, () => start.declarations);

// The form enters its values through the inputs; Enter runs the command instead of submitting the page.
form.addEventListener("submit", (event) => event.preventDefault());
await Promise.all([
  exposure.command(DEFINE, define), bridge.commands.register(DEFINE, define),
  exposure.command(REMOVE, remove), bridge.commands.register(REMOVE, remove),
]);
for (const [name, element] of [["id", "define-id"], ["cli", "define-cli"], ["args", "define-args"], ["env", "define-env"]]) {
  await exposure.mark(document.getElementById(element), DEFINE, {}, name);
}
await exposure.delegate(form);
bridge.runtime.data.on(() => { reload(); });
await reload();
