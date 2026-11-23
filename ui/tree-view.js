// The tree of an agents section, drawn by the tree library @pierre/trees (A29-2, A30), as the files plugin draws its file tree. The
// paths come from tree-paths.js. The library draws its rows in the open shadow root of its container and has no hook for a row element,
// so the view marks each drawn row with its command when the root changes, and the binder delegates the presses in that root.
import { FileTree, themeToTreeStyles } from "./vendor/trees.js";
import { treePaths } from "./tree-paths.js";

// The row height and the text size of the sidebar list, as the files tree has them.
const ROW_HEIGHT = 20;

/** The tree colors: every color is a token of the page, so no default color of the library shows. */
function themeStyles() {
  const style = getComputedStyle(document.documentElement);
  const mode = document.documentElement.dataset.mode === "light" ? "light" : "dark";
  return {
    ...themeToTreeStyles({ type: mode, bg: style.getPropertyValue("--card").trim(), fg: style.getPropertyValue("--fg").trim() }),
    "--trees-font-size-override": "12px",
    "--trees-font-family-override": "var(--font)",
    "--trees-bg-override": "var(--card)",
    "--trees-bg-muted-override": "var(--inset)",
    "--trees-fg-override": "var(--fg)",
    "--trees-fg-muted-override": "var(--muted)",
    "--trees-accent-override": "var(--rail)",
    "--trees-border-color-override": "var(--edge)",
  };
}

/**
 * Draws a tree in holder and returns {show(nodes)}, which replaces the rows with the paths of nodes. exposure is the binder of the view;
 * rowOf(value) gives the {name, command, params} of a row, the element name and the command that a press of the row runs. picked(value)
 * is called with the value of the row that the person selects, or null when no row is selected. detail(value) is the text at the end of
 * a row, or null for none. failed reports an error of a press.
 */
export function createTreeView(holder, { exposure, rowOf, picked, detail, failed }) {
  let items = new Map();
  let syncing = false;
  const tree = new FileTree({
    paths: [],
    density: "compact",
    itemHeight: ROW_HEIGHT,
    initialExpansion: "open",
    renderRowDecoration({ item }) {
      if (!items.has(item.path)) return null;
      const text = detail(items.get(item.path));
      return text === null ? null : { text };
    },
    onSelectionChange(selected) {
      if (syncing) return;
      const path = [...selected].reverse().find((one) => items.has(one));
      picked(path === undefined ? null : items.get(path));
    },
  });
  tree.render({ containerWrapper: holder });
  const root = tree.getFileTreeContainer()?.shadowRoot;
  if (!root) throw new Error("the tree library draws no shadow root for its rows");
  const markRows = () => {
    for (const row of root.querySelectorAll("[data-item-path]")) {
      if (!items.has(row.dataset.itemPath)) continue;
      const { name, command, params } = rowOf(items.get(row.dataset.itemPath));
      row.dataset.expose = name;
      exposure.mark(row, command, params).catch(failed);
    }
  };
  exposure.delegate(root).catch(failed);
  new MutationObserver(markRows).observe(root, { childList: true, subtree: true });
  const applyTheme = () => Object.entries(themeStyles()).forEach(([name, value]) => holder.style.setProperty(name, value));
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-mode"] });
  return {
    show(nodes) {
      const next = treePaths(nodes);
      items = next.items;
      syncing = true;
      try {
        tree.resetPaths(next.paths);
        for (const path of next.paths) if (path.endsWith("/")) tree.getItem(path)?.expand();
      } finally {
        syncing = false;
      }
      markRows();
    },
  };
}
