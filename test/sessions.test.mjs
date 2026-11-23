// Checks the owned sessions of the running agents (A6): a session starts with core.session.open and no tab holds it, and a tab
// shows it on request with core.layout.open {params: {session}}. The rules are those of ui/sessions.js; the core call is a
// recording function that answers the declared shapes (core docs/spec/plugins.md#owned-sessions).
import assert from "node:assert/strict";
import test from "node:test";
import { showSession } from "../ui/sessions.js";


// A call function that records each core command and answers with reply(name, params).
function recorder(reply = () => null) {
  const calls = [];
  const call = async (name, params) => {
    calls.push({ name, params });
    return reply(name, params);
  };
  return { call, calls };
}

test("showSession opens a tab of the session's plugin in the current card with the session as its params", async () => {
  const { call, calls } = recorder(() => ({ card: "c-1", tab: "t-1" }));
  const sessions = [{ session: "s-1", plugin: "example.terminal", owner: "agents", shownBy: null }];
  const result = await showSession(call, { session: "s-1" }, sessions);
  assert.deepEqual(result, { card: "c-1", tab: "t-1" });
  assert.deepEqual(calls, [{ name: "core.layout.open", params: { card: "current", plugin: "example.terminal", params: { session: "s-1" } } }]);
});

test("showSession shows a session that a tab already shows again, because core.layout.open is idempotent", async () => {
  const { call, calls } = recorder(() => ({ card: "c-1", tab: "t-1" }));
  const sessions = [{ session: "s-1", plugin: "example.terminal", owner: "agents", shownBy: "t-1" }];
  await showSession(call, { session: "s-1" }, sessions);
  assert.equal(calls.length, 1);
});

test("showSession refuses a session that core.sessions does not list as open, and opens no tab", async () => {
  const { call, calls } = recorder();
  await assert.rejects(showSession(call, { session: "s-9" }, []), /session s-9 is not open/);
  assert.deepEqual(calls, []);
});

test("showSession refuses a value of core.sessions that is not a list", async () => {
  const { call } = recorder();
  await assert.rejects(showSession(call, { session: "s-1" }, null), /core.sessions is not a list/);
});
