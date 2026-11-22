// The tree of the running agents section (A3 in docs/features.md): the group, card and tab tree of core.grid, with the tabs
// that run an agent CLI. An agent tab is a tab of the terminal plugin whose params name a program (core docs/spec/agent-roles.md,
// the parameters of core.layout.open). Its name is its role, or else its program. Its activity is the value of core.activity
// for the tab. Items of one level are in drawn order: by the top edge, then by the left edge.

const ACTIVITIES = ["attention", "failed", "running", "idle"];

// The agent tab of a tab record, or null when the tab runs no agent CLI.
function agentName(tab) {
  if (tab.plugin !== "terminal" || tab.params === null || typeof tab.params !== "object") return null;
  const { program, role } = tab.params;
  if (typeof program !== "string" || program.length === 0) return null;
  return typeof role === "string" && role.length > 0 ? role : program;
}

/**
 * Returns the tree of the agent tabs of grid, a core.grid value, with activities, the core.activity tabs map of tab identifier to
 * activity. Each node is {kind: "card" | "group", id, children} or {kind: "tab", id, name, activity}, and a card or a group with
 * no agent tab is left out. Throws with the text of the rule when grid or an activity is not of the form the spec states.
 */
export function runningTree(grid, activities) {
  if (grid === null || typeof grid !== "object") throw new Error("core.grid is not an object");
  if (!Array.isArray(grid.cards)) throw new Error("core.grid has no cards list");
  if (!Array.isArray(grid.groups)) throw new Error("core.grid has no groups list");
  const { cards, groups } = grid;
  for (const [id, activity] of Object.entries(activities)) {
    if (activity !== null && !ACTIVITIES.includes(activity)) {
      throw new Error(`activity ${activity} of tab ${id} is not one of ${ACTIVITIES.join(", ")}`);
    }
  }

  // The tabs of one card that run an agent, as tab nodes in tab order.
  const cardTabs = (card) => {
    if (!Array.isArray(card.tabs)) throw new Error(`card ${card.id} has no tabs list`);
    return card.tabs.flatMap((tab) => {
      const name = agentName(tab);
      return name === null ? [] : [{ kind: "tab", id: tab.tab, name, activity: activities[tab.tab] ?? null }];
    });
  };

  // The items that stand directly in parent, each with the edges that order them, and the nodes that hold an agent tab.
  const level = (parent) => {
    const items = [];
    for (const card of cards) {
      if (card.parent !== parent) continue;
      const children = cardTabs(card);
      if (children.length > 0) items.push({ x: card.x, y: card.y, node: { kind: "card", id: card.id, children } });
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
