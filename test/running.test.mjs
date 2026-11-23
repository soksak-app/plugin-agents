// Checks the tree of the running agents section (A3): the group, card and tab tree of core.grid, with the agent tabs of the
// terminal plugin (a tab whose params name a program) and the activity of each tab from core.activity.
import assert from "node:assert/strict";
import test from "node:test";
import { runningTree } from "../ui/running.js";

const tab = (id, params, plugin = "terminal") => ({ tab: id, plugin, title: id, active: false, params, label: null, notice: null, footer: null, modified: false, error: null, program: null });

const grid = {
  cards: [
    { id: "c1", parent: null, x: 0, y: 0, w: 100, h: 100, leader: true, tabs: [tab("t1", { program: "claude", role: "builder" }), tab("t0", null)] },
    { id: "c2", parent: "g1", x: 120, y: 40, w: 50, h: 50, leader: false, tabs: [tab("t2", null)] },
    { id: "c3", parent: "g1", x: 180, y: 40, w: 50, h: 50, leader: true, tabs: [tab("t3", { program: "codex" }), tab("t4", { program: "codex" }, "editor")] },
  ],
  groups: [{ id: "g1", parent: null, x: 110, y: 0, w: 130, h: 100, leader: false, group: { name: "Team", level: 1, leader: "c3" } }],
};

test("runningTree lists the agent tabs under their cards and groups, in drawn order, names a card by the titles of its tabs, and gives the activity of each tab", () => {
  assert.deepEqual(runningTree(grid, { t1: "running", t3: "idle" }, []), [
    { kind: "card", id: "c1", name: "t1 · t0", children: [{ kind: "tab", id: "t1", name: "claude builder", activity: "running", program: null }] },
    { kind: "group", id: "g1", name: "Team", children: [
      { kind: "card", id: "c3", name: "t3 · t4", children: [
        { kind: "tab", id: "t3", name: "codex", activity: "idle", program: null },
        { kind: "tab", id: "t4", name: "codex", activity: null, program: null },
      ] },
    ] },
  ]);
});

test("runningTree counts a tab of any plugin whose params name a program, and leaves out a terminal tab without one", () => {
  const tree = runningTree({
    cards: [{ id: "c9", parent: null, x: 0, y: 0, w: 1, h: 1, leader: true, tabs: [tab("p1", { program: "gemini" }, "other-plugin"), tab("p2", null, "terminal")] }],
    groups: [],
  }, {}, []);
  assert.deepEqual(tree, [{ kind: "card", id: "c9", name: "p1 · p2", children: [{ kind: "tab", id: "p1", name: "gemini", activity: null, program: null }] }]);
});

test("runningTree gives a tab with no activity entry the activity null and leaves out cards and groups without agent tabs", () => {
  const tree = runningTree(grid, {}, []);
  assert.equal(tree[0].children[0].activity, null);
  assert.equal(tree.some((node) => node.id === "c2"), false);
});

test("runningTree refuses a grid without the cards and groups lists, and an activity that is not an activity", () => {
  assert.throws(() => runningTree({ cards: [] }, {}, []), /core.grid has no groups list/);
  assert.throws(() => runningTree(grid, { t1: "busy" }, []), /activity busy of tab t1 is not one of attention, failed, running, idle/);
});

test("runningTree gives each agent tab its program state from core.grid, or null when the tab has none", () => {
  const withProgram = (id, params, program) => ({ ...tab(id, params), program });
  const tree = runningTree({
    cards: [{ id: "c5", parent: null, x: 0, y: 0, w: 1, h: 1, leader: true, tabs: [
      withProgram("a1", { program: "claude" }, { state: "working", pid: 4242, app: "claude-code" }),
      withProgram("a2", { program: "codex" }, { state: "blocked", pid: null, app: null }),
      withProgram("a3", { program: "gemini" }, null),
    ] }],
    groups: [],
  }, {}, []);
  assert.deepEqual(tree[0].children.map((row) => row.program), [{ state: "working", pid: 4242, app: "claude-code" }, { state: "blocked", pid: null, app: null }, null]);
});

test("runningTree refuses a program value that is not null or an object with state idle, working or blocked and pid", () => {
  const broken = { cards: [{ id: "c6", parent: null, x: 0, y: 0, w: 1, h: 1, leader: true, tabs: [{ ...tab("b1", { program: "claude" }), program: { state: "busy", pid: 1, app: null } }] }], groups: [] };
  assert.throws(() => runningTree(broken, {}, []), /program of tab b1 must be null or an object with state idle, working or blocked, pid an integer or null and app a text or null/);
  const noApp = { cards: [{ id: "c6", parent: null, x: 0, y: 0, w: 1, h: 1, leader: true, tabs: [{ ...tab("b1", null), program: { state: "idle", pid: 1 } }] }], groups: [] };
  assert.throws(() => runningTree(noApp, {}, []), /program of tab b1 must be null or an object with state idle, working or blocked, pid an integer or null and app a text or null/);
});

