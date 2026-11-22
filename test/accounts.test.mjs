// Checks the agent accounts of the project (A2): one value per project under the key accounts, a list of {id, cli, args, env}.
// The rules are those of ui/accounts.js; the literal values are the expectations.
import assert from "node:assert/strict";
import test from "node:test";
import { accountFromText, accountRows, defineAccount, parseAccounts, removeAccount } from "../ui/accounts.js";

const CLAUDE = { id: "claude-main", cli: "claude", args: ["--verbose"], env: ["ANTHROPIC_API_KEY"] };

test("defineAccount adds an account to the end of the list and keeps the input unchanged", () => {
  const before = [CLAUDE];
  const after = defineAccount(before, { id: "codex-main", cli: "codex", args: [], env: [] });
  assert.deepEqual(after, [CLAUDE, { id: "codex-main", cli: "codex", args: [], env: [] }]);
  assert.deepEqual(before, [CLAUDE]);
});

test("defineAccount replaces the account with the same identifier in place", () => {
  const after = defineAccount([CLAUDE, { id: "codex-main", cli: "codex", args: [], env: [] }], { id: "claude-main", cli: "claude", args: [], env: [] });
  assert.deepEqual(after, [{ id: "claude-main", cli: "claude", args: [], env: [] }, { id: "codex-main", cli: "codex", args: [], env: [] }]);
});

test("defineAccount refuses an identifier outside the form of an identifier, with the text of the rule", () => {
  assert.throws(() => defineAccount([], { id: "Bad Id", cli: "claude", args: [], env: [] }), /account identifier Bad Id must match/);
  assert.throws(() => defineAccount([], { id: "", cli: "claude", args: [], env: [] }), /account identifier .* must match/);
});

test("defineAccount refuses a cli that is empty or holds white space or a control character", () => {
  assert.throws(() => defineAccount([], { id: "a", cli: "", args: [], env: [] }), /account cli must be 1 to 255 characters without white space/);
  assert.throws(() => defineAccount([], { id: "a", cli: "my cli", args: [], env: [] }), /account cli must be 1 to 255 characters without white space/);
  assert.throws(() => defineAccount([], { id: "a", cli: "claude\n", args: [], env: [] }), /account cli must be 1 to 255 characters without white space/);
});

test("defineAccount refuses args that are not text lines and env names that are not variable names or repeat", () => {
  assert.throws(() => defineAccount([], { id: "a", cli: "claude", args: [1], env: [] }), /account args must be a list of text/);
  assert.throws(() => defineAccount([], { id: "a", cli: "claude", args: [], env: ["1BAD"] }), /account env name 1BAD must match/);
  assert.throws(() => defineAccount([], { id: "a", cli: "claude", args: [], env: ["HOME", "HOME"] }), /account env name HOME repeats/);
});

test("accountFromText splits args and env by line, skips blank lines and trims each entry", () => {
  assert.deepEqual(accountFromText([], { id: "a", cli: " claude ", args: "--verbose\n\n  --model x  \n", env: "ANTHROPIC_API_KEY\n\nHOME\n" }), [
    { id: "a", cli: "claude", args: ["--verbose", "--model x"], env: ["ANTHROPIC_API_KEY", "HOME"] },
  ]);
});

test("accountFromText refuses args and env that are not text", () => {
  assert.throws(() => accountFromText([], { id: "a", cli: "claude", args: null, env: "" }), /account args must be text/);
  assert.throws(() => accountFromText([], { id: "a", cli: "claude", args: "", env: 3 }), /account env must be text/);
});

test("removeAccount drops the account with the identifier and refuses an identifier that the list does not hold", () => {
  assert.deepEqual(removeAccount([CLAUDE], "claude-main"), []);
  assert.throws(() => removeAccount([CLAUDE], "codex-main"), /account codex-main is not defined/);
});

test("parseAccounts accepts an empty list and refuses another form, naming the file and the key", () => {
  assert.deepEqual(parseAccounts([]), []);
  assert.throws(() => parseAccounts({}), /projects\.json plugins\.agents\.accounts: the value is not a list of accounts/);
  assert.throws(() => parseAccounts([{ id: "a", cli: "claude", args: [] }]), /projects\.json plugins\.agents\.accounts: account 0 must have the members id, cli, args and env only/);
  assert.throws(() => parseAccounts([{ ...CLAUDE, extra: true }]), /projects\.json plugins\.agents\.accounts: account 0 must have the members id, cli, args and env only/);
  assert.throws(() => parseAccounts([CLAUDE, CLAUDE]), /projects\.json plugins\.agents\.accounts: account identifier claude-main repeats/);
});

test("accountRows lists each account in the code point order of its identifier", () => {
  assert.deepEqual(accountRows([CLAUDE, { id: "codex-main", cli: "codex", args: [], env: [] }]), [
    { id: "claude-main", cli: "claude", args: ["--verbose"], env: ["ANTHROPIC_API_KEY"] },
    { id: "codex-main", cli: "codex", args: [], env: [] },
  ]);
});
