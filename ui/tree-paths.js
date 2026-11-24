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
 * Returns {paths, items, folders} for nodes, each {label, children} for a folder or {label, value} for a row. A folder may carry a value
 * too, which is kept in folders. A segment is the label; labels that repeat among siblings are `<label> #1`, `<label> #2` and so on in
 * their order, so rows of one label stay distinct. items maps the path of each row to its value, and folders the path of each valued
 * folder to its value.
 */
export function treePaths(nodes) {
  const paths = [];
  const items = new Map();
  const folders = new Map();
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
        if (node.value !== undefined) folders.set(`${prefix}${name}/`, node.value);
        walk(node.children, `${prefix}${name}/`);
      } else {
        paths.push(`${prefix}${name}`);
        items.set(`${prefix}${name}`, node.value);
      }
    });
  };
  walk(nodes, "");
  return { paths, items, folders };
}

/** The tree nodes of the running agents tree of runningTree: a group, a card and a row, each by its name. */
export function runningNodes(tree) {
  return tree.map((node) => {
    if (node.kind === "group") return { label: node.name, children: runningNodes(node.children) };
    if (node.kind === "card") return { label: node.name, children: runningNodes(node.children) };
    return { label: node.name, value: node };
  });
}

/**
 * The tree nodes of the definitions rows of roleRows: a group by its name with its members. records holds the stored definitions by
 * identifier; a member is drawn by the name of its definition, and by its identifier when it has no record.
 */
export function definitionNodes(rows, records = {}) {
  return rows.map((row) => ({
    label: row.name,
    value: { group: row.id },
    children: row.members.map((member) => ({
      label: Object.hasOwn(records, member.id) ? records[member.id].name : member.id,
      value: { group: row.id, member },
    })),
  }));
}

/**
 * The menu entries of a definition row of definitionNodes: the write of the maker group (agents.group.write, docs/spec/makers.md#writing)
 * when the group of the row is a connected maker group of makers, the identifiers of the connected items, then the removal of the
 * definition. The files of a maker group reach the project only through that write (A34).
 */
export function definitionMenu({ group, member }, makers) {
  const write = makers.includes(group) ? [{ label: "그룹 파일 쓰기", command: "agents.group.write", params: { group } }] : [];
  return [...write, { label: "삭제", command: "agents.definition.remove", params: { group, id: member.id } }];
}

// The app name of a known CLI that differs from its program name: Claude Code reports claude-code (terminal.program-state app).
const APP_PROGRAMS = { "claude-code": "claude" };

/**
 * Returns the program of known, a list of program names, that the row name starts with: the first word, the last segment of a path,
 * without case, with the app name of APP_PROGRAMS read as its program; null for another program (A32).
 */
export function iconProgram(name, known) {
  const word = name.split(" ")[0].toLowerCase();
  const program = word.slice(word.lastIndexOf("/") + 1);
  // default: a program whose app name is its program name has no entry in APP_PROGRAMS.
  const resolved = APP_PROGRAMS[program] ?? program;
  return known.includes(resolved) ? resolved : null;
}
