// The paths of the tree library (@pierre/trees) for the trees of the agents sections (A29-2, A30). The library names a row by the last
// segment of its path and keeps one row per path, so a label that repeats among siblings carries its number.
// A folder path ends with `/`.

// A segment holds no `/`, which separates the segments of a path: a program path shows its last name.
function segment(text) {
  const name = text.slice(text.lastIndexOf("/") + 1);
  if (name.length === 0) throw new Error(`a tree row has no name: ${JSON.stringify(text)}`);
  return name;
}

/**
 * Returns {paths, items} for nodes, each {label, children} for a folder or {label, value} for a row. A segment is the label; labels that
 * repeat among siblings are `<label> #1`, `<label> #2` and so on in their order, so rows of one label stay distinct. items maps the
 * path of each row to its value.
 */
export function treePaths(nodes) {
  const paths = [];
  const items = new Map();
  const walk = (list, prefix) => {
    const labels = list.map((node) => segment(node.label));
    const count = new Map();
    for (const label of labels) count.set(label, (count.get(label) ?? 0) + 1); // default: a label not counted yet has no row
    const seen = new Map();
    list.forEach((node, index) => {
      const label = labels[index];
      const nth = (seen.get(label) ?? 0) + 1; // default: the first row of a label is number 1
      seen.set(label, nth);
      const name = count.get(label) > 1 ? `${label} #${nth}` : label;
      if (Array.isArray(node.children)) {
        paths.push(`${prefix}${name}/`);
        walk(node.children, `${prefix}${name}/`);
      } else {
        paths.push(`${prefix}${name}`);
        items.set(`${prefix}${name}`, node.value);
      }
    });
  };
  walk(nodes, "");
  return { paths, items };
}

/** The tree nodes of the running agents tree of runningTree: a group by its name, a card as `card`, a row by its name. */
export function runningNodes(tree) {
  return tree.map((node) => {
    if (node.kind === "group") return { label: node.name, children: runningNodes(node.children) };
    if (node.kind === "card") return { label: "card", children: runningNodes(node.children) };
    return { label: node.name, value: node };
  });
}

/** The tree nodes of the definitions rows of roleRows: a group by its name with its members, each by its identifier. */
export function definitionNodes(rows) {
  return rows.map((row) => ({
    label: row.name,
    children: row.members.map((member) => ({ label: member.id, value: { group: row.id, member } })),
  }));
}
