// The owned sessions of the running agents (A6, core docs/spec/plugins.md#owned-sessions). A session that a plugin opened with
// core.session.open belongs to that plugin, so no tab holds it; a tab shows it on request with core.layout.open, whose params name
// the session. The call function is the view's core command call, which the rule below receives as an argument.

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
