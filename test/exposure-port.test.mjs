// Checks the exposure port of the agents pages (A23) against createExpose of @soksak/plugin-api, which refuses a port without
// report or changed; a fake SDK would accept any port.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createExpose } from "@soksak/plugin-api";
import { exposurePort } from "../ui/exposure-port.js";
import { loginCancelButton, registerLoginCancel } from "../ui/login-cancel.js";

const manifest = JSON.parse(readFileSync(new URL("../plugin.json", import.meta.url), "utf8"));

// A view bridge that records the calls of its exposure.
function recordingBridge() {
  const calls = [];
  const exposure = {
    register: async (kind, name) => { calls.push(["register", kind, name]); },
    reply: async (id, payload) => { calls.push(["reply", id, payload]); },
    changed: async (name, value, version) => { calls.push(["changed", name, value, version]); },
  };
  return { calls, bridge: { exposure, runtime: { native: { on: async () => () => {} } } } };
}

test("createExpose accepts the exposure port and registers a declared command of plugin.json", async () => {
  const { calls, bridge } = recordingBridge();
  const errors = [];
  const expose = createExpose(exposurePort(bridge, "agents.test", (where, text) => errors.push([where, text])), () => manifest.exposes);
  await expose.command("agents.group.create", async () => ({}));
  // A command registration sends nothing: the command layer of the view bridge registers the command.
  assert.deepEqual(calls, []);
  assert.deepEqual(errors, []);
});

test("the exposure port sends replies and changes through bridge.exposure and reports through the page error path", async () => {
  const { calls, bridge } = recordingBridge();
  const errors = [];
  const port = exposurePort(bridge, "agents.test", (where, text) => errors.push([where, text]));
  await port.reply("r1", { result: 1 });
  await port.changed("agents.test", "v", 2);
  await port.report("refused");
  assert.deepEqual(calls, [["reply", "r1", { result: 1 }], ["changed", "agents.test", "v", 2]]);
  assert.deepEqual(errors, [["agents.test", "refused"]]);
});

// The rows of the settings view are drawn again while a login runs, so the button 로그인 취소 is made once per drawing; the element is
// registered once and each request reads the current button (A58).
test("a second drawing of the button 로그인 취소 during one login is not refused", async () => {
  const { bridge } = recordingBridge();
  const errors = [];
  const expose = createExpose(exposurePort(bridge, "agents.test", (where, text) => errors.push([where, text])), () => manifest.exposes);
  const button = () => ({ type: "", textContent: "", dataset: {} });
  const list = { buttons: [], querySelectorAll() { return this.buttons; } };
  const doc = { createElement: button };
  const refusals = [];
  await registerLoginCancel(expose, list).catch((error) => refusals.push(error.message));
  for (let drawing = 0; drawing < 2; drawing++) {
    const cancel = loginCancelButton(doc);
    list.buttons = [cancel];
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(refusals, []);
  assert.equal(list.buttons[0].dataset.expose, "agents.settings.login-cancel");
  assert.deepEqual(errors, []);
});
