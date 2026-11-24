// The agent accounts of the project (A2, A36 in docs/features.md): one value per project under the key accounts (plugin.json data), a
// list of {id, cli, args, env, home}. cli is the program name of the agent CLI, args its arguments as given, and env the names of the
// environment variables that the program receives; no variable value is stored. home is null or {variable, folder}, the configuration
// home in which the CLI keeps the login of the account (docs/spec/definitions.md#account-homes).

const ACCOUNT_ID = /^[a-z][a-z0-9-]{0,39}$/;
const CLI = /^[^\s\u0000-\u001f\u007f]{1,255}$/;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const MEMBERS = ["args", "cli", "env", "home", "id"];
// The variable through which each agent CLI reads its configuration home, by the last path segment of cli.
const HOME_VARIABLES = { claude: "CLAUDE_CONFIG_DIR", codex: "CODEX_HOME" };
// The arguments after the cli that start its login in an empty home: claude asks for the login at its first start.
const LOGIN_ARGS = { claude: [], codex: ["login"] };
const WHERE = "projects.json plugins.agents.accounts";

// Throws with the text of the rule when the value is not a list of accounts with the members id, cli, args and env, and no repeated
// identifier. The error names the file and the key, so the person can find the stored value.
export function parseAccounts(value) {
  if (!Array.isArray(value)) throw new Error(`${WHERE}: the value is not a list of accounts`);
  const ids = new Set();
  value.forEach((account, index) => {
    const keys = account !== null && typeof account === "object" && !Array.isArray(account) ? Object.keys(account).sort() : null;
    if (keys === null || keys.length !== MEMBERS.length || keys.some((key, i) => key !== MEMBERS[i])) {
      throw new Error(`${WHERE}: account ${index} must have the members id, cli, args, env and home only`);
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
  const home = account.home;
  const valid = home === null || (home !== null && typeof home === "object" && !Array.isArray(home)
    && Object.keys(home).sort().join() === "folder,variable" && Object.values(HOME_VARIABLES).includes(home.variable)
    && typeof home.folder === "string" && home.folder.startsWith("/"));
  if (!valid) throw new Error("account home must be null or {variable, folder} with the variable CLAUDE_CONFIG_DIR or CODEX_HOME and an absolute folder");
}

// The last path segment of the cli, which names the agent CLI.
const cliName = (cli) => cli.split("/").pop();

// The home of an account of cli with the identifier: the folder accounts/<id> of the data folder of the plugin for claude and codex, and
// null for another cli.
export function homeOf(cli, dataFolder, id) {
  if (typeof dataFolder !== "string" || !dataFolder.startsWith("/")) throw new Error("the data folder of the plugin must be an absolute path");
  const variable = HOME_VARIABLES[cliName(cli)];
  return variable === undefined ? null : { variable, folder: `${dataFolder}/accounts/${id}` };
}

// Returns a new list with the account added, or replacing the account with the same identifier in its place. The input is unchanged.
// The home is that of homeOf with dataFolder, the data folder of the plugin.
export function defineAccount(accounts, account, dataFolder) {
  parseAccounts(accounts);
  checkAccount({ ...account, home: null });
  const next = { id: account.id, cli: account.cli, args: [...account.args], env: [...account.env], home: homeOf(account.cli, dataFolder, account.id) };
  const index = accounts.findIndex((entry) => entry.id === account.id);
  if (index === -1) return [...accounts, next];
  return accounts.map((entry, i) => (i === index ? next : entry));
}

// Returns a new list without the account with the identifier. An identifier that the list does not hold is refused with the text of the rule.
export function removeAccount(accounts, id) {
  parseAccounts(accounts);
  if (!accounts.some((entry) => entry.id === id)) throw new Error(`account ${id} is not defined`);
  return accounts.filter((entry) => entry.id !== id);
}

// The declared program and its arguments that read the login of the home of the account with the documented status command of its cli:
// claude auth status --json prints {loggedIn, configDirectory, loginExpiresAt}, and codex login status exits 0 or 1. An account without a
// home has no status program.
export function statusProgram(account) {
  if (account.home === null) return null;
  const home = `${account.home.variable}=${account.home.folder}`;
  if (account.home.variable === HOME_VARIABLES.claude) return { name: "claude-status", args: [home, account.cli, "auth", "status", "--json"] };
  return { name: "codex-status", args: [home, account.cli, "login", "status"] };
}

// The login of the account, {login, expires}, from the reply of its status program. claude exits 0 with loggedIn true and 1 with loggedIn
// false, and names its configuration folder, which must be the home; expires is its loginExpiresAt, the end of the login, or null. codex
// exits 0 or 1 and states no end.
export function loginOf(account, reply) {
  const claude = account.home.variable === HOME_VARIABLES.claude;
  const name = claude ? "claude-status" : "codex-status";
  const where = `login of account ${account.id}: ${name}`;
  if (reply.truncated.stdout || reply.truncated.stderr) throw new Error(`${where} output was truncated`);
  if (reply.code !== 0 && reply.code !== 1) throw new Error(`${where} ended with status ${reply.code}: ${reply.stderr.trim()}`);
  if (!claude) return { login: reply.code === 0, expires: null };
  let status;
  try {
    status = JSON.parse(reply.stdout);
  } catch {
    throw new Error(`${where} printed no status JSON: ${JSON.stringify(reply.stdout.slice(0, 200))}`);
  }
  if (status === null || typeof status !== "object" || typeof status.loggedIn !== "boolean" || typeof status.configDirectory !== "string" ||
      !(status.loginExpiresAt === null || typeof status.loginExpiresAt === "string")) {
    throw new Error(`${where} printed no status JSON: ${JSON.stringify(reply.stdout.slice(0, 200))}`);
  }
  if (status.loggedIn !== (reply.code === 0)) throw new Error(`${where} ended with status ${reply.code} and loggedIn ${status.loggedIn}`);
  if (status.configDirectory !== account.home.folder) {
    throw new Error(`login of account ${account.id}: claude reports the configuration folder ${status.configDirectory}, not the home ${account.home.folder}`);
  }
  return { login: status.loggedIn, expires: status.loginExpiresAt };
}

// The parameters of core.layout.open for the terminal tab that runs the cli in the home of the account, in the working folder in which
// its members start: the first start of claude asks for the text style, the login and the trust of that folder, which the person answers
// once; codex login ends after the login.
export function loginTab(account, terminalPlugin, directory) {
  if (account.home === null) throw new Error(`account ${account.id} has no home`);
  if (typeof directory !== "string" || !directory.startsWith("/")) {
    throw new Error(`the login of account ${account.id} needs an absolute working folder, not ${directory}`);
  }
  const name = account.home.variable === HOME_VARIABLES.claude ? "claude" : "codex";
  return {
    card: "current", plugin: terminalPlugin,
    params: { program: "env", args: [`${account.home.variable}=${account.home.folder}`, account.cli, ...LOGIN_ARGS[name]], directory, title: `${account.id} 로그인` },
  };
}

// The arguments of the declared program account-home, which creates the home folder with mode 0700.
export const homeFolderArgs = (account) => ["-p", "-m", "700", account.home.folder];
