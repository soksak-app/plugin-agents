// Checks the declarations of plugin.json and package.json, and the files that they name, with literal expectations.
// The application validates plugin.json at installation; this test checks the declaration against the manifest rules of
// core docs/spec/plugins.md (plugin.json table, sections and extension points) without reading core.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));
const manifest = JSON.parse(read("plugin.json"));
const pkg = JSON.parse(read("package.json"));

// The members that the manifest of this plugin declares. A member that core lists later is added here with its test.
const DECLARED_MEMBERS = ["id", "name", "description", "sections", "dependencies", "settings", "extends", "data", "exposes"];

test("plugin.json declares only the members of this skeleton", () => {
  assert.deepEqual(Object.keys(manifest).sort(), [...DECLARED_MEMBERS].sort());
});

test("plugin.json declares the identifier agents and a description of one to two hundred characters", () => {
  assert.equal(manifest.id, "agents");
  assert.match(manifest.id, /^[a-z][a-z0-9-]*$/);
  assert.equal(manifest.name, "에이전트");
  assert.ok(manifest.description.length >= 1 && manifest.description.length <= 200, "description length is outside 1 to 200");
});

test("plugin.json declares the running agents, the agent accounts and the agent definitions as view sections", () => {
  assert.deepEqual(manifest.sections, [
    {
      id: "agents.running",
      name: "실행 중인 에이전트",
      composition: { kind: "view", page: "ui/running.html" },
      height: "fill",
    },
    {
      id: "agents.accounts",
      name: "에이전트 계정",
      composition: { kind: "view", page: "ui/accounts.html" },
      height: "fill",
    },
    {
      id: "agents.definitions",
      name: "에이전트 정의",
      composition: { kind: "view", page: "ui/definitions.html" },
      height: "fill",
    },
  ]);
});

test("every section id starts with the plugin id and is unique, and every height is fill or a positive integer", () => {
  const ids = manifest.sections.map((section) => section.id);
  assert.equal(new Set(ids).size, ids.length, "a section id repeats");
  for (const section of manifest.sections) {
    assert.ok(section.id.startsWith(`${manifest.id}.`), `${section.id} does not start with ${manifest.id}.`);
    assert.ok(section.height === "fill" || (Number.isInteger(section.height) && section.height > 0), `${section.id} height`);
    for (const refused of ["status", "module", "fill"]) assert.equal(section[refused], undefined, `${section.id} declares ${refused}`);
  }
});

// A view page begins with a doctype and holds no import map (core docs/spec/plugin-processes.md, rule 4); the host inserts the map.
test("each section page of plugin.json exists, begins with a doctype and holds no import map", () => {
  for (const section of manifest.sections) {
    const page = section.composition.page;
    assert.ok(exists(page), `${page} does not exist`);
    assert.match(read(page), /^<!doctype html>/i, `${page} has no doctype at its start`);
    assert.doesNotMatch(read(page), /<script\b[^>]*\btype\s*=\s*["']?importmap\b/i, `${page} holds an import map`);
  }
});

test("plugin.json declares no surface, host page, state module or contribution yet", () => {
  for (const member of ["surface", "host", "hostOperations", "state", "contributes"]) {
    assert.equal(manifest[member], undefined, `plugin.json declares ${member}`);
  }
});

// The project data of the definitions section: the groups, one value per key (docs/spec/plugins.md#project-data, A4).
// The setting that names the plugin of each definition (A5): a string declared in settings, never a literal in the code.
test("plugin.json declares the setting terminalPlugin, a string of at most 64 characters with the default terminal", () => {
  assert.deepEqual(manifest.settings, {
    terminalPlugin: {
      label: "터미널 플러그인",
      description: "에이전트 정의가 세션을 여는 터미널 플러그인의 식별자. 새 정의는 이 값을 plugin으로 저장한다.",
      type: "string",
      default: "terminal",
      maxLength: 64,
    },
  });
});

test("plugin.json declares the project data keys groups, definitions and accounts, whose defaults are empty", () => {
  assert.deepEqual(manifest.data, {
    groups: { schema: { type: "object" }, default: {} },
    definitions: { schema: { type: "object" }, default: {} },
    accounts: {
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            cli: { type: "string" },
            args: { type: "array", items: { type: "string" } },
            env: { type: "array", items: { type: "string" } },
          },
        },
      },
      default: [],
    },
  });
});

