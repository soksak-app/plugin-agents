// Checks the paths of the tree library for the agents sections (A29-2, A30): a row shows its name, rows of one name among siblings
// carry #1, #2 in their order, and a folder path ends with `/`.
import assert from "node:assert/strict";
import test from "node:test";
import { definitionNodes, iconProgram, runningNodes, treePaths } from "../ui/tree-paths.js";

test("treePaths numbers ten rows of one name #1 to #10, so they are ten paths", () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({ kind: "session", id: `s${index}`, name: "claude manager-lead", activity: null, program: null }));
  const { paths, items } = treePaths(runningNodes([{ kind: "card", id: "c1", name: "터미널", children: rows }]));
  assert.deepEqual(paths, ["터미널/", ...rows.map((_, index) => `터미널/claude manager-lead #${index + 1}`)]);
  assert.equal(items.get("터미널/claude manager-lead #4"), rows[3]);
});

test("treePaths keeps a name that does not repeat, names a card by its name and numbers cards of one name in a group, and shows the last name of a program path", () => {
  const tab = (id, name) => ({ kind: "tab", id, name, activity: null, program: null });
  const tree = [{ kind: "group", id: "g1", name: "Team", children: [
    { kind: "card", id: "c3", name: "터미널 · Claude Code", children: [tab("t3", "claude manager-lead"), tab("t4", "/usr/local/bin/codex"), tab("t5", "claude")] },
    { kind: "card", id: "c4", name: "터미널 · Claude Code", children: [tab("t6", "claude")] },
  ] }];
  assert.deepEqual(treePaths(runningNodes(tree)).paths, ["Team/", "Team/터미널 · Claude Code #1/", "Team/터미널 · Claude Code #1/claude manager-lead",
    "Team/터미널 · Claude Code #1/codex", "Team/터미널 · Claude Code #1/claude", "Team/터미널 · Claude Code #2/", "Team/터미널 · Claude Code #2/claude"]);
});

test("treePaths lists each definition group with its members by their identifiers", () => {
  const rows = [{ id: "moai", name: "MoAI", members: [{ id: "moai-backend", defined: true, text: "x" }, { id: "moai-lead", defined: false }] }];
  const { paths, items } = treePaths(definitionNodes(rows));
  assert.deepEqual(paths, ["MoAI/", "MoAI/moai-backend", "MoAI/moai-lead"]);
  assert.deepEqual(items.get("MoAI/moai-lead"), { group: "moai", member: rows[0].members[1] });
});

test("treePaths refuses a row without a name", () => {
  assert.throws(() => treePaths([{ label: "bin/", value: 1 }]), /a tree row has no name/);
});

// A32: a row of a known agent CLI shows the icon of its program. The name of a row starts with its program, a path or a name, and
// claude-code is the name that Claude Code reports as its app; a row of another program has no icon of its own.
test("iconProgram gives the known program that a row name starts with, and null for another program", () => {
  const known = ["claude", "codex", "gemini"];
  assert.equal(iconProgram("claude moai-manager-lead", known), "claude");
  assert.equal(iconProgram("claude-code", known), "claude");
  assert.equal(iconProgram("/usr/local/bin/codex #2", known), "codex");
  assert.equal(iconProgram("codex claude-reviewer", known), "codex");
  assert.equal(iconProgram("Gemini", known), "gemini");
  assert.equal(iconProgram("aider", known), null);
});
