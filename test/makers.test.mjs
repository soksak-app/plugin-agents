// Checks the maker group of a connected item (A17, docs/spec/makers.md): the group object, the identifiers of the agents, the account of
// each agent, the stored records of a listing (listRecords) and the folders, files and roles of a write (writePlan), with the rules of
// ui/makers.js.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MAKERS_POINT, agentSlug, definitionIdentifier, listRecords, parseMakerGroup, writePlan } from "../ui/makers.js";

const DATA = "/config/plugin-data/agents";
const group = (overrides = {}) => ({
  id: "moai",
  name: "MoAI",
  plugin: "moai-plugin",
  clis: ["claude"],
  agents: [{ name: "Backend Expert", path: ".moai/agents/backend.md", cli: "claude", port: 4100, model: "opus" }],
  skills: [".moai/skills/plan/"],
  variables: { HOME_DIR: "{home}" },
  path: [".moai/bin"],
  folders: [".moai/"],
  rules: ["Plans go to .moai/plans/."],
  files: [{ path: ".moai/agents/backend.md", text: "# Backend\n" }, { path: ".moai/skills/plan/SKILL.md", text: "plan\n" }],
  ...overrides,
});

test("agentSlug lowers the name, joins each run of other characters with one dash and trims the dashes", () => {
  assert.equal(agentSlug("Backend Expert"), "backend-expert");
  assert.equal(agentSlug("  QA / Reviewer!! v2 "), "qa-reviewer-v2");
  assert.equal(agentSlug("--x--"), "x");
  assert.equal(agentSlug("!!!"), "");
});

test("definitionIdentifier is the group id, a dash and the slug, cut to 64 characters, and refuses an empty slug naming the agent", () => {
  assert.equal(definitionIdentifier("moai", "Backend Expert"), "moai-backend-expert");
  assert.equal(definitionIdentifier("moai", "a".repeat(100)), `moai-${"a".repeat(59)}`);
  assert.throws(() => definitionIdentifier("moai", "!!!"), /agent !!! has an empty identifier slug/);
});

test("parseMakerGroup accepts the sample group and refuses a group whose id differs from the item", () => {
  assert.equal(parseMakerGroup(group(), "moai").id, "moai");
  assert.throws(() => parseMakerGroup(group(), "harness"), /group identifier moai differs from the item identifier harness/);
});

test("parseMakerGroup refuses a required member that is missing or of another type", () => {
  const { files, ...rest } = group();
  assert.throws(() => parseMakerGroup(rest, "moai"), /group moai must have the member files/);
  assert.throws(() => parseMakerGroup(group({ folders: "x/" }), "moai"), /group moai member folders must be a list of text/);
});

test("parseMakerGroup refuses a files path outside the folders, an unsafe path, a repeated path and an agent path that no file holds", () => {
  assert.throws(() => parseMakerGroup(group({ files: [{ path: "other/a.md", text: "a" }] }), "moai"), /file other\/a\.md is not inside a folder of folders/);
  assert.throws(() => parseMakerGroup(group({ files: [{ path: ".moai/../x.md", text: "a" }] }), "moai"), /file \.moai\/\.\.\/x\.md must be a relative path without \.\. segments/);
  assert.throws(() => parseMakerGroup(group({ files: [{ path: "/.moai/a.md", text: "a" }] }), "moai"), /must be a relative path/);
  assert.throws(() => parseMakerGroup(group({ files: [{ path: ".moai/a.md", text: "a" }, { path: ".moai/a.md", text: "b" }] }), "moai"), /file .moai\/a\.md repeats/);
  assert.throws(() => parseMakerGroup(group({ agents: [{ name: "X", path: ".moai/missing.md", cli: "claude" }] }), "moai"), /agent X path .moai\/missing\.md is not a path of files/);
});

test("parseMakerGroup accepts an executable member that is a boolean and refuses any other value", () => {
  const backend = (executable) => [{ path: ".moai/agents/backend.md", text: "# Backend\n", executable }];
  assert.equal(parseMakerGroup(group({ files: backend(true) }), "moai").files[0].executable, true);
  for (const value of ["yes", 1, null]) {
    assert.throws(() => parseMakerGroup(group({ files: backend(value) }), "moai"), /file \.moai\/agents\/backend\.md executable must be a boolean/);
  }
});

test("writePlan passes the executable member of each file, false when the entry has none", () => {
  const plan = writePlan(group({ files: [{ path: ".moai/agents/backend.md", text: "# Backend\n", executable: true }, { path: ".moai/skills/plan/SKILL.md", text: "plan\n" }] }));
  assert.deepEqual(plan.files, [
    { path: ".moai/agents/backend.md", text: "# Backend\n", executable: true },
    { path: ".moai/skills/plan/SKILL.md", text: "plan\n", executable: false },
  ]);
});

