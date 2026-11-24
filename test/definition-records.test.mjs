// Checks the definition records of the definitions section (A5): one value per project under the key definitions, an object of
// definition identifier to {name, account, plugin, role, cwd}. The rules are those of ui/definition-records.js; the literal
// values are the expectations.
import assert from "node:assert/strict";
import test from "node:test";
import { defineDefinition, definitionsUsingAccount, parseDefinitions, removeDefinition, resolveDefinition } from "../ui/definition-records.js";

const HOME = { variable: "CLAUDE_CONFIG_DIR", folder: "/config/plugin-data/agents/accounts/claude-main" };
const ACCOUNTS = [{ id: "claude-main", cli: "claude", args: ["--verbose"], env: [], home: HOME }];
const FIELDS = { name: "Reviewer", account: "claude-main", plugin: "terminal", cwd: "/work/project" };

test("defineDefinition adds the record with role equal to the identifier and keeps the input unchanged", () => {
  const before = {};
  const after = defineDefinition(before, ACCOUNTS, { id: "reviewer", ...FIELDS });
  assert.deepEqual(after, { reviewer: { name: "Reviewer", account: "claude-main", plugin: "terminal", role: "reviewer", cwd: "/work/project" } });
  assert.deepEqual(before, {});
});

test("defineDefinition replaces the record with the same identifier and trims the name", () => {
  const before = defineDefinition({}, ACCOUNTS, { id: "reviewer", ...FIELDS });
  const after = defineDefinition(before, ACCOUNTS, { id: "reviewer", ...FIELDS, name: "  Review  " });
  assert.equal(after.reviewer.name, "Review");
});

test("defineDefinition refuses a name that is empty or longer than 40 characters, with the text of the rule", () => {
  assert.throws(() => defineDefinition({}, ACCOUNTS, { id: "a", ...FIELDS, name: "   " }), /definition name must be 1 to 40 characters/);
  assert.throws(() => defineDefinition({}, ACCOUNTS, { id: "a", ...FIELDS, name: "가".repeat(41) }), /definition name must be 1 to 40 characters/);
});

test("defineDefinition refuses an account that the accounts do not define", () => {
  assert.throws(() => defineDefinition({}, ACCOUNTS, { id: "a", ...FIELDS, account: "codex-main" }), /account codex-main is not defined/);
});

test("defineDefinition refuses a plugin that is not a plugin identifier and a cwd that is not an absolute path", () => {
  assert.throws(() => defineDefinition({}, ACCOUNTS, { id: "a", ...FIELDS, plugin: "Bad Plugin" }), /definition plugin Bad Plugin must be a plugin identifier/);
  assert.throws(() => defineDefinition({}, ACCOUNTS, { id: "a", ...FIELDS, cwd: "work/project" }), /definition cwd must be an absolute path/);
  assert.throws(() => defineDefinition({}, ACCOUNTS, { id: "a", ...FIELDS, cwd: "/work/../x" }), /definition cwd must be an absolute path/);
});

test("defineDefinition refuses an empty identifier", () => {
  assert.throws(() => defineDefinition({}, ACCOUNTS, { id: "", ...FIELDS }), /definition identifier must be a non-empty text/);
});

test("removeDefinition drops the record and refuses an identifier that is not defined", () => {
  const defined = defineDefinition({}, ACCOUNTS, { id: "reviewer", ...FIELDS });
  assert.deepEqual(removeDefinition(defined, "reviewer"), {});
  assert.throws(() => removeDefinition({}, "reviewer"), /definition reviewer is not defined/);
});

test("parseDefinitions accepts an empty object and refuses another form, naming the file and the key", () => {
  assert.deepEqual(parseDefinitions({}), {});
  assert.throws(() => parseDefinitions([]), /projects\.json plugins\.agents\.definitions: the value is not an object of definition identifier to \{name, account, plugin, role, cwd\}/);
  assert.throws(() => parseDefinitions({ a: { name: "A" } }), /projects\.json plugins\.agents\.definitions: definition a must have the members account, cwd, name, plugin and role/);
  assert.throws(() => parseDefinitions({ a: { ...FIELDS, role: "a", program: "claude" } }), /projects\.json plugins\.agents\.definitions: definition a must have the members account, cwd, name, plugin and role/);
});

test("resolveDefinition starts the cli of an account with a home through env in that home, and refuses a missing definition or account", () => {
  const definitions = defineDefinition({}, ACCOUNTS, { id: "reviewer", ...FIELDS });
  assert.deepEqual(resolveDefinition(definitions, ACCOUNTS, "reviewer"), {
    id: "reviewer", name: "Reviewer", account: "claude-main", plugin: "terminal", program: "env",
    args: [`CLAUDE_CONFIG_DIR=${HOME.folder}`, "claude", "--verbose"], role: "reviewer", cwd: "/work/project",
  });
  const plain = [{ id: "claude-main", cli: "gemini", args: ["-y"], env: [], home: null }];
  assert.deepEqual(resolveDefinition(definitions, plain, "reviewer").program, "gemini");
  assert.deepEqual(resolveDefinition(definitions, plain, "reviewer").args, ["-y"]);
  assert.throws(() => resolveDefinition(definitions, ACCOUNTS, "other"), /definition other is not defined/);
  assert.throws(() => resolveDefinition(definitions, [], "reviewer"), /definition reviewer uses account claude-main that is not defined/);
});

