#!/usr/bin/env node
// The program of BROWSER during a login (docs/spec/definitions.md#account-homes): hands the sign-in address, its only argument, to the
// definition dialog with sok, which connects to the application of SOKSAK_CONFIG_DIR. The login program also imports showLoginPage.
import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Runs agents.definition-dialog.login-page on the definition dialog and resolves when sok ends with status 0.
export function showLoginPage(address) {
  return new Promise((resolve, reject) => {
    execFile("sok", ["agents.definition-dialog.sign-in", "--surface", "dialog/agents/definition", "--url", address], (error, _stdout, stderr) => {
      if (error) reject(new Error(`sok agents.definition-dialog.sign-in ended with ${error.code ?? error.message}: ${stderr.trim()}`));
      else resolve();
    });
  });
}

if (process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  if (process.argv.length !== 3) {
    process.stderr.write("login-page: the only argument is the sign-in address\n");
    process.exit(2);
  }
  showLoginPage(process.argv[2]).catch((error) => {
    process.stderr.write(`login-page: ${error.message}\n`);
    process.exit(1);
  });
}
