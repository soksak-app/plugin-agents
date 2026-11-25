// The leader of a group (A54, docs/spec/definitions.md#leader): each group has exactly one leader among its members, which a room of
// the group sends a message without a mention to. The rules are those of ui/groups.js and ui/roles.js.
import assert from "node:assert/strict";
import test from "node:test";
import { createGroup, parseGroups } from "../ui/groups.js";
import { addMember, removeMember, roleRows, setLeader } from "../ui/roles.js";
import { definitionIcon, definitionNodes, treePaths } from "../ui/tree-paths.js";

test("parseGroups refuses a group of the earlier form without a leader, a leader outside the members and a null leader of a group with members", () => {
  assert.throws(() => parseGroups({ moai: { name: "MoAI", members: ["a"] } }), /group moai must be \{name, members, leader\}, got \{"name":"MoAI","members":\["a"\]\}/);
  assert.throws(() => parseGroups({ moai: { name: "MoAI", members: ["a"], leader: "b" } }), /group moai has the leader b, which is not a member/);
  assert.throws(() => parseGroups({ moai: { name: "MoAI", members: ["a"], leader: null } }), /group moai has members and no leader/);
  assert.throws(() => parseGroups({ moai: { name: "MoAI", members: [], leader: "a" } }), /group moai has the leader a, which is not a member/);
  assert.deepEqual(parseGroups({ moai: { name: "MoAI", members: [], leader: null } }), { moai: { name: "MoAI", members: [], leader: null } });
});

test("createGroup stores an empty group without a leader", () => {
  assert.deepEqual(createGroup({}, { id: "alpha", name: "Alpha" }), { alpha: { name: "Alpha", members: [], leader: null } });
});

test("the first member that a group receives becomes its leader, and a later member leaves the leader", () => {
  const one = addMember({ alpha: { name: "Alpha", members: [], leader: null } }, "alpha", "a");
  assert.deepEqual(one.alpha, { name: "Alpha", members: ["a"], leader: "a" });
  assert.deepEqual(addMember(one, "alpha", "b").alpha, { name: "Alpha", members: ["a", "b"], leader: "a" });
});

test("the removal of the leader makes the first remaining member the leader, and the removal of the last member leaves no leader", () => {
  const groups = { alpha: { name: "Alpha", members: ["a", "b", "c"], leader: "b" } };
  assert.deepEqual(removeMember(groups, "alpha", "b").alpha, { name: "Alpha", members: ["a", "c"], leader: "a" });
  assert.deepEqual(removeMember(groups, "alpha", "c").alpha, { name: "Alpha", members: ["a", "b"], leader: "b" });
  assert.deepEqual(removeMember({ alpha: { name: "Alpha", members: ["a"], leader: "a" } }, "alpha", "a").alpha, { name: "Alpha", members: [], leader: null });
});

test("setLeader makes a member the leader, is idempotent, keeps the input unchanged and refuses a missing group or a non-member", () => {
  const groups = { alpha: { name: "Alpha", members: ["a", "b"], leader: "a" } };
  const after = setLeader(groups, "alpha", "b");
  assert.deepEqual(after.alpha, { name: "Alpha", members: ["a", "b"], leader: "b" });
  assert.deepEqual(setLeader(after, "alpha", "b"), after);
  assert.equal(groups.alpha.leader, "a");
  assert.throws(() => setLeader(groups, "missing", "a"), /group missing is not defined/);
  assert.throws(() => setLeader(groups, "alpha", "z"), /role z is not a member of group alpha/);
});

test("a row of the leader carries the star icon, and every other row the icon of its program or the robot", () => {
  const rows = roleRows({ alpha: { name: "Alpha", members: ["a", "b"], leader: "b" } }, { seq: 0, roles: [] });
  assert.equal(rows[0].leader, "b");
  const { items } = treePaths(definitionNodes(rows));
  assert.deepEqual([...items.values()].map((value) => [value.member.id, value.leader, definitionIcon(value)]), [["a", false, null], ["b", true, "leader"]]);
});
