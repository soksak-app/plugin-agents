#!/usr/bin/env node
// The program login (docs/spec/definitions.md#account-homes): runs the documented login command of claude or codex in the home of an
// account and hands the sign-in address to the settings view with sok, so the settings view shows the sign-in page. claude gives the address
// to the program of BROWSER, which is login-page.mjs; codex opens no program of BROWSER on macOS and prints the address, which is read
// from the first line of its output that holds an https address. The program ends with the status of the cli.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { showLoginPage } from "./login-page.mjs";

const KINDS = { claude: { variable: "CLAUDE_CONFIG_DIR", args: ["auth", "login"] }, codex: { variable: "CODEX_HOME", args: ["login"] } };

const [kind, folder, cli] = process.argv.slice(2);
if (!Object.hasOwn(KINDS, kind)) {
  process.stderr.write(`login: the kind ${kind} is not claude or codex\n`);
  process.exit(2);
}
const { variable, args } = KINDS[kind];
const env = { ...process.env, [variable]: folder, BROWSER: fileURLToPath(new URL("./login-page.mjs", import.meta.url)) };
const child = spawn(cli, args, { env, stdio: ["ignore", "pipe", "pipe"] });
let shown = kind === "claude";
let pending = "";
let failure = null;
// The delivery of the address, which the end of the program waits for, so a cli that ends at once does not end the delivery.
let delivery = Promise.resolve();

// Reads the output of codex line by line until the first https address, which it hands to the settings view once.
function scan(text) {
  if (shown) return;
  pending += text;
  const lines = pending.split("\n");
  pending = lines.pop();
  for (const line of lines) {
    const address = /https:\/\/\S+/.exec(line);
    if (address === null) continue;
    shown = true;
    delivery = showLoginPage(address[0]).catch((error) => {
      failure = error;
      child.kill("SIGTERM");
    });
    return;
  }
}

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  scan(chunk.toString("utf8"));
});
child.stderr.on("data", (chunk) => process.stderr.write(chunk));
child.on("error", (error) => {
  process.stderr.write(`login: ${cli}: ${error.message}\n`);
  process.exit(127);
});
child.on("close", async (code, signal) => {
  await delivery;
  if (failure !== null) {
    process.stderr.write(`login: ${failure.message}\n`);
    process.exit(1);
  }
  if (signal !== null) {
    process.stderr.write(`login: ${cli} ended by the signal ${signal}\n`);
    process.exit(1);
  }
  process.exit(code);
});
