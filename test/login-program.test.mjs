// Checks the program login (docs/spec/definitions.md#account-homes) by running it as the host runs it: a real process whose PATH holds a
// cli of the test, which behaves as the documented login command of claude or codex, and a sok of the test, which records its arguments.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PROGRAM = fileURLToPath(new URL("../bin/login.mjs", import.meta.url));
const ADDRESS = "https://sign-in.example/authorize?client=1&state=2";

// A folder of the test with bin/sok, which appends its arguments as one JSON line to sok.log, and bin/<cli> with the script body.
function setup(t, cli, body) {
  const root = mkdtempSync(join(tmpdir(), "agents-login-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "bin"));
  const script = (name, text) => { writeFileSync(join(root, "bin", name), text); chmodSync(join(root, "bin", name), 0o755); };
  script("sok", `#!/usr/bin/env node\nrequire("node:fs").appendFileSync(${JSON.stringify(join(root, "sok.log"))}, JSON.stringify(process.argv.slice(2)) + "\\n");\n`);
  script(cli, `#!/bin/sh\n${body}\n`);
  const folder = join(root, "plugin-data/agents/accounts/work");
  mkdirSync(folder, { recursive: true });
  return { root, folder, env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}` } };
}

const run = (args, env) => new Promise((resolve) => {
  execFile(PROGRAM, args, { env }, (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr }));
});
const sokCalls = (root) => readFileSync(join(root, "sok.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
const PAGE = ["agents.definition-dialog.sign-in", "--surface", "dialog/agents/definition", "--url", ADDRESS];

test("the login of claude runs claude auth login in the home and hands the address that claude gives BROWSER to the dialog", async (t) => {
  const { root, folder, env } = setup(t, "claude",
    `[ "$1 $2" = "auth login" ] || exit 9\n[ "$CLAUDE_CONFIG_DIR" = "$HOME_EXPECTED" ] || exit 8\n"$BROWSER" "${ADDRESS}" || exit 7\necho done`);
  const result = await run(["claude", folder, "claude"], { ...env, HOME_EXPECTED: folder });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(sokCalls(root), [PAGE]);
});

test("the login of codex runs codex login in the home and hands the first https address of its output to the dialog", async (t) => {
  const { root, folder, env } = setup(t, "codex",
    `[ "$1" = "login" ] || exit 9\n[ "$CODEX_HOME" = "$HOME_EXPECTED" ] || exit 8\necho "Starting local login server on http://localhost:1455"\necho "If your browser did not open, navigate to this URL to authenticate:"\necho ""\necho "${ADDRESS}"\necho "${ADDRESS}&again"\necho done`);
  const result = await run(["codex", folder, "codex"], { ...env, HOME_EXPECTED: folder });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(sokCalls(root), [PAGE]);
});

test("the login ends with the status of the cli and gives its standard error", async (t) => {
  const { folder, env } = setup(t, "claude", `echo "login failed" >&2\nexit 3`);
  const result = await run(["claude", folder, "claude"], env);
  assert.equal(result.code, 3);
  assert.equal(result.stderr, "login failed\n");
});

test("the login refuses a kind other than claude and codex", async (t) => {
  const { folder, env } = setup(t, "claude", "exit 0");
  const result = await run(["gemini", folder, "claude"], env);
  assert.equal(result.code, 2);
  assert.equal(result.stderr, "login: the kind gemini is not claude or codex\n");
});
