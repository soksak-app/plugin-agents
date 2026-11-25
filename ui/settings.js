// The settings view of the plugin (A26-3, docs/spec/definitions.md#settings-view): the plugin page of the settings window shows this page,
// which lists the accounts of the project of the window with their login, runs the login of an account, whose sign-in page the region
// login shows, and adds an account. The accounts are project data, so a window without a project lists none.
import { createExpose } from "@soksak/plugin-api";
import { createViewBridge } from "@soksak/plugin-api/view";
import { exposurePort } from "./exposure-port.js";
import { parseAccounts } from "./accounts.js";
import { accountLogins, defineAccountRecord, loginAccount, removeAccountRecord } from "./definition-commands.js";

const ACCOUNT_DEFINE = "agents.account.define";
const ACCOUNT_REMOVE = "agents.account.remove";
const ACCOUNT_LOGIN = "agents.account.login";
const LOGIN_CANCEL = "agents.account.login.cancel";
const SIGN_IN = "agents.settings.sign-in";
const LOGINS = "agents.settings.accounts";
const LOGIN_RUN = "agents.settings.login-run";
const ACCOUNTS = "accounts";
const WHERE = "agents.settings";

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
if (start === null || typeof start !== "object") throw new Error("the settings view has no start values: window.sokSurface is missing");

const api = { data: bridge.runtime.data, calls: bridge.calls, settings: bridge.runtime.settings, program: bridge.runtime.program, dataFolder: start.dataFolder };
const exposure = createExpose(exposurePort(bridge, WHERE, reportError), () => start.declarations);
const list = document.getElementById("accounts");
const noProject = document.getElementById("no-project");
const loginPage = document.getElementById("login-page");
const newAccount = document.getElementById("new-account");
const accountIdField = document.getElementById("account-id");
const accountCliField = document.getElementById("account-cli");
const accountAddButton = document.getElementById("account-add");
const message = document.getElementById("error");

// Shows the text of a refusal in the view and records it at that moment through runtime.error.
function refused(error) {
  const text = error?.message ?? String(error);
  message.textContent = text;
  reportError(WHERE, text);
}

// The login of each account, {id, cli, login, expires}, as the rows show it and the status agents.settings.accounts publishes it.
let logins = [];
const loginWatchers = new Set();

// The open login {id, url, page, controller}, or null. url is the sign-in address, null before the login program hands it over, and page
// the last document state of the region login {url, title, loading, error}, null before the region reports one.
let run = null;
const runWatchers = new Set();
const runValue = () => (run === null ? null : { id: run.id, url: run.url, page: run.page });

// The text of the login of an account: 로그인됨 with the end of the login, 로그인 필요, or - for an account without a home.
function loginText(row) {
  if (row.login === null) return "-";
  if (row.login === false) return "로그인 필요";
  return row.expires === null ? "로그인됨" : `로그인됨 · ${new Date(row.expires).toLocaleString("ko-KR")}까지`;
}

// Draws one row per account. A row without a login has the login button, or the cancel button while its login runs; the other login
// buttons are disabled while a login runs, because one login runs at a time.
function drawRows() {
  list.replaceChildren(...logins.map((row) => {
    const item = document.createElement("li");
    const id = Object.assign(document.createElement("span"), { className: "id", textContent: row.id });
    const cli = Object.assign(document.createElement("span"), { className: "cli", textContent: row.cli });
    const state = Object.assign(document.createElement("span"), { className: "login", textContent: loginText(row) });
    item.append(id, cli, state);
    if (run !== null && run.id === row.id) {
      const cancel = Object.assign(document.createElement("button"), { type: "button", textContent: "로그인 취소" });
      item.append(cancel);
      exposure.element("agents.settings.login-cancel", cancel).catch(refused);
      exposure.bind(cancel, LOGIN_CANCEL, {}, { failed: refused }).catch(refused);
    } else if (row.login === false) {
      const login = Object.assign(document.createElement("button"), { type: "button", textContent: "로그인", disabled: run !== null });
      login.dataset.expose = "agents.settings.login";
      item.append(login);
      exposure.bind(login, ACCOUNT_LOGIN, { id: row.id }, { failed: refused }).catch(refused);
    }
    return item;
  }));
  for (const watcher of runWatchers) watcher(runValue());
}

