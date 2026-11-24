// Checks the listing and the write of a maker group (A17-3 and A17-4, docs/spec/makers.md#listing and docs/spec/makers.md#writing).
// listGroup stores the records of the group and takes no sidecar, so a listing writes no file; writeGroup checks every file, writes
// the folders and files through the sidecar requests of ui/makers-files.js, and defines each role with core.role.define. The sidecar is
// the in-memory fake of test/fixtures/files-sidecar.mjs; core.role.define is a recorder.
import assert from "node:assert/strict";
import test from "node:test";
import { listGroup, storedChanges, writeGroup } from "../ui/makers-import.js";
import { connect, fakeSidecar } from "./fixtures/files-sidecar.mjs";

const group = (overrides = {}) => ({
  id: "moai",
  name: "MoAI",
  plugin: "moai-plugin",
  clis: ["claude"],
  agents: [{ name: "Backend Expert", path: ".moai/agents/backend.md", cli: "claude", port: 4100, model: "opus" }],
  skills: [".moai/skills/plan/"],
  variables: {},
  path: [],
  folders: [".moai/"],
  rules: ["Plans go to .moai/plans/."],
  files: [{ path: ".moai/agents/backend.md", text: "# Backend\n" }],
  ...overrides,
});

const EMPTY = { groups: {}, definitions: {}, accounts: [] };

// The core.role.define recorder: each call is kept, and a refusal is thrown for an identifier in refuse.
function roleRecorder(refuse = new Set()) {
  const calls = [];
  const define = (params) => {
    calls.push(params);
    if (refuse.has(params.id)) return Promise.reject(new Error(`role ${params.id} is used by tab t1`));
    return Promise.resolve({ id: params.id });
  };
  return { calls, define };
}

const DATA = "/config/plugin-data/agents";
const WRITES = ["createFolder", "write"];

test("listGroup stores the account, the definitions with their maker and the group record, and takes no sidecar", () => {
  const stored = listGroup({ group: group(), stored: EMPTY, plugin: "terminal", root: "/work/project", dataFolder: DATA });
  assert.deepEqual(stored.groups, { moai: { name: "MoAI", members: ["moai-backend-expert"] } });
  assert.deepEqual(stored.definitions, { "moai-backend-expert": { name: "Backend Expert", account: "claude", plugin: "terminal", role: "moai-backend-expert", cwd: "/work/project", maker: "moai" } });
  assert.deepEqual(stored.accounts, [{ id: "claude", cli: "claude", args: [], env: [], home: { variable: "CLAUDE_CONFIG_DIR", folder: `${DATA}/accounts/claude` } }]);
});

test("a listing of a group refuses before it stores any value when the group or the project root is refused", () => {
  const empty = group({ agents: [{ name: "!!!", path: ".moai/agents/backend.md", cli: "claude" }] });
  assert.throws(() => listGroup({ group: empty, stored: EMPTY, plugin: "terminal", root: "/work/project", dataFolder: DATA }), /agent !!! has an empty identifier slug/);
  assert.throws(() => listGroup({ group: group(), stored: EMPTY, plugin: "terminal", root: "work/project", dataFolder: DATA }), /project root must be an absolute path/);
});

test("a second listing of an equal group stores equal values, and keeps a definition that the person added to the group", () => {
  const first = listGroup({ group: group(), stored: EMPTY, plugin: "terminal", root: "/work/project", dataFolder: DATA });
  assert.deepEqual(storedChanges(first, listGroup({ group: group(), stored: first, plugin: "terminal", root: "/work/project", dataFolder: DATA })), []);
  const mine = { name: "Mine", account: "claude", plugin: "terminal", role: "mine", cwd: "/work/project" };
  const stored = { groups: { moai: { name: "MoAI", members: ["mine"] } }, definitions: { mine }, accounts: [] };
  const again = listGroup({ group: group(), stored, plugin: "terminal", root: "/work/project", dataFolder: DATA });
  assert.deepEqual(again.groups.moai.members, ["mine", "moai-backend-expert"]);
  assert.deepEqual(again.definitions.mine, mine);
});

test("storedChanges names only the project keys whose stored value a listing changes, and an equal listing names none", () => {
  const first = listGroup({ group: group(), stored: EMPTY, plugin: "terminal", root: "/work/project", dataFolder: DATA });
  assert.deepEqual(storedChanges(EMPTY, first), ["groups", "definitions", "accounts"]);
  assert.deepEqual(storedChanges(first, { ...first, groups: { moai: { name: "Renamed", members: ["moai-backend-expert"] } } }), ["groups"]);
});