test("writePlan lists the folders, the files and the role of each agent with its file, and no stored record", () => {
  const plan = writePlan(group());
  assert.deepEqual(Object.keys(plan), ["folders", "files", "roles"]);
  assert.deepEqual(plan.folders, [".moai/"]);
  assert.deepEqual(plan.files.map((file) => file.path), [".moai/agents/backend.md", ".moai/skills/plan/SKILL.md"]);
  assert.deepEqual(plan.roles, [{ id: "moai-backend-expert", text: "Follow the definition in .moai/agents/backend.md.", ko: ".moai/agents/backend.md 파일의 정의를 따른다.", files: [".moai/agents/backend.md"] }]);
});

test("writePlan refuses an agent identifier that repeats within the group, naming the agent", () => {
  const twins = group({ agents: [{ name: "Backend Expert", path: ".moai/agents/backend.md", cli: "claude" }, { name: "backend-expert", path: ".moai/agents/backend.md", cli: "claude" }] });
  assert.throws(() => writePlan(twins), /agent backend-expert repeats the identifier moai-backend-expert of the group/);
});

test("listRecords stores the account of the agent cli, creates it, and stores each definition with its maker and the group record", () => {
  const stored = listRecords({ group: group(), groups: {}, definitions: {}, accounts: [], plugin: "terminal", cwd: "/work/project", dataFolder: DATA });
  assert.deepEqual(stored.accounts, [{ id: "claude", cli: "claude", args: [], env: [], home: { variable: "CLAUDE_CONFIG_DIR", folder: `${DATA}/accounts/claude` } }]);
  assert.deepEqual(stored.definitions, {
    "moai-backend-expert": { name: "Backend Expert", account: "claude", plugin: "terminal", role: "moai-backend-expert", cwd: "/work/project", maker: "moai" },
  });
  assert.deepEqual(stored.groups, { moai: { name: "MoAI", members: ["moai-backend-expert"] } });
});

test("listRecords uses the first account whose cli equals the agent cli and creates none", () => {
  const accounts = [{ id: "work", cli: "claude", args: ["--x"], env: [], home: null }];
  const stored = listRecords({ group: group(), groups: {}, definitions: {}, accounts, plugin: "terminal", cwd: "/work/project", dataFolder: DATA });
  assert.deepEqual(stored.accounts, accounts);
  assert.equal(stored.definitions["moai-backend-expert"].account, "work");
});

test("listRecords refuses an account identifier that another cli holds, naming the account", () => {
  const accounts = [{ id: "claude", cli: "codex", args: [], env: [], home: null }];
  assert.throws(() => listRecords({ group: group(), groups: {}, definitions: {}, accounts, plugin: "terminal", cwd: "/work/project", dataFolder: DATA }), /account claude is defined with cli codex/);
});

test("listRecords keeps the members the person added, and a listing of an equal group changes nothing", () => {
  const first = listRecords({ group: group(), groups: {}, definitions: {}, accounts: [], plugin: "terminal", cwd: "/work/project", dataFolder: DATA });
  const groups = { moai: { name: "MoAI", members: ["mine"] } };
  const definitions = { mine: { name: "Mine", account: "claude", plugin: "terminal", role: "mine", cwd: "/work/project" } };
  const second = listRecords({ group: group(), groups, definitions, accounts: [{ id: "claude", cli: "claude", args: [], env: [], home: { variable: "CLAUDE_CONFIG_DIR", folder: `${DATA}/accounts/claude` } }], plugin: "terminal", cwd: "/work/project", dataFolder: DATA });
  assert.deepEqual(second.groups.moai.members, ["mine", "moai-backend-expert"]);
  assert.deepEqual(second.definitions.mine, definitions.mine);
  const again = listRecords({ group: group(), groups: first.groups, definitions: first.definitions, accounts: first.accounts, plugin: "terminal", cwd: "/work/project", dataFolder: DATA });
  assert.deepEqual(again, first);
});

test("listRecords refuses an agent whose identifier is a member of another group, naming the group", () => {
  const groups = { other: { name: "Other", members: ["moai-backend-expert"] } };
  assert.throws(() => listRecords({ group: group(), groups, definitions: {}, accounts: [], plugin: "terminal", cwd: "/work/project", dataFolder: DATA }), /role moai-backend-expert is already in group other/);
});

test("writePlan takes a folder under .claude/ with its files, and lists only those files", () => {
  const claude = group({
    folders: [".claude/", ".moai/"],
    agents: [{ name: "Reviewer", path: ".claude/agents/reviewer.md", cli: "claude" }],
    files: [{ path: ".claude/agents/reviewer.md", text: "# Reviewer\n" }],
  });
  assert.equal(parseMakerGroup(claude, "moai").folders[0], ".claude/");
  assert.deepEqual(writePlan(claude).files, [{ path: ".claude/agents/reviewer.md", text: "# Reviewer\n", executable: false }]);
});

// The provider reads its items by the local name of the point; core refuses any name that is not a key of extends (A24).
test("the definitions page reads the maker groups by the local point name that plugin.json declares in extends", () => {
  const manifest = JSON.parse(readFileSync(new URL("../plugin.json", import.meta.url), "utf8"));
  assert.ok(Object.hasOwn(manifest.extends, MAKERS_POINT), `${MAKERS_POINT} is not a key of extends`);
  assert.equal(MAKERS_POINT, "makers");
});