// Reads the accounts and their logins, draws the rows and publishes the status.
async function showAccounts() {
  const accounts = parseAccounts((await bridge.runtime.data.get(ACCOUNTS)) ?? []);
  logins = await accountLogins(api, accounts);
  drawRows();
  for (const watcher of loginWatchers) watcher({ accounts: logins });
}

// The command agents.account.define {id, cli, args, env}: adds the account and empties the row 새 계정.
async function addAccount(values) {
  const result = await defineAccountRecord(api, values);
  await showAccounts();
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

// The command agents.account.login {id}: runs the login of the account in the view. The end of the run hides the sign-in page and reads
// the login of the accounts again.
async function login(values) {
  if (run !== null) throw new Error(`the login of account ${run.id} is running`);
  run = { id: values.id, url: null, page: null, controller: new AbortController() };
  drawRows();
  try {
    return await loginAccount(api, values, { signal: run.controller.signal });
  } finally {
    run = null;
    loginPage.hidden = true;
    newAccount.hidden = false;
    await showAccounts();
  }
}

// The command agents.account.login.cancel: ends the open login, whose command then ends with cancelled.
async function cancelLogin() {
  run?.controller.abort();
  return null;
}

// The region login shows the sign-in page of a login.
let signInRegion;

// The command agents.settings.sign-in {url}: the login program hands the sign-in address, which the region login loads in the height of
// the view.
async function signIn({ url }) {
  if (run === null) throw new Error("no login of the settings view is open");
  if (typeof url !== "string" || !url.startsWith("https://")) throw new Error(`the sign-in address ${url} is not https`);
  run.url = url;
  newAccount.hidden = true;
  loginPage.hidden = false;
  await signInRegion.load(url);
  drawRows();
  return null;
}

// Creates the composition, registers the commands, statuses and elements and lists the accounts.
async function startView() {
  if (start.project === null) {
    noProject.hidden = false;
    newAccount.hidden = true;
    return;
  }
  const composition = await bridge.composition.create({ regions: { login: loginPage }, overlays: {} });
  signInRegion = composition.region("login");
  signInRegion.onState((state) => {
    if (run === null) return;
    run.page = { url: state.url, title: state.title, loading: state.loading, error: state.error };
    drawRows();
  });
  await Promise.all([
    exposure.status(LOGINS, () => ({ accounts: logins }), (watcher) => { loginWatchers.add(watcher); return () => loginWatchers.delete(watcher); }),
    exposure.status(LOGIN_RUN, runValue, (watcher) => { runWatchers.add(watcher); return () => runWatchers.delete(watcher); }),
    exposure.command(ACCOUNT_DEFINE, addAccount), bridge.commands.register(ACCOUNT_DEFINE, addAccount),
    exposure.command(ACCOUNT_REMOVE, removeAccount), bridge.commands.register(ACCOUNT_REMOVE, removeAccount),
    exposure.command(ACCOUNT_LOGIN, login), bridge.commands.register(ACCOUNT_LOGIN, login),
    exposure.command(LOGIN_CANCEL, cancelLogin), bridge.commands.register(LOGIN_CANCEL, cancelLogin),
    exposure.command(SIGN_IN, signIn), bridge.commands.register(SIGN_IN, signIn),
  ]);
  await Promise.all([
    exposure.element("agents.settings.login-page", loginPage),
    exposure.element("agents.settings.account-id", accountIdField),
    exposure.element("agents.settings.account-cli", accountCliField),
    exposure.element("agents.settings.account-add", accountAddButton),
    exposure.mark(accountIdField, ACCOUNT_DEFINE, null, "id"),
    exposure.mark(accountCliField, ACCOUNT_DEFINE, null, "cli"),
    exposure.bind(accountAddButton, ACCOUNT_DEFINE, () => ({ id: accountIdField.value.trim(), cli: accountCliField.value.trim(), args: [], env: [] }), { failed: refused }),
  ]);
  // A change of the stored accounts, by this view or another page of the plugin, reads the logins again.
  bridge.runtime.data.on(({ key }) => { if (key === ACCOUNTS) showAccounts().catch(refused); });
  await showAccounts();
}

// A start step that fails shows its refusal in the view.
try {
  await startView();
} catch (error) {
  refused(error);
}
