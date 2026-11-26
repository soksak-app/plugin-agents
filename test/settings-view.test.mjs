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

// The seat of the settings view takes the content height that the view reports (core docs/spec/plugins.md#settings-views, A61): the view
// calls followSeatHeight, and no rule of the page ties the height of its root element to the height of the view.
test("the settings view reports its content height and sizes its root by its content", { timeout: 1000 }, () => {
  assert.match(page("settings.js"), /bridge\.followSeatHeight\(\);/, "the settings view does not report its content height");
  const styles = page("settings.html").match(/<style>([\s\S]*?)<\/style>/)[1];
  for (const rule of styles.split("}")) {
    const [selector, body = ""] = rule.split("{");
    if (/\b(html|body|main)\b/.test(selector)) {
      assert.doesNotMatch(body, /height:\s*100%|\b100vh\b|overflow-y:\s*auto/, `the rule ${selector.trim()} ties the root to the height of the view`);
    }
  }
  assert.match(styles, /#login-page \{[^}]*\bheight: \d+px/, "the region login has no fixed height");
});