test("definitionsUsingAccount lists the identifiers of the definitions that name the account", () => {
  const definitions = defineDefinition(
    defineDefinition({}, ACCOUNTS, { id: "reviewer", ...FIELDS }),
    [...ACCOUNTS, { id: "codex-main", cli: "codex", args: [], env: [], home: null }],
    { id: "writer", ...FIELDS, account: "codex-main" },
  );
  assert.deepEqual(definitionsUsingAccount(definitions, "claude-main"), ["reviewer"]);
  assert.deepEqual(definitionsUsingAccount(definitions, "unused"), []);
});

const LAUNCH = { args: ["--plugin-dir", "/m/plugin", "--add-dir", "/m/plugin"], env: { MOAI_PLUGIN: "/m/plugin", A_FIRST: "1" } };

test("parseDefinitions accepts maker with launch, and refuses maker without launch, launch without maker and a launch of another form", () => {
  const record = { name: "A", account: "claude-main", plugin: "terminal", role: "a", cwd: "/work/project" };
  assert.deepEqual(parseDefinitions({ a: { ...record, maker: "moai", launch: LAUNCH } }), { a: { ...record, maker: "moai", launch: LAUNCH } });
  const members = /projects\.json plugins\.agents\.definitions: definition a must have the members account, cwd, name, plugin and role, and maker with launch or neither/;
  assert.throws(() => parseDefinitions({ a: { ...record, maker: "moai" } }), members);
  assert.throws(() => parseDefinitions({ a: { ...record, launch: LAUNCH } }), members);
  assert.throws(() => parseDefinitions({ a: { ...record, maker: 1, launch: LAUNCH } }), members);
  const form = /definition a launch must be \{args, env\} with args a list of text and env an object of variable name to text/;
  assert.throws(() => parseDefinitions({ a: { ...record, maker: "moai", launch: { args: [1], env: {} } } }), form);
  assert.throws(() => parseDefinitions({ a: { ...record, maker: "moai", launch: { args: [], env: { "1X": "a" } } } }), form);
  assert.throws(() => parseDefinitions({ a: { ...record, maker: "moai", launch: { args: [], env: {}, extra: 1 } } }), form);
});

test("defineDefinition stores maker and launch together when the listing gives them, and a record without maker has neither", () => {
  const withMaker = defineDefinition({}, ACCOUNTS, { id: "reviewer", ...FIELDS, maker: "moai", launch: LAUNCH });
  assert.deepEqual(withMaker.reviewer, { name: "Reviewer", account: "claude-main", plugin: "terminal", role: "reviewer", cwd: "/work/project", maker: "moai", launch: LAUNCH });
  const plain = defineDefinition({}, ACCOUNTS, { id: "reviewer", ...FIELDS });
  assert.equal(Object.hasOwn(plain.reviewer, "maker") || Object.hasOwn(plain.reviewer, "launch"), false);
  assert.throws(() => defineDefinition({}, ACCOUNTS, { id: "reviewer", ...FIELDS, maker: "moai" }), /definition maker and launch are given together/);
});

test("defineDefinition keeps the maker and the launch of a record that the person defines again", () => {
  const listed = defineDefinition({}, ACCOUNTS, { id: "reviewer", ...FIELDS, maker: "moai", launch: LAUNCH });
  const again = defineDefinition(listed, ACCOUNTS, { id: "reviewer", ...FIELDS, name: "Review" });
  assert.equal(again.reviewer.maker, "moai");
  assert.deepEqual(again.reviewer.launch, LAUNCH);
  assert.equal(again.reviewer.name, "Review");
});

test("resolveDefinition adds the variables of the launch after the home variable, sorted by name, and its arguments after the account", () => {
  const definitions = defineDefinition({}, ACCOUNTS, { id: "reviewer", ...FIELDS, maker: "moai", launch: LAUNCH });
  assert.deepEqual(resolveDefinition(definitions, ACCOUNTS, "reviewer").args, [
    `CLAUDE_CONFIG_DIR=${HOME.folder}`, "A_FIRST=1", "MOAI_PLUGIN=/m/plugin", "claude", "--verbose", "--plugin-dir", "/m/plugin", "--add-dir", "/m/plugin",
  ]);
  const plain = [{ id: "claude-main", cli: "claude", args: [], env: [], home: null }];
  assert.deepEqual(resolveDefinition(definitions, plain, "reviewer"), {
    id: "reviewer", name: "Reviewer", account: "claude-main", plugin: "terminal", program: "env",
    args: ["A_FIRST=1", "MOAI_PLUGIN=/m/plugin", "claude", "--plugin-dir", "/m/plugin", "--add-dir", "/m/plugin"], role: "reviewer", cwd: "/work/project",
  });
});
