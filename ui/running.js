// The tree of the running agents section (A3 and A29 in docs/features.md): the group, card and tab tree of core.grid, with a row for
// each running agent CLI. An agent tab is a tab of any plugin whose params name a program (core docs/spec/agent-roles.md, the
// parameters of core.layout.open), a tab that shows an owned session whose params name one, or a tab whose program state names its
// app, such as a CLI that a person started in a shell (core docs/spec/program-state.md#value); the section names no plugin. Its name is
// its program, with its role after it. Its activity is the value of core.activity
// for the tab. Items of one level are in drawn order: by the top edge, then by the left edge.

const ACTIVITIES = ["attention", "failed", "running", "idle"];
const PROGRAM_STATES = ["idle", "working", "blocked"];

// The program state of a tab record from core.grid (core docs/spec/program-state.md#value): null, or an object whose only members are
// state, one of PROGRAM_STATES, pid, a positive integer or null, and app, the name of the program or null. Throws with the text of the
// rule when the member is missing or not of that form.
function programState(tab) {
  if (!Object.hasOwn(tab, "program")) throw new Error(`core.grid tab ${tab.tab} has no program member`);
  const { program } = tab;
  if (program === null) return null;
  const keys = program !== null && typeof program === "object" ? Object.keys(program).sort() : [];
  const shaped = keys.length === 3 && keys[0] === "app" && keys[1] === "pid" && keys[2] === "state";
  const pidOk = program?.pid === null || (Number.isInteger(program?.pid) && program.pid > 0);
  const appOk = program?.app === null || (typeof program?.app === "string" && program.app.length > 0);
  if (!shaped || !PROGRAM_STATES.includes(program.state) || !pidOk || !appOk) {
    throw new Error(`program of tab ${tab.tab} must be null or an object with state idle, working or blocked, pid an integer or null and app a text or null`);
  }
  return { state: program.state, pid: program.pid, app: program.app };
}

// The name of a running agent CLI from the params that started it: its program, and its role after it when it runs with one; null when
// the params name no program.
function agentName(params) {
  if (params === null || typeof params !== "object") return null;
  const { program, role } = params;
  if (typeof program !== "string" || program.length === 0) return null;
  return typeof role === "string" && role.length > 0 ? `${program} ${role}` : program;
}

// The program state of a core.sessions entry as the program of a row, {state, pid}; a session reports no process id.
function sessionProgram(entry) {
  if (entry.program === null) return null;
  if (!PROGRAM_STATES.includes(entry.program?.state)) throw new Error(`program of session ${entry.session} must be null or an object with state idle, working or blocked`);
  return { state: entry.program.state, pid: null };
}

/**
 * Returns the tree of the running agent CLIs of grid, a core.grid value, with activities, the core.activity tabs map of tab identifier to
 * activity, and sessions, the core.sessions list. Each node is {kind: "card", id, name, children}, named by the titles of the tabs of
 * the card joined with " · ", {kind: "group", id, name, children}, {kind: "tab", id, name, activity,
 * program} or {kind: "session", id, name, activity, program}. A tab node is a tab whose params name a program, or a tab that shows an
 * owned session whose params name one; a session node is an owned session that no tab shows, in the card of its owner tab, after the
 * tabs of that card. Each running CLI is its own row, named by agentName. program is the program state (null when there is none), and a
 * card or a group without a row is left out. Throws with the text of the rule when a value is not of the form the spec states.
 */
export function runningTree(grid, activities, sessions) {
  if (grid === null || typeof grid !== "object") throw new Error("core.grid is not an object");
  if (!Array.isArray(grid.cards)) throw new Error("core.grid has no cards list");
  if (!Array.isArray(grid.groups)) throw new Error("core.grid has no groups list");
  if (!Array.isArray(sessions)) throw new Error("core.sessions is not a list");
  const { cards, groups } = grid;
  const sessionOf = new Map(sessions.map((entry) => [entry.session, entry]));
  for (const [id, activity] of Object.entries(activities)) {
    if (activity !== null && !ACTIVITIES.includes(activity)) {
      throw new Error(`activity ${activity} of tab ${id} is not one of ${ACTIVITIES.join(", ")}`);
    }
  }

  // The tabs of one card that run an agent, as tab nodes in tab order.
  const cardTabs = (card) => {
    if (!Array.isArray(card.tabs)) throw new Error(`card ${card.id} has no tabs list`);
    const rows = card.tabs.flatMap((tab) => {
      const program = programState(tab);
      // A tab that shows an owned session runs the CLI that the session started.
      const shown = typeof tab.params?.session === "string" ? sessionOf.get(tab.params.session) : undefined;
      // A CLI that a person started in a shell has no params of a program and is named by the app of its program state.
      const name = agentName(shown === undefined ? tab.params : shown.params) ?? program?.app ?? null;
      return name === null ? [] : [{ kind: "tab", id: tab.tab, name, activity: activities[tab.tab] ?? null, program }];
    });
    const owners = new Set(card.tabs.map((tab) => tab.tab));
    for (const entry of sessions) {
      if (entry.shownBy !== null || !owners.has(entry.owner)) continue;
      const name = agentName(entry.params);
      if (name !== null) rows.push({ kind: "session", id: entry.session, name, activity: null, program: sessionProgram(entry) });
    }
    return rows;
  };

  // The items that stand directly in parent, each with the edges that order them, and the nodes that hold an agent tab.
  const level = (parent) => {
    const items = [];
    for (const card of cards) {
      if (card.parent !== parent) continue;
      const children = cardTabs(card);
      // A card has no name of its own; the card header shows the titles of its tabs, so the node is named by them in tab order.
      const name = card.tabs.map((tab) => tab.title).join(" · ");
      if (children.length > 0) items.push({ x: card.x, y: card.y, node: { kind: "card", id: card.id, name, children } });
    }
    for (const group of groups) {
      if (group.parent !== parent) continue;
      if (typeof group.group?.name !== "string") throw new Error(`group ${group.id} has no name`);
      const children = level(group.id);
      if (children.length > 0) {
        items.push({ x: group.x, y: group.y, node: { kind: "group", id: group.id, name: group.group.name, children } });
      }
    }
    return items.sort((a, b) => a.y - b.y || a.x - b.x).map((item) => item.node);
  };

  return level(null);
}
