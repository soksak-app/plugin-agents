// The agent accounts of the project (A2 in docs/features.md): one value per project under the key accounts (plugin.json data), a
// list of {id, cli, args, env}. cli is the program name of the agent CLI, args its arguments as given, and env the names of the
// environment variables that the program receives; no variable value is stored. The form enters args and env as text with one
// entry per line.

const ACCOUNT_ID = /^[a-z][a-z0-9-]{0,39}$/;
const CLI = /^[^\s\u0000-\u001f\u007f]{1,255}$/;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const MEMBERS = ["args", "cli", "env", "id"];
const WHERE = "projects.json plugins.agents.accounts";

// Throws with the text of the rule when the value is not a list of accounts with the members id, cli, args and env, and no repeated
// identifier. The error names the file and the key, so the person can find the stored value.
export function parseAccounts(value) {
  if (!Array.isArray(value)) throw new Error(`${WHERE}: the value is not a list of accounts`);
  const ids = new Set();
  value.forEach((account, index) => {
    const keys = account !== null && typeof account === "object" && !Array.isArray(account) ? Object.keys(account).sort() : null;
    if (keys === null || keys.length !== MEMBERS.length || keys.some((key, i) => key !== MEMBERS[i])) {
      throw new Error(`${WHERE}: account ${index} must have the members id, cli, args and env only`);
    }
    try {
      checkAccount(account);
    } catch (error) {
      throw new Error(`${WHERE}: account ${index}: ${error.message}`);
    }
    if (ids.has(account.id)) throw new Error(`${WHERE}: account identifier ${account.id} repeats`);
    ids.add(account.id);
  });
  return value;
}

// Throws with the text of the rule when an account does not hold the form of its members.
function checkAccount(account) {
  if (typeof account.id !== "string" || !ACCOUNT_ID.test(account.id)) {
    throw new Error(`account identifier ${account.id} must match ${ACCOUNT_ID.source}`);
  }
  if (typeof account.cli !== "string" || !CLI.test(account.cli)) {
    throw new Error("account cli must be 1 to 255 characters without white space");
  }
  if (!Array.isArray(account.args) || account.args.some((arg) => typeof arg !== "string")) {
    throw new Error("account args must be a list of text");
  }
  if (!Array.isArray(account.env) || account.env.some((name) => typeof name !== "string")) {
    throw new Error("account env must be a list of text");
  }
  const names = new Set();
  for (const name of account.env) {
    if (!ENV_NAME.test(name)) throw new Error(`account env name ${name} must match ${ENV_NAME.source}`);
    if (names.has(name)) throw new Error(`account env name ${name} repeats`);
    names.add(name);
  }
}

// Returns a new list with the account added, or replacing the account with the same identifier in its place. The input is unchanged.
export function defineAccount(accounts, account) {
  parseAccounts(accounts);
  checkAccount(account);
  const index = accounts.findIndex((entry) => entry.id === account.id);
  const next = { id: account.id, cli: account.cli, args: [...account.args], env: [...account.env] };
  if (index === -1) return [...accounts, next];
  return accounts.map((entry, i) => (i === index ? next : entry));
}

// Returns a new list without the account with the identifier. An identifier that the list does not hold is refused with the text of the rule.
export function removeAccount(accounts, id) {
  parseAccounts(accounts);
  if (!accounts.some((entry) => entry.id === id)) throw new Error(`account ${id} is not defined`);
  return accounts.filter((entry) => entry.id !== id);
}

// Turns the text of the form into an account and defines it. The args and env texts have one entry per line; blank lines are skipped
// and each entry is trimmed. The identifier and the cli are checked by defineAccount.
export function accountFromText(accounts, { id, cli, args, env }) {
  if (typeof args !== "string") throw new Error("account args must be text");
  if (typeof env !== "string") throw new Error("account env must be text");
  const lines = (text) => text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  return defineAccount(accounts, { id, cli: typeof cli === "string" ? cli.trim() : cli, args: lines(args), env: lines(env) });
}

// The rows of the section: each account in the code point order of its identifier.
export function accountRows(accounts) {
  parseAccounts(accounts);
  return accounts
    .map((account) => ({ id: account.id, cli: account.cli, args: [...account.args], env: [...account.env] }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
