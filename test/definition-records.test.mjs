// Checks the definition records of the definitions section (A5): one value per project under the key definitions, an object of
// definition identifier to {name, account, plugin, role, cwd}. The rules are those of ui/definition-records.js; the literal
// values are the expectations.
import assert from "node:assert/strict";
import test from "node:test";
import { defineDefinition, definitionsUsingAccount, parseDefinitions, removeDefinition, resolveDefinition } from "../ui/definition-records.js";

const ACCOUNTS = [{ id: "claude-main", cli: "claude", args: ["--verbose"], env: [] }];
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

test("resolveDefinition gives the program and the arguments of the account, and refuses a missing definition or account", () => {
  const definitions = defineDefinition({}, ACCOUNTS, { id: "reviewer", ...FIELDS });
  assert.deepEqual(resolveDefinition(definitions, ACCOUNTS, "reviewer"), {
    id: "reviewer", name: "Reviewer", account: "claude-main", plugin: "terminal", program: "claude", args: ["--verbose"], role: "reviewer", cwd: "/work/project",
  });
  assert.throws(() => resolveDefinition(definitions, ACCOUNTS, "other"), /definition other is not defined/);
  assert.throws(() => resolveDefinition(definitions, [], "reviewer"), /definition reviewer uses account claude-main that is not defined/);
});

test("definitionsUsingAccount lists the identifiers of the definitions that name the account", () => {
  const definitions = defineDefinition(
    defineDefinition({}, ACCOUNTS, { id: "reviewer", ...FIELDS }),
    [...ACCOUNTS, { id: "codex-main", cli: "codex", args: [], env: [] }],
    { id: "writer", ...FIELDS, account: "codex-main" },
  );
  assert.deepEqual(definitionsUsingAccount(definitions, "claude-main"), ["reviewer"]);
  assert.deepEqual(definitionsUsingAccount(definitions, "unused"), []);
});

