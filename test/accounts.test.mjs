// Checks the agent accounts of the project (A2, A36): one value per project under the key accounts, a list of {id, cli, args, env, home}.
// The rules are those of ui/accounts.js; the literal values are the expectations (docs/spec/definitions.md#account-homes).
import assert from "node:assert/strict";
import test from "node:test";
import { defineAccount, homeOf, keychainService, loginOf, loginProgram, loginTab, parseAccounts, removeAccount } from "../ui/accounts.js";

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

test("keychainService names the keychain item of the login of a claude home by the first 8 hexadecimal digits of the SHA-256 of the folder", async () => {
  const digest = (await import("node:crypto")).createHash("sha256").update("/x/accounts/work").digest("hex").slice(0, 8);
  assert.equal(await keychainService("/x/accounts/work"), `Claude Code-credentials-${digest}`);
});

test("loginProgram reads the login of a claude home from the keychain and of a codex home from auth.json, and of no home nothing", async () => {
  assert.deepEqual(await loginProgram(CLAUDE), { name: "claude-login", args: ["find-generic-password", "-s", await keychainService(CLAUDE.home.folder)] });
  assert.deepEqual(await loginProgram(CODEX), { name: "codex-login", args: ["-f", `${CODEX.home.folder}/auth.json`] });
  assert.equal(await loginProgram(OTHER), null);
});

test("loginOf reads the exit status of the login program and refuses another status, naming the account", () => {
  assert.equal(loginOf(CLAUDE, 0), true);
  assert.equal(loginOf(CLAUDE, 44), false);
  assert.equal(loginOf(CODEX, 0), true);
  assert.equal(loginOf(CODEX, 1), false);
  assert.throws(() => loginOf(CLAUDE, 1), /login of account claude-main: the program claude-login ended with status 1/);
  assert.throws(() => loginOf(CODEX, 2), /login of account codex-main: the program codex-login ended with status 2/);
});

test("loginTab opens a terminal tab that runs the login of the cli in the home of the account", () => {
  assert.deepEqual(loginTab(CLAUDE, "terminal"), {
    card: "current", plugin: "terminal",
    params: { program: "env", args: [`CLAUDE_CONFIG_DIR=${CLAUDE.home.folder}`, "claude"], title: "claude-main 로그인" },
  });
  assert.deepEqual(loginTab(CODEX, "terminal").params.args, [`CODEX_HOME=${CODEX.home.folder}`, "codex", "login"]);
  assert.throws(() => loginTab(OTHER, "terminal"), /account gemini has no home/);
});
