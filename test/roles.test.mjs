// Checks the definitions of the agents section (A5): a definition is a role that belongs to one group. The group members hold
// identifiers only; the text, the Korean text and the files come from the status core.roles. The rules are those of ui/roles.js.
import assert from "node:assert/strict";
import test from "node:test";
import { addMember, parseFiles, removeMember, roleRows } from "../ui/roles.js";

test("parseFiles returns the paths of the lines in order, trimmed, and skips blank lines", () => {
  assert.deepEqual(parseFiles("/a/one.md\n  /b/two.md  \n\n/c/three.md\n"), ["/a/one.md", "/b/two.md", "/c/three.md"]);
  assert.deepEqual(parseFiles(""), []);
});

test("parseFiles refuses a value that is not text", () => {
  assert.throws(() => parseFiles(["/a/one.md"]), /files must be text/);
  assert.throws(() => parseFiles(null), /files must be text/);
});

test("addMember adds the identifier to the members of the group and keeps the input unchanged", () => {
  const before = { alpha: { name: "Alpha", members: [], leader: null }, beta: { name: "Beta", members: ["x"], leader: "x" } };
  const after = addMember(before, "alpha", "reviewer");
  assert.deepEqual(after.alpha, { name: "Alpha", members: ["reviewer"], leader: "reviewer" });
  assert.deepEqual(after.beta, { name: "Beta", members: ["x"], leader: "x" });
  assert.deepEqual(before.alpha, { name: "Alpha", members: [], leader: null });
});

test("addMember adds an identifier that the group already holds once, and refuses one that another group holds", () => {
  const groups = { alpha: { name: "Alpha", members: ["reviewer"], leader: "reviewer" }, beta: { name: "Beta", members: [], leader: null } };
  assert.deepEqual(addMember(groups, "alpha", "reviewer").alpha.members, ["reviewer"]);
  assert.throws(() => addMember(groups, "beta", "reviewer"), /role reviewer is already in group alpha/);
});

test("addMember refuses a group that the project does not define", () => {
  assert.throws(() => addMember({}, "missing", "reviewer"), /group missing is not defined/);
});

test("removeMember removes the identifier from the members of the named group only", () => {
  const groups = { alpha: { name: "Alpha", members: ["reviewer", "writer"], leader: "reviewer" }, beta: { name: "Beta", members: [], leader: null } };
  assert.deepEqual(removeMember(groups, "alpha", "reviewer"), { alpha: { name: "Alpha", members: ["writer"], leader: "writer" }, beta: { name: "Beta", members: [], leader: null } });
  assert.deepEqual(groups.alpha.members, ["reviewer", "writer"]);
});

test("removeMember refuses a group that is not defined and an identifier that the group does not hold", () => {
  const groups = { alpha: { name: "Alpha", members: [], leader: null } };
  assert.throws(() => removeMember(groups, "missing", "reviewer"), /group missing is not defined/);
  assert.throws(() => removeMember(groups, "alpha", "reviewer"), /role reviewer is not a member of group alpha/);
});

test("roleRows lists the groups in identifier order with each member's text, Korean text and files from core.roles", () => {
  const groups = { beta: { name: "Beta", members: [], leader: null }, alpha: { name: "Alpha", members: ["reviewer"], leader: "reviewer" } };
  const roles = { seq: 3, roles: [{ id: "reviewer", text: "Review.", ko: "검토한다.", files: ["/a/checklist.md"] }] };
  assert.deepEqual(roleRows(groups, roles), [
    { id: "alpha", name: "Alpha", leader: "reviewer", members: [{ id: "reviewer", text: "Review.", ko: "검토한다.", files: ["/a/checklist.md"], defined: true }] },
    { id: "beta", name: "Beta", leader: null, members: [] },
  ]);
});

test("roleRows shows a member that core.roles does not define as not defined, and refuses a status of another form", () => {
  const groups = { alpha: { name: "Alpha", members: ["gone"], leader: "gone" } };
  assert.deepEqual(roleRows(groups, { seq: 0, roles: [] })[0].members, [{ id: "gone", text: null, ko: null, files: null, defined: false }]);
  assert.throws(() => roleRows(groups, { seq: 0 }), /core.roles has no roles list/);
  assert.throws(() => roleRows(groups, null), /core.roles is not an object/);
});
