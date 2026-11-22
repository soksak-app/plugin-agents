// The owned sessions of the running agents (A6, core docs/spec/plugins.md#owned-sessions). A session starts with core.session.open
// and belongs to the section that opens it, so no tab holds it; a tab shows it on request with core.layout.open, whose params
// name the session. The section names no plugin: the caller gives the plugin that runs the session. The call function is the
// view's core command call, which the rules below receive as an argument.

// Checks the size of a session: the card width and height in points and the backing scale of the window.
function checkSize(size) {
  if (size === null || typeof size !== "object") throw new Error("size must be an object");
  if (![size.width, size.height, size.scale].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("size width, height and scale must be positive numbers");
  }
}

/**
 * Starts a session of plugin with params and returns its identifier. Core refuses the open while plugin declares no sessions, and
 * that refusal is rethrown unchanged.
 */
export async function startSession(call, { plugin, params, size }) {
  if (typeof plugin !== "string" || plugin.length === 0) throw new Error("plugin must be a non-empty text");
  if (params === null || typeof params !== "object" || Array.isArray(params)) throw new Error("params must be an object");
  checkSize(size);
  const reply = await call("core.session.open", { plugin, params, size });
  const session = reply?.session;
  if (typeof session !== "string" || session === "") throw new Error("core.session.open reply has no session");
  return session;
}

/**
 * Shows session in the current card, where sessions is the value of core.sessions: the list of open sessions. Returns the card and
 * the tab that core.layout.open gives. A session that the list does not hold is refused, because core.layout.open would attach a tab
 * to a session that is not open.
 */
export async function showSession(call, { session }, sessions) {
  if (!Array.isArray(sessions)) throw new Error("core.sessions is not a list");
  const open = sessions.find((entry) => entry?.session === session);
  if (open === undefined) throw new Error(`session ${session} is not open`);
  return call("core.layout.open", { card: "current", plugin: open.plugin, params: { session } });
}
