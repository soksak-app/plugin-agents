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
const DECLARED_MEMBERS = ["id", "name", "description", "sections", "extends"];

test("plugin.json declares only the members of this skeleton", () => {
  assert.deepEqual(Object.keys(manifest).sort(), [...DECLARED_MEMBERS].sort());
});

test("plugin.json declares the identifier agents and a description of one to two hundred characters", () => {
  assert.equal(manifest.id, "agents");
  assert.match(manifest.id, /^[a-z][a-z0-9-]*$/);
  assert.equal(manifest.name, "에이전트");
  assert.ok(manifest.description.length >= 1 && manifest.description.length <= 200, "description length is outside 1 to 200");
});

test("plugin.json declares the running agents and the agent definitions as view sections", () => {
  assert.deepEqual(manifest.sections, [
    {
      id: "agents.running",
      name: "실행 중인 에이전트",
      composition: { kind: "view", page: "ui/running.html" },
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

test("plugin.json declares no surface, host page, state module, contribution or settings yet", () => {
  for (const member of ["surface", "host", "hostOperations", "state", "contributes", "settings", "data", "exposes"]) {
    assert.equal(manifest[member], undefined, `plugin.json declares ${member}`);
  }
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
  assert.deepEqual(pkg.engines, { soksak: "^0.0.41" });
  assert.deepEqual(pkg.files, ["plugin.json", "ui"]);
  assert.equal(pkg.private, true);
});