test("writeGroup writes the files, defines each role with absolute file paths and returns the paths it wrote", async () => {
  const sidecar = fakeSidecar();
  const roles = roleRecorder();
  const result = await writeGroup({ group: group(), root: "/work/project", requests: connect(sidecar), define: roles.define });
  assert.equal(sidecar.files.get(".moai/agents/backend.md"), "# Backend\n");
  assert.deepEqual(result, { written: [".moai/agents/backend.md"] });
  assert.deepEqual(roles.calls, [{
    id: "moai-backend-expert",
    text: "Follow the definition in .moai/agents/backend.md.",
    ko: ".moai/agents/backend.md 파일의 정의를 따른다.",
    files: ["/work/project/.moai/agents/backend.md"],
  }]);
});

test("writeGroup refuses a file that holds other content before any write, naming the group and the path", async () => {
  const sidecar = fakeSidecar();
  sidecar.folders.add(".moai");
  sidecar.folders.add(".moai/agents");
  sidecar.files.set(".moai/agents/backend.md", "# Mine\n");
  const roles = roleRecorder();
  await assert.rejects(writeGroup({ group: group(), root: "/work/project", requests: connect(sidecar), define: roles.define }), /maker moai: \.moai\/agents\/backend\.md holds other content/);
  assert.equal(sidecar.log.some((body) => WRITES.includes(body.operation)), false);
  assert.equal(sidecar.files.get(".moai/agents/backend.md"), "# Mine\n");
  assert.equal(roles.calls.length, 0);
});

test("writeGroup checks every file before its first write, so a later file that holds other content refuses the whole write", async () => {
  const sidecar = fakeSidecar();
  sidecar.folders.add(".moai");
  sidecar.folders.add(".moai/skills");
  sidecar.folders.add(".moai/skills/plan");
  sidecar.files.set(".moai/skills/plan/SKILL.md", "other\n");
  const two = group({ files: [{ path: ".moai/agents/backend.md", text: "# Backend\n" }, { path: ".moai/skills/plan/SKILL.md", text: "plan\n" }] });
  await assert.rejects(writeGroup({ group: two, root: "/work/project", requests: connect(sidecar), define: roleRecorder().define }), /maker moai: \.moai\/skills\/plan\/SKILL\.md holds other content/);
  assert.equal(sidecar.log.some((body) => WRITES.includes(body.operation)), false);
  assert.equal(sidecar.files.has(".moai/agents/backend.md"), false);
});

test("writeGroup writes nothing and lists nothing for an equal file, and a second write of an equal group returns no paths", async () => {
  const sidecar = fakeSidecar();
  const requests = connect(sidecar);
  const roles = roleRecorder();
  await writeGroup({ group: group(), root: "/work/project", requests, define: roles.define });
  sidecar.log.length = 0;
  roles.calls.length = 0;
  const second = await writeGroup({ group: group(), root: "/work/project", requests, define: roles.define });
  assert.deepEqual(second, { written: [] });
  assert.equal(sidecar.log.some((body) => body.operation === "write"), false);
  assert.equal(roles.calls.length, 1);
});

test("writeGroup lists an executable file that it writes again with its current text", async () => {
  const sidecar = fakeSidecar();
  const requests = connect(sidecar);
  await writeGroup({ group: group(), root: "/work/project", requests, define: roleRecorder().define });
  const executable = group({ files: [{ path: ".moai/agents/backend.md", text: "# Backend\n", executable: true }] });
  assert.deepEqual(await writeGroup({ group: executable, root: "/work/project", requests, define: roleRecorder().define }), { written: [".moai/agents/backend.md"] });
  assert.equal(sidecar.modes.get(".moai/agents/backend.md"), "0755");
  assert.equal(sidecar.files.get(".moai/agents/backend.md"), "# Backend\n");
});

test("writeGroup stops with the text of a refused role definition, and the files it wrote stay", async () => {
  const sidecar = fakeSidecar();
  const roles = roleRecorder(new Set(["moai-backend-expert"]));
  await assert.rejects(writeGroup({ group: group(), root: "/work/project", requests: connect(sidecar), define: roles.define }), /role moai-backend-expert is used by tab t1/);
  assert.equal(sidecar.files.get(".moai/agents/backend.md"), "# Backend\n");
});

test("writeGroup refuses a project root that is not absolute before any request", async () => {
  const sidecar = fakeSidecar();
  await assert.rejects(writeGroup({ group: group(), root: "work/project", requests: connect(sidecar), define: roleRecorder().define }), /project root must be an absolute path/);
  assert.equal(sidecar.log.length, 0);
});