// The commands of the accounts section (A2): the define command adds an account or replaces the one with the same identifier,
// and its args and env are text with one entry per line, as the form enters them.
test("plugin.json declares the commands agents.account.define and agents.account.remove with their parameters and results", () => {
  const commands = manifest.exposes.commands.filter((command) => command.name.startsWith("agents.account."));
  assert.deepEqual(commands, [
    {
      name: "agents.account.define",
      description: "Adds the agent account with the identifier, or replaces the account with the same identifier. The args and the env are text with one entry per line: each line of args is one argument, and each line of env is the name of an environment variable.",
      params: { type: "object", properties: { id: { type: "string" }, cli: { type: "string" }, args: { type: "string" }, env: { type: "string" } }, required: ["id", "cli", "args", "env"] },
      result: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
    {
      name: "agents.account.remove",
      description: "Removes the agent account with the identifier from the project.",
      params: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      result: { type: "null" },
    },
  ]);
});

// The command that the definitions section runs to create an empty group (A4). Its parameters are the name only; the
// identifier is made by the page and returned in the result.
test("plugin.json declares the sidecar of the files that the import writes, at the version that reads the executable member of write", () => {
  assert.deepEqual(manifest.dependencies, { "@soksak/sidecar-files": ">=0.0.13" });
});

test("plugin.json declares the commands agents.group.create, agents.definition.define, agents.definition.remove, agents.running.select and agents.session.show with their parameters and results", () => {
  assert.deepEqual(manifest.exposes.commands, [
    {
      name: "agents.group.create",
      description: "Creates an empty group of the project with the given name and returns its identifier.",
      params: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      result: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
    {
      name: "agents.definition.define",
      description: "Defines a definition in a group: checks the group, the membership and the account, defines the role with core.role.define, then stores the definition with the plugin of the setting terminalPlugin and adds its identifier to the members of the group. The files are the absolute paths, one per line; cwd is an absolute path. Returns the identifier.",
      params: { type: "object", properties: { group: { type: "string" }, id: { type: "string" }, name: { type: "string" }, account: { type: "string" }, cwd: { type: "string" }, text: { type: "string" }, ko: { type: "string" }, files: { type: "string" } }, required: ["group", "id", "name", "account", "cwd", "text", "ko", "files"] },
      result: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
    {
      name: "agents.definition.remove",
      description: "Removes a definition from a group: removes the role with core.role.remove, then removes the definition and its identifier from the members of the group.",
      params: { type: "object", properties: { group: { type: "string" }, id: { type: "string" } }, required: ["group", "id"] },
      result: { type: "null" },
    },
    {
      name: "agents.running.select",
      description: "Selects the tab of a running agent in the window, the tab that the row of the running agents section names.",
      params: { type: "object", properties: { tab: { type: "string" } }, required: ["tab"] },
      result: { type: "null" },
    },
    {
      name: "agents.session.show",
      description: "Shows a session that core.sessions lists as open in the current card of the window, with core.layout.open, so that the tab attaches to the session.",
      params: { type: "object", properties: { session: { type: "string" } }, required: ["session"] },
      result: { type: "null" },
    },
    {
      name: "agents.account.define",
      description: "Adds the agent account with the identifier, or replaces the account with the same identifier. The args and the env are text with one entry per line: each line of args is one argument, and each line of env is the name of an environment variable.",
      params: { type: "object", properties: { id: { type: "string" }, cli: { type: "string" }, args: { type: "string" }, env: { type: "string" } }, required: ["id", "cli", "args", "env"] },
      result: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
    {
      name: "agents.group.import",
      description: "Imports the maker group that a connected item of agents.makers contributes: writes its folders and files, defines its agents with core.role.define, and stores its groups, definitions and accounts. Refuses the import with the text of the rule before any write when a check fails.",
      params: { type: "object", properties: { group: { type: "string" } }, required: ["group"] },
      result: { type: "null" },
    },
    {
      name: "agents.account.remove",
      description: "Removes the agent account with the identifier from the project.",
      params: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      result: { type: "null" },
    },
  ]);
});

// A25: the running agents section lists running sessions only; members are invited in the clubhouse room, so the section starts
// no definition.
test("the running agents section has no list of definitions to start", () => {
  const html = readFileSync(new URL("../ui/running.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /id="definitions"|id="no-definitions"|정의 시작/);
});

// The extension point of the maker plugins (core docs/spec/plugins.md#extension-points): the provider declares it in extends,
// and an item of a maker contributes one group with the fields of the point schema; range and module are not schema fields.
test("plugin.json declares the extension point agents.makers in extends with its version and schema", () => {
  assert.deepEqual(manifest.extends, {
    makers: {
      version: "0.0.1",
      schema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id", "name"],
      },
    },
  });
});

test("package.json declares the core range of the plugin and the files of its release", () => {
  assert.deepEqual(pkg.engines, { soksak: "^0.0.47" });
  assert.deepEqual(pkg.files, ["plugin.json", "ui"]);
  assert.equal(pkg.private, true);
});

// The status agents.definitions (A13) is removed: the room reads the stored definitions and accounts (F1075), so no status is declared.
test("plugin.json declares no status", () => {
  assert.equal(manifest.exposes.status, undefined);
});
