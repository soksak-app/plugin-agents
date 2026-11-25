// Checks the maker group of a connected item (A17, A35, A37, docs/spec/makers.md): the group object, the identifiers of the agents, the
// account of each agent, the launch of the maker folder and the stored records and roles of a listing (listRecords), with the rules of
// ui/makers.js.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MAKERS_POINT, agentSlug, definitionIdentifier, launchOf, listRecords, makerFolder, parseMakerGroup } from "../ui/makers.js";

const DATA = "/config/plugin-data/agents";
const FOLDER = "/config/plugins/moai/0.0.6";
const MAKER = `${FOLDER}/plugin`;
const HOME = `${DATA}/accounts/claude`;
const group = (overrides = {}) => ({
  id: "moai",
  name: "MoAI",
  plugin: "plugin",
  clis: ["claude"],
  agents: [{ name: "Backend Expert", path: ".claude/agents/backend.md", cli: "claude", port: 4100, model: "opus" }],
  variables: { MOAI_HOME: "{home}/.moai", MOAI_PLUGIN: "{plugin}" },
  folders: [".moai/"],
  rules: ["Plans go to .moai/plans/."],
  ...overrides,
});
const listing = (overrides = {}) => ({ group: group(), folder: FOLDER, personHome: null, groups: {}, definitions: {}, accounts: [], plugin: "terminal", cwd: "/work/project", dataFolder: DATA, ...overrides });

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

test("parseMakerGroup refuses a required member that is missing or of another type, and a member of the earlier form", () => {
  const { folders, ...rest } = group();
  assert.throws(() => parseMakerGroup(rest, "moai"), /group moai must have the member folders/);
  assert.throws(() => parseMakerGroup(group({ folders: "x/" }), "moai"), /group moai member folders must be a list of text/);
  for (const member of ["files", "skills", "path"]) {
    assert.throws(() => parseMakerGroup(group({ [member]: [] }), "moai"), new RegExp(`group moai has the unknown member ${member}`));
  }
});

test("parseMakerGroup refuses an unsafe plugin or agent path and a variable that is not a name with a text value", () => {
  assert.throws(() => parseMakerGroup(group({ plugin: "/abs" }), "moai"), /group moai member plugin must be a relative path/);
  assert.throws(() => parseMakerGroup(group({ plugin: "../x" }), "moai"), /group moai member plugin must be a relative path without \.\. segments/);
  assert.throws(() => parseMakerGroup(group({ agents: [{ name: "X", path: "../x.md", cli: "claude" }] }), "moai"), /agent X path must be a relative path/);
  assert.throws(() => parseMakerGroup(group({ variables: { "1X": "a" } }), "moai"), /group moai variable 1X must be a variable name with a text value/);
  assert.throws(() => parseMakerGroup(group({ variables: { X: 1 } }), "moai"), /group moai variable X must be a variable name with a text value/);
});

test("makerFolder joins the installed folder of the item with plugin and refuses a folder that is not absolute", () => {
  assert.equal(makerFolder(group(), FOLDER), MAKER);
  assert.throws(() => makerFolder(group(), "config/plugins/moai"), /group moai: the installed folder of the item must be an absolute path without a trailing slash/);
  assert.throws(() => makerFolder(group(), undefined), /the installed folder of the item must be an absolute path/);
});

test("launchOf gives a claude agent the maker folder as plugin and added directory, with the variables of the group resolved", () => {
  assert.deepEqual(launchOf(group(), group().agents[0], { maker: MAKER, home: HOME, account: "claude", personHome: null }), {
    args: ["--plugin-dir", MAKER, "--add-dir", MAKER],
    env: { MOAI_HOME: `${HOME}/.moai`, MOAI_PLUGIN: MAKER },
  });
  assert.throws(() => launchOf(group(), group().agents[0], { maker: MAKER, home: null, account: "work", personHome: null }), /group moai variable MOAI_HOME needs the home of account work/);
});

test("launchOf gives a codex agent the maker folder as HOME and gives its commands the home of the person", () => {
  const codex = group({ clis: ["codex"], variables: {}, agents: [{ name: "Coder", path: ".codex/coder.md", cli: "codex" }] });
  assert.deepEqual(launchOf(codex, codex.agents[0], { maker: MAKER, home: "/h", account: "codex", personHome: "/Users/me" }), {
    args: ["-c", 'shell_environment_policy.set={HOME="/Users/me"}'],
    env: { HOME: MAKER },
  });
  assert.throws(() => launchOf({ ...codex, variables: { HOME: "/x" } }, codex.agents[0], { maker: MAKER, home: "/h", account: "codex", personHome: "/Users/me" }), /group moai variable HOME is the maker folder of a codex session/);
  assert.throws(() => launchOf(codex, codex.agents[0], { maker: MAKER, home: "/h", account: "codex", personHome: null }), /group moai: the home of the person must be an absolute path/);
});