// A29: each running agent CLI is one row named by its program and, when it runs with a role, the role after it; an owned session
// that the clubhouse opened is a row of the card of its owner tab, and a tab that shows a session takes the name of that session.
test("runningTree names a row by its program and role, and lists ten sessions of one program as ten rows", () => {
  const sessions = Array.from({ length: 10 }, (_, index) => ({ session: `s${index}`, plugin: "terminal", owner: "room", shownBy: null,
    program: null, params: { program: "claude" } }));
  const tree = runningTree({
    cards: [{ id: "c1", parent: null, x: 0, y: 0, w: 1, h: 1, leader: true, tabs: [tab("room", null, "clubhouse"), tab("t1", { program: "codex" })] }],
    groups: [],
  }, {}, sessions);
  const rows = tree[0].children;
  assert.equal(rows.length, 11);
  assert.deepEqual(rows[0], { kind: "tab", id: "t1", name: "codex", activity: null, program: null });
  assert.deepEqual(rows.slice(1).map((row) => [row.kind, row.id, row.name]), sessions.map((one) => ["session", one.session, "claude"]));
});

test("runningTree names an owned session with a role, shows its program state, and names a tab that shows a session by that session", () => {
  const sessions = [
    { session: "lead", plugin: "terminal", owner: "room", shownBy: null, program: { state: "working" }, params: { program: "claude", role: "manager-lead" } },
    { session: "dev", plugin: "terminal", owner: "room", shownBy: "t9", program: null, params: { program: "codex", role: "dev" } },
    { session: "shell", plugin: "terminal", owner: "room", shownBy: null, program: null, params: null },
  ];
  const tree = runningTree({
    cards: [
      { id: "c1", parent: null, x: 0, y: 0, w: 1, h: 1, leader: true, tabs: [tab("room", null, "clubhouse")] },
      { id: "c2", parent: null, x: 0, y: 10, w: 1, h: 1, leader: false, tabs: [tab("t9", { session: "dev" })] },
    ],
    groups: [],
  }, { t9: "running" }, sessions);
  assert.deepEqual(tree, [
    { kind: "card", id: "c1", name: "room", children: [{ kind: "session", id: "lead", name: "claude manager-lead", activity: null, program: { state: "working", pid: null } }] },
    { kind: "card", id: "c2", name: "t9", children: [{ kind: "tab", id: "t9", name: "codex dev", activity: "running", program: null }] },
  ]);
});

test("runningTree refuses a sessions value that is not a list", () => {
  assert.throws(() => runningTree(grid, {}, {}), /core.sessions is not a list/);
});

// A29-3: a known agent CLI that a person started in a shell has no params of a program; its tab is a row named by the app of its program
// state, in its card and group, and a tab whose program state names no app stays out.
test("runningTree lists a tab whose program state names its app, as a CLI started in a shell, under its card and group", () => {
  const shell = (id, app) => ({ ...tab(id, null), program: { state: "idle", pid: 7, app } });
  const tree = runningTree({
    cards: [
      { id: "c1", parent: null, x: 0, y: 0, w: 1, h: 1, leader: true, tabs: [shell("a", "claude-code"), shell("b", null), tab("c", null)] },
      { id: "c2", parent: "g1", x: 0, y: 10, w: 1, h: 1, leader: true, tabs: [shell("d", "codex"), shell("e", "codex")] },
    ],
    groups: [{ id: "g1", parent: null, x: 0, y: 10, w: 1, h: 1, leader: false, group: { name: "Team", level: 1, leader: "c2" } }],
  }, {}, []);
  const program = (app) => ({ state: "idle", pid: 7, app });
  assert.deepEqual(tree, [
    { kind: "card", id: "c1", name: "a · b · c", children: [{ kind: "tab", id: "a", name: "claude-code", activity: null, program: program("claude-code") }] },
    { kind: "group", id: "g1", name: "Team", children: [{ kind: "card", id: "c2", name: "d · e", children: [
      { kind: "tab", id: "d", name: "codex", activity: null, program: program("codex") },
      { kind: "tab", id: "e", name: "codex", activity: null, program: program("codex") },
    ] }] },
  ]);
});
