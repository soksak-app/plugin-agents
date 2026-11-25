// Checks that each dialog page of the plugin can be closed when a start step fails (A50): the page registers its cancel command and
// the Escape key before its first start step that can fail, and runs those steps inside a try whose catch shows the refusal, so the
// cancel button and Escape close a dialog whose start failed (core docs/spec/plugins.md#dialogs: the page decides its dismissal).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = (name) => readFileSync(new URL(`../ui/${name}`, import.meta.url), "utf8");
const at = (source, text, name) => {
  const index = source.indexOf(text);
  assert.notEqual(index, -1, `${name} holds ${text}`);
  return index;
};

// Each page with the start of its guarded steps and the steps that can fail, which run only after that start.
for (const [name, guard, steps] of [
  ["definition-dialog.js", "try {\n  await startForm();", ["  readParams();\n", "await showAccounts();"]],
  ["group-dialog.js", "try {\n  const groups = parseGroups((await bridge.runtime.data.get(", []],
]) {
  test(`${name} registers its cancel and Escape before every start step that can fail`, { timeout: 1000 }, () => {
    const source = page(name);
    const cancel = at(source, "bridge.commands.register(CANCEL, cancel)", name);
    const escape = at(source, 'event.key === "Escape"', name);
    const start = at(source, guard, name);
    assert.ok(cancel < start && escape < start, `${name}: the guarded start runs before the cancel and Escape are registered`);
    for (const step of steps) {
      const form = at(source, "async function startForm", name);
      const index = at(source, step, name);
      assert.ok(index > form && source.indexOf(step, index + 1) === -1, `${name}: ${step} runs outside startForm`);
    }
  });
}
