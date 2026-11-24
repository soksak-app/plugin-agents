// Checks the listing of a maker group (A17-3, A35, A37, docs/spec/makers.md#listing). listGroup plans the stored records and the roles of
// the group and writes no file into the project.
import assert from "node:assert/strict";
import test from "node:test";
import { listGroup, storedChanges } from "../ui/makers-import.js";

const group = (overrides = {}) => ({
  id: "moai",
  name: "MoAI",
  plugin: "plugin",
  clis: ["claude"],
  agents: [{ name: "Backend Expert", path: ".claude/agents/backend.md", cli: "claude", port: 4100, model: "opus" }],
  variables: {},
  folders: [".moai/"],
  rules: ["Plans go to .moai/plans/."],
  ...overrides,
});

const EMPTY = { groups: {}, definitions: {}, accounts: [] };

const DATA = "/config/plugin-data/agents";

test("listGroup stores the account, the definitions with their maker and launch and the group record, and plans the roles", () => {
  const stored = listGroup({ group: group(), stored: EMPTY, folder: "/config/plugins/moai/0.0.6", personHome: null, plugin: "terminal", root: "/work/project", dataFolder: DATA });
  assert.deepEqual(stored.groups, { moai: { name: "MoAI", members: ["moai-backend-expert"] } });
  assert.deepEqual(stored.definitions, { "moai-backend-expert": { name: "Backend Expert", account: "claude", plugin: "terminal", role: "moai-backend-expert", cwd: "/work/project", maker: "moai", launch: { args: ["--plugin-dir", "/config/plugins/moai/0.0.6/plugin", "--add-dir", "/config/plugins/moai/0.0.6/plugin"], env: {} } } });
  assert.deepEqual(stored.roles.map((role) => role.files), [["/config/plugins/moai/0.0.6/plugin/.claude/agents/backend.md"]]);
  assert.deepEqual(stored.accounts, [{ id: "claude", cli: "claude", args: [], env: [], home: { variable: "CLAUDE_CONFIG_DIR", folder: `${DATA}/accounts/claude` } }]);
});

test("a listing of a group refuses before it stores any value when the group or the project root is refused", () => {
  const empty = group({ agents: [{ name: "!!!", path: ".claude/agents/backend.md", cli: "claude" }] });
  assert.throws(() => listGroup({ group: empty, stored: EMPTY, folder: "/config/plugins/moai/0.0.6", personHome: null, plugin: "terminal", root: "/work/project", dataFolder: DATA }), /agent !!! has an empty identifier slug/);
  assert.throws(() => listGroup({ group: group(), stored: EMPTY, folder: "/config/plugins/moai/0.0.6", personHome: null, plugin: "terminal", root: "work/project", dataFolder: DATA }), /project root must be an absolute path/);
});

test("a second listing of an equal group stores equal values, and keeps a definition that the person added to the group", () => {
  const first = listGroup({ group: group(), stored: EMPTY, folder: "/config/plugins/moai/0.0.6", personHome: null, plugin: "terminal", root: "/work/project", dataFolder: DATA });
  assert.deepEqual(storedChanges(first, listGroup({ group: group(), stored: first, folder: "/config/plugins/moai/0.0.6", personHome: null, plugin: "terminal", root: "/work/project", dataFolder: DATA })), []);
  const mine = { name: "Mine", account: "claude", plugin: "terminal", role: "mine", cwd: "/work/project" };
  const stored = { groups: { moai: { name: "MoAI", members: ["mine"] } }, definitions: { mine }, accounts: [] };
  const again = listGroup({ group: group(), stored, folder: "/config/plugins/moai/0.0.6", personHome: null, plugin: "terminal", root: "/work/project", dataFolder: DATA });
  assert.deepEqual(again.groups.moai.members, ["mine", "moai-backend-expert"]);
  assert.deepEqual(again.definitions.mine, mine);
});

test("storedChanges names only the project keys whose stored value a listing changes, and an equal listing names none", () => {
  const first = listGroup({ group: group(), stored: EMPTY, folder: "/config/plugins/moai/0.0.6", personHome: null, plugin: "terminal", root: "/work/project", dataFolder: DATA });
  assert.deepEqual(storedChanges(EMPTY, first), ["groups", "definitions", "accounts"]);
  assert.deepEqual(storedChanges(first, { ...first, groups: { moai: { name: "Renamed", members: ["moai-backend-expert"] } } }), ["groups"]);
});
