// Checks the import of a maker group (A17, docs/spec/makers.md#import): the group object, the identifiers of the agents, the account
// of each agent and the plan of the writes, with the rules of ui/makers.js.
import assert from "node:assert/strict";
import test from "node:test";
import { agentSlug, definitionIdentifier, importPlan, parseMakerGroup } from "../ui/makers.js";

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

test("importPlan writes each folder and file, creates the account of the agent cli and defines the agent with its file", () => {
  const plan = importPlan({ group: group(), groups: {}, definitions: {}, accounts: [], plugin: "terminal", cwd: "/work/project" });
  assert.deepEqual(plan.folders, [".moai/"]);
  assert.deepEqual(plan.files.map((file) => file.path), [".moai/agents/backend.md", ".moai/skills/plan/SKILL.md"]);
  assert.deepEqual(plan.accounts, [{ id: "claude", cli: "claude", args: [], env: [] }]);
  assert.deepEqual(plan.definitions, {
    "moai-backend-expert": { name: "Backend Expert", account: "claude", plugin: "terminal", role: "moai-backend-expert", cwd: "/work/project" },
  });
  assert.deepEqual(plan.groups, { moai: { name: "MoAI", members: ["moai-backend-expert"] } });
  assert.deepEqual(plan.roles, [{ id: "moai-backend-expert", text: "Follow the definition in .moai/agents/backend.md.", ko: ".moai/agents/backend.md 파일의 정의를 따른다.", files: [".moai/agents/backend.md"] }]);
});

test("importPlan uses the first account whose cli equals the agent cli and creates none", () => {
  const accounts = [{ id: "work", cli: "claude", args: ["--x"], env: [] }];
  const plan = importPlan({ group: group(), groups: {}, definitions: {}, accounts, plugin: "terminal", cwd: "/work/project" });
  assert.deepEqual(plan.accounts, []);
  assert.equal(plan.definitions["moai-backend-expert"].account, "work");
});

test("importPlan refuses an account identifier that another cli holds, naming the account", () => {
  const accounts = [{ id: "claude", cli: "codex", args: [], env: [] }];
  assert.throws(() => importPlan({ group: group(), groups: {}, definitions: {}, accounts, plugin: "terminal", cwd: "/work/project" }), /account claude is defined with cli codex/);
});

test("importPlan keeps the members the person added and sets the maker definitions, and an equal import changes nothing", () => {
  const first = importPlan({ group: group(), groups: {}, definitions: {}, accounts: [], plugin: "terminal", cwd: "/work/project" });
  const groups = { moai: { name: "MoAI", members: ["mine"] } };
  const definitions = { mine: { name: "Mine", account: "claude", plugin: "terminal", role: "mine", cwd: "/work/project" } };
  const second = importPlan({ group: group(), groups, definitions, accounts: [{ id: "claude", cli: "claude", args: [], env: [] }], plugin: "terminal", cwd: "/work/project" });
  assert.deepEqual(second.groups.moai.members, ["mine", "moai-backend-expert"]);
  assert.deepEqual(second.definitions.mine, definitions.mine);
  const again = importPlan({ group: group(), groups: first.groups, definitions: first.definitions, accounts: [{ id: "claude", cli: "claude", args: [], env: [] }], plugin: "terminal", cwd: "/work/project" });
  assert.deepEqual(again.groups, first.groups);
  assert.deepEqual(again.definitions, first.definitions);
});

test("importPlan refuses an agent whose identifier is a member of another group, naming the group", () => {
  const groups = { other: { name: "Other", members: ["moai-backend-expert"] } };
  assert.throws(() => importPlan({ group: group(), groups, definitions: {}, accounts: [], plugin: "terminal", cwd: "/work/project" }), /role moai-backend-expert is already in group other/);
});

test("parseMakerGroup accepts a folder under .claude/ with its files, and the import plan writes only those files", () => {
  const claude = group({
    folders: [".claude/", ".moai/"],
    agents: [{ name: "Reviewer", path: ".claude/agents/reviewer.md", cli: "claude" }],
    files: [{ path: ".claude/agents/reviewer.md", text: "# Reviewer\n" }],
  });
  assert.equal(parseMakerGroup(claude, "moai").folders[0], ".claude/");
  const plan = importPlan({ group: claude, groups: {}, definitions: {}, accounts: [], plugin: "terminal", cwd: "/work/project" });
  assert.deepEqual(plan.files, [{ path: ".claude/agents/reviewer.md", text: "# Reviewer\n" }]);
});