test("listRecords stores the account, each definition with its maker and launch, the group record, and plans the role of each agent", () => {
  const stored = listRecords(listing());
  assert.deepEqual(stored.accounts, [{ id: "claude", cli: "claude", args: [], env: [], home: { variable: "CLAUDE_CONFIG_DIR", folder: HOME } }]);
  assert.deepEqual(stored.definitions, {
    "moai-backend-expert": {
      name: "Backend Expert", account: "claude", plugin: "terminal", role: "moai-backend-expert", cwd: "/work/project", maker: "moai",
      launch: { args: ["--plugin-dir", MAKER, "--add-dir", MAKER], env: { MOAI_HOME: `${HOME}/.moai`, MOAI_PLUGIN: MAKER } },
    },
  });
  assert.deepEqual(stored.groups, { moai: { name: "MoAI", members: ["moai-backend-expert"], leader: "moai-backend-expert" } });
  assert.deepEqual(stored.roles, [{
    id: "moai-backend-expert",
    text: `Follow the definition in ${MAKER}/.claude/agents/backend.md.`,
    ko: `${MAKER}/.claude/agents/backend.md 파일의 정의를 따른다.`,
    files: [`${MAKER}/.claude/agents/backend.md`],
  }]);
});

test("listRecords uses the first account whose cli equals the agent cli and creates none", () => {
  const accounts = [{ id: "work", cli: "claude", args: ["--x"], env: [], home: { variable: "CLAUDE_CONFIG_DIR", folder: `${DATA}/accounts/work` } }];
  const stored = listRecords(listing({ accounts }));
  assert.deepEqual(stored.accounts, accounts);
  assert.equal(stored.definitions["moai-backend-expert"].account, "work");
  assert.equal(stored.definitions["moai-backend-expert"].launch.env.MOAI_HOME, `${DATA}/accounts/work/.moai`);
});

test("listRecords refuses an account identifier that another cli holds, naming the account", () => {
  const accounts = [{ id: "claude", cli: "codex", args: [], env: [], home: null }];
  assert.throws(() => listRecords(listing({ accounts })), /account claude is defined with cli codex/);
});

test("listRecords keeps the members the person added, a listing of an equal group changes nothing, and a new folder changes the launch", () => {
  const first = listRecords(listing());
  const groups = { moai: { name: "MoAI", members: ["mine"], leader: "mine" } };
  const definitions = { mine: { name: "Mine", account: "claude", plugin: "terminal", role: "mine", cwd: "/work/project" } };
  const second = listRecords(listing({ groups, definitions, accounts: first.accounts }));
  assert.deepEqual(second.groups.moai.members, ["mine", "moai-backend-expert"]);
  assert.deepEqual(second.definitions.mine, definitions.mine);
  assert.deepEqual(listRecords(listing({ groups: first.groups, definitions: first.definitions, accounts: first.accounts })), first);
  const moved = listRecords(listing({ folder: "/config/plugins/moai/0.0.7", groups: first.groups, definitions: first.definitions, accounts: first.accounts }));
  assert.deepEqual(moved.definitions["moai-backend-expert"].launch.args, ["--plugin-dir", "/config/plugins/moai/0.0.7/plugin", "--add-dir", "/config/plugins/moai/0.0.7/plugin"]);
  assert.deepEqual(moved.roles[0].files, ["/config/plugins/moai/0.0.7/plugin/.claude/agents/backend.md"]);
});

test("listRecords refuses an agent identifier that repeats within the group, and one that is a member of another group", () => {
  const twins = group({ agents: [{ name: "Backend Expert", path: ".claude/agents/a.md", cli: "claude" }, { name: "backend-expert", path: ".claude/agents/b.md", cli: "claude" }] });
  assert.throws(() => listRecords(listing({ group: twins })), /agent backend-expert repeats the identifier moai-backend-expert of the group/);
  assert.throws(() => listRecords(listing({ groups: { other: { name: "Other", members: ["moai-backend-expert"], leader: "moai-backend-expert" } } })), /role moai-backend-expert is already in group other/);
});

// The provider reads its items by the local name of the point; core refuses any name that is not a key of extends (A24).
test("the definitions page reads the maker groups by the local point name that plugin.json declares in extends", () => {
  const manifest = JSON.parse(readFileSync(new URL("../plugin.json", import.meta.url), "utf8"));
  assert.ok(Object.hasOwn(manifest.extends, MAKERS_POINT), `${MAKERS_POINT} is not a key of extends`);
  assert.equal(MAKERS_POINT, "makers");
});
