// Checks the agent accounts of the project (A2, A36): one value per project under the key accounts, a list of {id, cli, args, env, home}.
// The rules are those of ui/accounts.js; the literal values are the expectations (docs/spec/definitions.md#account-homes).
import assert from "node:assert/strict";
import test from "node:test";
import { defineAccount, homeOf, loginOf, loginProgram, parseAccounts, removeAccount, statusProgram } from "../ui/accounts.js";

const DATA = "/config/plugin-data/agents";
const CLAUDE = { id: "claude-main", cli: "claude", args: ["--verbose"], env: ["ANTHROPIC_API_KEY"], home: { variable: "CLAUDE_CONFIG_DIR", folder: `${DATA}/accounts/claude-main` } };
const CODEX = { id: "codex-main", cli: "codex", args: [], env: [], home: { variable: "CODEX_HOME", folder: `${DATA}/accounts/codex-main` } };
const OTHER = { id: "gemini", cli: "gemini", args: [], env: [], home: null };

test("homeOf gives claude and codex a home under the data folder of the plugin and another cli none", () => {
  assert.deepEqual(homeOf("claude", DATA, "work"), { variable: "CLAUDE_CONFIG_DIR", folder: `${DATA}/accounts/work` });
  assert.deepEqual(homeOf("/opt/bin/codex", DATA, "work"), { variable: "CODEX_HOME", folder: `${DATA}/accounts/work` });
  assert.equal(homeOf("gemini", DATA, "work"), null);
  assert.throws(() => homeOf("claude", "relative", "work"), /the data folder of the plugin must be an absolute path/);
});

test("defineAccount adds an account with its home to the end of the list and keeps the input unchanged", () => {
  const before = [CLAUDE];
  const after = defineAccount(before, { id: "codex-main", cli: "codex", args: [], env: [] }, DATA);
  assert.deepEqual(after, [CLAUDE, CODEX]);
  assert.deepEqual(before, [CLAUDE]);
  assert.deepEqual(defineAccount([], { id: "gemini", cli: "gemini", args: [], env: [] }, DATA), [OTHER]);
});

test("defineAccount replaces the account with the same identifier in place", () => {
  const after = defineAccount([CLAUDE, CODEX], { id: "claude-main", cli: "claude", args: [], env: [] }, DATA);
  assert.deepEqual(after, [{ ...CLAUDE, args: [], env: [] }, CODEX]);
});

test("defineAccount refuses an identifier outside the form of an identifier, with the text of the rule", () => {
  assert.throws(() => defineAccount([], { id: "Bad Id", cli: "claude", args: [], env: [] }, DATA), /account identifier Bad Id must match/);
  assert.throws(() => defineAccount([], { id: "", cli: "claude", args: [], env: [] }, DATA), /account identifier .* must match/);
});

test("defineAccount refuses a cli that is empty or holds white space or a control character", () => {
  assert.throws(() => defineAccount([], { id: "a", cli: "", args: [], env: [] }, DATA), /account cli must be 1 to 255 characters without white space/);
  assert.throws(() => defineAccount([], { id: "a", cli: "my cli", args: [], env: [] }, DATA), /account cli must be 1 to 255 characters without white space/);
  assert.throws(() => defineAccount([], { id: "a", cli: "claude\n", args: [], env: [] }, DATA), /account cli must be 1 to 255 characters without white space/);
});

test("defineAccount refuses args that are not text lines and env names that are not variable names or repeat", () => {
  assert.throws(() => defineAccount([], { id: "a", cli: "claude", args: [1], env: [] }, DATA), /account args must be a list of text/);
  assert.throws(() => defineAccount([], { id: "a", cli: "claude", args: [], env: ["1BAD"] }, DATA), /account env name 1BAD must match/);
  assert.throws(() => defineAccount([], { id: "a", cli: "claude", args: [], env: ["HOME", "HOME"] }, DATA), /account env name HOME repeats/);
});

test("removeAccount drops the account with the identifier and refuses an identifier that the list does not hold", () => {
  assert.deepEqual(removeAccount([CLAUDE], "claude-main"), []);
  assert.throws(() => removeAccount([CLAUDE], "codex-main"), /account codex-main is not defined/);
});

