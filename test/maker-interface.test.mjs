// Checks the interface of the extension point agents.makers (docs/spec/makers.md) against the item declaration of plugin.json.
// The group object is the value that a contributed module returns; the schema of that value is the JSON block of the spec,
// and this test checks a sample object against it with a matcher of the schema subset (type, properties, required, items, enum).
// No schema library is used: ajv is not a declared dependency of this repository.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const manifest = JSON.parse(read("plugin.json"));
const spec = read("docs/spec/makers.md");
const specKo = read("docs/spec/makers.ko.md");

const groupSchema = JSON.parse(spec.match(/```json group-schema\n([\s\S]*?)```/)?.[1] ?? "null");

// Returns the reason a value does not match the schema, or null when it matches.
function mismatch(schema, value, at = "group") {
  const types = [].concat(schema.type ?? []);
  if (types.length > 0) {
    const actual = value === null ? "null" : Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value;
    const ok = types.some((type) => type === actual || (type === "number" && actual === "integer"));
    if (!ok) return `${at} is ${actual}, not ${types.join(" or ")}`;
  }
  if (schema.enum !== undefined && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) return `${at} is not in enum`;
  if (schema.properties !== undefined && typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) return `${at} lacks ${key}`;
    for (const [key, sub] of Object.entries(schema.properties)) {
      if (Object.hasOwn(value, key)) {
        const reason = mismatch(sub, value[key], `${at}.${key}`);
        if (reason) return reason;
      }
    }
  }
  if (schema.items !== undefined && Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const reason = mismatch(schema.items, item, `${at}[${index}]`);
      if (reason) return reason;
    }
  }
  return null;
}

const sampleGroup = {
  id: "moai",
  name: "MoAI",
  plugin: "plugin",
  clis: ["claude"],
  agents: [{ name: "manager-spec", path: ".claude/agents/manager-spec.md", cli: "claude", port: 7801, model: "opus" }],
  variables: { MOAI_HOME: "{home}/.moai" },
  folders: [".moai/"],
  rules: [".moai/ holds the output of moai"],
};

test("the spec defines the group schema in a json group-schema block", () => {
  assert.ok(groupSchema, "docs/spec/makers.md has no json group-schema block");
  assert.equal(groupSchema.type, "object");
  assert.deepEqual(groupSchema.required, ["id", "name", "plugin", "clis", "agents", "variables", "folders", "rules"]);
});

test("a sample group matches the group schema and a group without a required member does not", () => {
  assert.equal(mismatch(groupSchema, sampleGroup), null);
  const { folders, ...withoutFolders } = sampleGroup;
  assert.equal(mismatch(groupSchema, withoutFolders), "group lacks folders");
  assert.match(mismatch(groupSchema, { ...sampleGroup, agents: [{ name: "x", path: "a.md" }] }), /lacks cli/);
  assert.match(mismatch(groupSchema, { ...sampleGroup, clis: ["gemini"] }), /enum/);
  assert.match(mismatch(groupSchema, { ...sampleGroup, agents: [{ name: "x", path: "a.md", cli: "claude", port: "7801" }] }), /port is string/);
});

test("the item schema of agents.makers in plugin.json is the identifier and name of a group", () => {
  assert.deepEqual(manifest.extends.makers.schema.required, ["id", "name"]);
  assert.equal(manifest.extends.makers.version, "0.0.1");
});

test("the spec names the export group and the rule that the provider calls it, in en and ko", () => {
  for (const text of [spec, specKo]) {
    assert.match(text, /`group`/);
    assert.match(text, /group-schema/);
  }
});
