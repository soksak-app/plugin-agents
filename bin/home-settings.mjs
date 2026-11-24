#!/usr/bin/env node
// The program home-settings (docs/spec/definitions.md#shared-settings): copies the settings of the person, $HOME/.claude/settings.json,
// into the settings of the account home given as the only argument, without the keys of authentication and the secret variables. The
// values copied last stay in soksak-shared-settings.json of the home, so a key of the home is replaced only when the person changed it.
// No library reads and writes a JSON settings file with this rule of changed keys, so the rule is written here.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const AUTHENTICATION = new Set(["apiKeyHelper", "awsAuthRefresh", "awsCredentialExport", "forceLoginMethod", "forceLoginOrgUUID"]);
const SECRET_VARIABLE = /KEY|TOKEN|SECRET|PASSWORD/i;

function fail(text) {
  process.stderr.write(`home-settings: ${text}\n`);
  process.exit(1);
}

// The JSON object of the file at path, or empty when the file is absent.
function readObject(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return {};
    fail(`${path}: ${error.message}`);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail(`${path} is not a JSON object`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${path} is not a JSON object`);
  return value;
}

// Writes the value as a new file with mode 0600 and renames it over path, so a reader never finds half a file.
function writeObject(path, value) {
  const next = `${path}.${process.pid}.new`;
  writeFileSync(next, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(next, path);
}

// The settings of the person that a home receives.
function shared(settings) {
  const result = {};
  for (const [key, value] of Object.entries(settings)) {
    if (AUTHENTICATION.has(key)) continue;
    if (key === "env" && value !== null && typeof value === "object" && !Array.isArray(value)) {
      result.env = Object.fromEntries(Object.entries(value).filter(([name]) => !SECRET_VARIABLE.test(name)));
      continue;
    }
    result[key] = value;
  }
  return result;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

if (process.argv.length !== 3 || !process.argv[2].startsWith("/")) fail("the only argument is the absolute folder of the home");
const folder = process.argv[2];
if (typeof process.env.HOME !== "string" || !process.env.HOME.startsWith("/")) fail("HOME is not an absolute folder");
const source = shared(readObject(join(process.env.HOME, ".claude", "settings.json")));
const keptPath = join(folder, "soksak-shared-settings.json");
const settingsPath = join(folder, "settings.json");
const kept = readObject(keptPath);
const home = readObject(settingsPath);
for (const [key, value] of Object.entries(source)) {
  if (!Object.hasOwn(home, key) || !Object.hasOwn(kept, key) || !same(kept[key], value)) home[key] = value;
}
for (const key of Object.keys(kept)) {
  if (!Object.hasOwn(source, key) && same(home[key], kept[key])) delete home[key];
}
writeObject(settingsPath, home);
writeObject(keptPath, source);