test("parseAccounts accepts an empty list and refuses another form, naming the file and the key", () => {
  assert.deepEqual(parseAccounts([]), []);
  assert.deepEqual(parseAccounts([CLAUDE, CODEX, OTHER]), [CLAUDE, CODEX, OTHER]);
  assert.throws(() => parseAccounts({}), /projects\.json plugins\.agents\.accounts: the value is not a list of accounts/);
  assert.throws(() => parseAccounts([{ id: "a", cli: "claude", args: [], env: [] }]), /projects\.json plugins\.agents\.accounts: account 0 must have the members id, cli, args, env and home only/);
  assert.throws(() => parseAccounts([{ ...CLAUDE, extra: true }]), /projects\.json plugins\.agents\.accounts: account 0 must have the members id, cli, args, env and home only/);
  assert.throws(() => parseAccounts([CLAUDE, CLAUDE]), /projects\.json plugins\.agents\.accounts: account identifier claude-main repeats/);
  assert.throws(() => parseAccounts([{ ...CLAUDE, home: { variable: "HOME", folder: "/x" } }]), /account 0: account home must be null or \{variable, folder\} with the variable CLAUDE_CONFIG_DIR or CODEX_HOME and an absolute folder/);
  assert.throws(() => parseAccounts([{ ...CLAUDE, home: { variable: "CLAUDE_CONFIG_DIR", folder: "x" } }]), /account home must be null or/);
});

test("statusProgram reads the login of a home with the documented status command of its cli, and of no home nothing", () => {
  assert.deepEqual(statusProgram(CLAUDE), { name: "claude-status", args: [`CLAUDE_CONFIG_DIR=${CLAUDE.home.folder}`, "claude", "auth", "status", "--json"] });
  assert.deepEqual(statusProgram(CODEX), { name: "codex-status", args: [`CODEX_HOME=${CODEX.home.folder}`, "codex", "login", "status"] });
  assert.equal(statusProgram(OTHER), null);
});

// The status JSON of claude auth status --json, as claude 2.1.331 prints it for a home.
const claudeStatus = (loggedIn, configDirectory, loginExpiresAt) => JSON.stringify({ loggedIn, authMethod: loggedIn ? "claude.ai" : "none", configDirectory, loginExpiresAt });
const reply = (code, stdout) => ({ code, stdout, stderr: "", truncated: { stdout: false, stderr: false } });

test("loginOf reads the login and its end from the status JSON of a claude home", () => {
  assert.deepEqual(loginOf(CLAUDE, reply(0, claudeStatus(true, CLAUDE.home.folder, "2027-11-25T00:00:00.000Z"))), { login: true, expires: "2027-11-25T00:00:00.000Z" });
  assert.deepEqual(loginOf(CLAUDE, reply(1, claudeStatus(false, CLAUDE.home.folder, null))), { login: false, expires: null });
});

test("loginOf refuses a claude status of another configuration folder, a status that contradicts its exit status, and output that is not the status JSON", () => {
  assert.throws(() => loginOf(CLAUDE, reply(0, claudeStatus(true, "/Users/person/.claude", null))), /login of account claude-main: claude reports the configuration folder \/Users\/person\/\.claude, not the home \/config\/plugin-data\/agents\/accounts\/claude-main/);
  assert.throws(() => loginOf(CLAUDE, reply(1, claudeStatus(true, CLAUDE.home.folder, null))), /login of account claude-main: claude-status ended with status 1 and loggedIn true/);
  assert.throws(() => loginOf(CLAUDE, reply(0, "not json")), /login of account claude-main: claude-status printed no status JSON/);
  assert.throws(() => loginOf(CLAUDE, reply(2, "")), /login of account claude-main: claude-status ended with status 2/);
  assert.throws(() => loginOf(CLAUDE, { ...reply(0, claudeStatus(true, CLAUDE.home.folder, null)), truncated: { stdout: true, stderr: false } }), /login of account claude-main: claude-status output was truncated/);
});

test("loginOf reads the login of a codex home from the exit status of codex login status", () => {
  assert.deepEqual(loginOf(CODEX, reply(0, "Logged in using ChatGPT\n")), { login: true, expires: null });
  assert.deepEqual(loginOf(CODEX, reply(1, "Not logged in\n")), { login: false, expires: null });
  assert.throws(() => loginOf(CODEX, reply(2, "")), /login of account codex-main: codex-status ended with status 2/);
});

test("loginProgram runs the login program of the cli in the home of the account", () => {
  assert.deepEqual(loginProgram(CLAUDE), { name: "claude-login", args: ["claude", CLAUDE.home.folder, "claude"] });
  assert.deepEqual(loginProgram({ ...CODEX, cli: "/opt/bin/codex" }), { name: "codex-login", args: ["codex", CODEX.home.folder, "/opt/bin/codex"] });
  assert.throws(() => loginProgram(OTHER), /account gemini has no home/);
});
