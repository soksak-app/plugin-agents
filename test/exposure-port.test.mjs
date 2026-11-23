// Checks the exposure port of the agents pages (A23) against createExpose of @soksak/plugin-api, which refuses a port without
// report or changed; a fake SDK would accept any port.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createExpose } from "@soksak/plugin-api";
import { exposurePort } from "../ui/exposure-port.js";

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
  await expose.command("agents.group.write", async () => ({}));
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
