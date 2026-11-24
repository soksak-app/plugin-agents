// Checks the group data of the definitions section (A4): one value per project under the key groups, an object of
// group identifier to {name, members}. The rules are those of ui/groups.js; the literal values are the expectations.
import assert from "node:assert/strict";
import test from "node:test";
import { createGroup, groupRows, parseGroups } from "../ui/groups.js";

test("createGroup adds an empty group with its trimmed name and keeps the input unchanged", () => {
  const before = { alpha: { name: "Alpha", members: [] } };
  const after = createGroup(before, { id: "beta", name: "  Beta  " });
  assert.deepEqual(after, { alpha: { name: "Alpha", members: [] }, beta: { name: "Beta", members: [] } });
  assert.deepEqual(before, { alpha: { name: "Alpha", members: [] } });
});

test("createGroup refuses an empty name and a name of more than 40 characters, with the text of the rule", () => {
  assert.throws(() => createGroup({}, { id: "a", name: "   " }), /group name must be 1 to 40 characters/);
  assert.throws(() => createGroup({}, { id: "a", name: "가".repeat(41) }), /group name must be 1 to 40 characters/);
  assert.deepEqual(createGroup({}, { id: "a", name: "가".repeat(40) }).a.name.length, 40);
});

test("createGroup refuses a repeated identifier and an identifier outside the form of an identifier", () => {
  assert.throws(() => createGroup({ a: { name: "A", members: [] } }, { id: "a", name: "B" }), /group a already exists/);
  assert.throws(() => createGroup({}, { id: "Bad Id", name: "B" }), /group identifier Bad Id must match/);
});

// A28: a name that a group already has is refused, after the trim, so the group dialog shows the refusal and stores nothing.
test("createGroup refuses a name that a group already has, compared after the trim, and keeps the input unchanged", () => {
  const before = { alpha: { name: "Alpha", members: [] } };
  assert.throws(() => createGroup(before, { id: "beta", name: "  Alpha  " }), /group name Alpha is already used by a group/);
  assert.throws(() => createGroup(before, { id: "beta", name: "Alpha" }), /group name Alpha is already used by a group/);
  assert.deepEqual(before, { alpha: { name: "Alpha", members: [] } });
  assert.deepEqual(createGroup(before, { id: "beta", name: "alpha" }).beta, { name: "alpha", members: [] });
});

test("parseGroups accepts an empty object and refuses a list or a group without a name or members", () => {
  assert.deepEqual(parseGroups({}), {});
  assert.throws(() => parseGroups([]), /groups data is not an object/);
  assert.throws(() => parseGroups({ a: { members: [] } }), /group a has no name/);
  assert.throws(() => parseGroups({ a: { name: "A" } }), /group a has no members list/);
});

test("groupRows lists each group in the code point order of its identifier", () => {
  const groups = { beta: { name: "B", members: [] }, alpha: { name: "A", members: ["x"] } };
  assert.deepEqual(groupRows(groups), [
    { id: "alpha", name: "A", count: 1 },
    { id: "beta", name: "B", count: 0 },
  ]);
});
