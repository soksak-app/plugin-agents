// Checks the tree of the running agents section (A3): the group, card and tab tree of core.grid, with the agent tabs of the
// terminal plugin (a tab whose params name a program) and the activity of each tab from core.activity.
import assert from "node:assert/strict";
import test from "node:test";
import { runningTree } from "../ui/running.js";

const tab = (id, params, plugin = "terminal") => ({ tab: id, plugin, title: id, active: false, params, label: null, notice: null, footer: null, modified: false, error: null });

const grid = {
  cards: [
    { id: "c1", parent: null, x: 0, y: 0, w: 100, h: 100, leader: true, tabs: [tab("t1", { program: "claude", role: "builder" }), tab("t0", null)] },
    { id: "c2", parent: "g1", x: 120, y: 40, w: 50, h: 50, leader: false, tabs: [tab("t2", null)] },
    { id: "c3", parent: "g1", x: 180, y: 40, w: 50, h: 50, leader: true, tabs: [tab("t3", { program: "codex" }), tab("t4", { program: "codex" }, "editor")] },
  ],
  groups: [{ id: "g1", parent: null, x: 110, y: 0, w: 130, h: 100, leader: false, group: { name: "Team", level: 1, leader: "c3" } }],
};

test("runningTree lists the agent tabs under their cards and groups, in drawn order, with the activity of each tab", () => {
  assert.deepEqual(runningTree(grid, { t1: "running", t3: "idle" }), [
    { kind: "card", id: "c1", children: [{ kind: "tab", id: "t1", name: "builder", activity: "running" }] },
    { kind: "group", id: "g1", name: "Team", children: [
      { kind: "card", id: "c3", children: [{ kind: "tab", id: "t3", name: "codex", activity: "idle" }] },
    ] },
  ]);
});

test("runningTree gives a tab with no activity entry the activity null and leaves out cards and groups without agent tabs", () => {
  const tree = runningTree(grid, {});
  assert.equal(tree[0].children[0].activity, null);
  assert.equal(tree.some((node) => node.id === "c2"), false);
});

test("runningTree refuses a grid without the cards and groups lists, and an activity that is not an activity", () => {
  assert.throws(() => runningTree({ cards: [] }, {}), /core.grid has no groups list/);
  assert.throws(() => runningTree(grid, { t1: "busy" }), /activity busy of tab t1 is not one of attention, failed, running, idle/);
});
