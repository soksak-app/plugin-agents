// Checks the program home-settings (docs/spec/definitions.md#shared-settings) by running it as the host runs it: a real process with
// HOME set to a folder of the test, so the settings of the person are files of that folder.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PROGRAM = fileURLToPath(new URL("../bin/home-settings.mjs", import.meta.url));

// A person home and an account home of the test, removed at the end of the test.
function homes(t) {
  const root = mkdtempSync(join(tmpdir(), "agents-home-settings-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const person = join(root, "person");
  const folder = join(root, "plugin-data/agents/accounts/work");
  mkdirSync(join(person, ".claude"), { recursive: true });
  mkdirSync(folder, { recursive: true });
  return { person, folder };
}

const run = (person, folder) => new Promise((resolve) => {
  execFile(PROGRAM, [folder], { env: { ...process.env, HOME: person } }, (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr }));
});
const readJSON = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJSON = (path, value) => writeFileSync(path, JSON.stringify(value));

test("home-settings copies the settings of the person without the keys of authentication and the secret variables", async (t) => {
  const { person, folder } = homes(t);
  writeJSON(join(person, ".claude/settings.json"), {
    skipDangerousModePermissionPrompt: true, model: "opus", apiKeyHelper: "/bin/key", awsAuthRefresh: "x", awsCredentialExport: "y",
    forceLoginMethod: "claudeai", forceLoginOrgUUID: "z", env: { EDITOR: "vim", ANTHROPIC_API_KEY: "k", GITHUB_TOKEN: "t", DB_PASSWORD: "p", MY_SECRET: "s" },
  });
  assert.deepEqual(await run(person, folder), { code: 0, stdout: "", stderr: "" });
  assert.deepEqual(readJSON(join(folder, "settings.json")), { skipDangerousModePermissionPrompt: true, model: "opus", env: { EDITOR: "vim" } });
  assert.equal(statSync(join(folder, "settings.json")).mode & 0o777, 0o600);
  assert.equal(statSync(join(folder, "soksak-shared-settings.json")).mode & 0o777, 0o600);
  assert.deepEqual(readJSON(join(person, ".claude/settings.json")).apiKeyHelper, "/bin/key", "the settings of the person are unchanged");
});

test("home-settings keeps a change made in the home until the person changes the key, and removes a key that the person removed", async (t) => {
  const { person, folder } = homes(t);
  const source = join(person, ".claude/settings.json");
  writeJSON(source, { model: "opus", theme: "dark", verbose: true });
  await run(person, folder);
  writeJSON(join(folder, "settings.json"), { ...readJSON(join(folder, "settings.json")), model: "sonnet", own: 1 });
  writeJSON(source, { model: "opus", theme: "light" });
  assert.equal((await run(person, folder)).code, 0);
  assert.deepEqual(readJSON(join(folder, "settings.json")), { model: "sonnet", theme: "light", own: 1 });
  writeJSON(source, { model: "haiku", theme: "light" });
  await run(person, folder);
  assert.deepEqual(readJSON(join(folder, "settings.json")), { model: "haiku", theme: "light", own: 1 });
});

test("home-settings treats an absent settings file of the person as no settings and refuses a file that is not a JSON object", async (t) => {
  const { person, folder } = homes(t);
  assert.equal((await run(person, folder)).code, 0);
  assert.deepEqual(readJSON(join(folder, "settings.json")), {});
  writeFileSync(join(person, ".claude/settings.json"), "[1]");
  const refused = await run(person, folder);
  assert.equal(refused.code, 1);
  assert.equal(refused.stderr, `home-settings: ${join(person, ".claude/settings.json")} is not a JSON object\n`);
  assert.ok(!existsSync(join(person, ".claude/soksak-shared-settings.json")), "nothing is written into the default home");
});
