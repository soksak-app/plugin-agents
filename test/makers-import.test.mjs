// Checks the import of a maker group (A17-3 and A17-4, docs/spec/makers.md#import): importGroup plans the record with ui/makers.js, writes
// the files through the sidecar requests of ui/makers-files.js, and defines each role with core.role.define before it returns the stored
// values. The sidecar is the in-memory fake of test/fixtures/files-sidecar.mjs; core.role.define is a recorder.
import assert from "node:assert/strict";
import test from "node:test";
import { importGroup, storedChanges } from "../ui/makers-import.js";
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

test("importGroup writes the files, defines each role with absolute file paths and returns the stored values", async () => {
  const sidecar = fakeSidecar();
  const roles = roleRecorder();
  const stored = await importGroup({ group: group(), stored: EMPTY, plugin: "terminal", root: "/work/project", requests: connect(sidecar), define: roles.define });
  assert.equal(sidecar.files.get(".moai/agents/backend.md"), "# Backend\n");
  assert.deepEqual(roles.calls, [{
    id: "moai-backend-expert",
    text: "Follow the definition in .moai/agents/backend.md.",
    ko: ".moai/agents/backend.md 파일의 정의를 따른다.",
    files: ["/work/project/.moai/agents/backend.md"],
  }]);
  assert.deepEqual(stored.groups, { moai: { name: "MoAI", members: ["moai-backend-expert"] } });
  assert.deepEqual(stored.definitions, { "moai-backend-expert": { name: "Backend Expert", account: "claude", plugin: "terminal", role: "moai-backend-expert", cwd: "/work/project" } });
  assert.deepEqual(stored.accounts, [{ id: "claude", cli: "claude", args: [], env: [] }]);
});

test("importGroup refuses before any write when the plan fails, and when the project root is not absolute", async () => {
  const sidecar = fakeSidecar();
  const roles = roleRecorder();
  const empty = group({ agents: [{ name: "!!!", path: ".moai/agents/backend.md", cli: "claude" }] });
  await assert.rejects(importGroup({ group: empty, stored: EMPTY, plugin: "terminal", root: "/work/project", requests: connect(sidecar), define: roles.define }), /agent !!! has an empty identifier slug/);
  await assert.rejects(importGroup({ group: group(), stored: EMPTY, plugin: "terminal", root: "work/project", requests: connect(sidecar), define: roles.define }), /project root must be an absolute path/);
  assert.equal(sidecar.log.length, 0);
  assert.equal(roles.calls.length, 0);
});

test("importGroup stops with the text of a refused role definition and returns no stored values", async () => {
  const sidecar = fakeSidecar();
  const roles = roleRecorder(new Set(["moai-backend-expert"]));
  await assert.rejects(importGroup({ group: group(), stored: EMPTY, plugin: "terminal", root: "/work/project", requests: connect(sidecar), define: roles.define }), /role moai-backend-expert is used by tab t1/);
});

test("a second import of an equal group writes no file, defines the same roles and returns the same stored values", async () => {
  const sidecar = fakeSidecar();
  const roles = roleRecorder();
  const requests = connect(sidecar);
  const first = await importGroup({ group: group(), stored: EMPTY, plugin: "terminal", root: "/work/project", requests, define: roles.define });
  sidecar.log.length = 0;
  roles.calls.length = 0;
  const second = await importGroup({ group: group(), stored: first, plugin: "terminal", root: "/work/project", requests, define: roles.define });
  // createFolder is idempotent and runs again; only a write would change a file.
  assert.equal(sidecar.log.some((body) => body.operation === "write"), false);
  assert.deepEqual(roles.calls, [{
    id: "moai-backend-expert",
    text: "Follow the definition in .moai/agents/backend.md.",
    ko: ".moai/agents/backend.md 파일의 정의를 따른다.",
    files: ["/work/project/.moai/agents/backend.md"],
  }]);
  assert.deepEqual(second, first);
});

test("a second import with a changed file writes that file, and keeps a definition that the person added to the group", async () => {
  const sidecar = fakeSidecar();
  const roles = roleRecorder();
  const requests = connect(sidecar);
  const mine = { name: "Mine", account: "claude", plugin: "terminal", role: "mine", cwd: "/work/project" };
  const stored = { groups: { moai: { name: "MoAI", members: ["mine"] } }, definitions: { mine }, accounts: [] };
  const again = await importGroup({ group: group({ files: [{ path: ".moai/agents/backend.md", text: "# Backend v2\n" }] }), stored, plugin: "terminal", root: "/work/project", requests, define: roles.define });
  assert.equal(sidecar.files.get(".moai/agents/backend.md"), "# Backend v2\n");
  assert.deepEqual(again.groups.moai.members, ["mine", "moai-backend-expert"]);
  assert.deepEqual(again.definitions.mine, mine);
});

test("storedChanges names only the project keys whose stored value an import changes, and an equal import names none", async () => {
  const sidecar = fakeSidecar();
  const roles = roleRecorder();
  const first = await importGroup({ group: group(), stored: EMPTY, plugin: "terminal", root: "/work/project", requests: connect(sidecar), define: roles.define });
  assert.deepEqual(storedChanges(EMPTY, first), ["groups", "definitions", "accounts"]);
  const again = await importGroup({ group: group(), stored: first, plugin: "terminal", root: "/work/project", requests: connect(sidecar), define: roles.define });
  assert.deepEqual(storedChanges(first, again), []);
  assert.deepEqual(storedChanges(first, { ...again, groups: { moai: { name: "Renamed", members: ["moai-backend-expert"] } } }), ["groups"]);
});
