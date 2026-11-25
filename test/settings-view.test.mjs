// Checks the pages of the accounts (A26-3, docs/spec/definitions.md#settings-view): the settings view registers the account commands, the
// sign-in command and the statuses of the logins, and the definition dialog runs no login and adds no account.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = (name) => readFileSync(new URL(`../ui/${name}`, import.meta.url), "utf8");

test("the settings view registers the account commands, the sign-in command and the statuses of the logins", { timeout: 1000 }, () => {
  const source = page("settings.js");
  for (const name of ["agents.account.define", "agents.account.remove", "agents.account.login", "agents.account.login.cancel", "agents.settings.sign-in", "agents.settings.accounts", "agents.settings.login-run"]) {
    assert.ok(source.includes(`"${name}"`), `the settings view does not name ${name}`);
  }
  assert.match(source, /composition\.create\(\{ regions: \{ login: /, "the settings view does not create the region login");
  assert.match(page("settings.html"), /<script type="module" src="settings\.js"><\/script>/);
});

test("the definition dialog runs no login and adds no account", { timeout: 1000 }, () => {
  const source = page("definition-dialog.js");
  for (const name of ["agents.account.login", "agents.account.define", "agents.settings.sign-in", "composition.create"]) {
    assert.ok(!source.includes(name), `the definition dialog names ${name}`);
  }
  assert.doesNotMatch(page("definition-dialog.html"), /id="login|id="account-(id|cli|add)"/);
});
