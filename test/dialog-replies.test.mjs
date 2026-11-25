// Checks that a command that stores a record answers its caller (A56): the commands agents.definition.define, agents.definition.change
// and agents.group.create of a dialog store and return, and only the save command of the dialog closes it with the result, because a
// close ends the surface and every call that waits on it with surface-closed (core docs/spec/plugins.md#dialogs).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = (name) => readFileSync(new URL(`../ui/${name}`, import.meta.url), "utf8");

// The body of the function that the page registers for a command constant.
function handlerBody(source, constant) {
  const registered = source.match(new RegExp(`bridge\\.commands\\.register\\(${constant}, (\\w+)\\)`));
  assert.ok(registered, `the page registers ${constant}`);
  const start = source.indexOf(`async function ${registered[1]}(`);
  assert.notEqual(start, -1, `the page defines ${registered[1]}`);
  return source.slice(start, source.indexOf("\n}\n", start));
}

for (const [name, store, save] of [["definition-dialog.js", "save", "SAVE"], ["group-dialog.js", "CREATE", "ADD"]]) {
  test(`${name}: the store command answers without closing the dialog, and the save command closes it`, { timeout: 1000 }, () => {
    const source = page(name);
    assert.doesNotMatch(handlerBody(source, store), /dialog\.close/, `${name}: the handler of ${store} closes the dialog before its reply`);
    assert.match(handlerBody(source, save), /dialog\.close\(/, `${name}: the handler of ${save} does not close the dialog`);
  });
}
