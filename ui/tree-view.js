// The tree of an agents section, drawn by the tree library @pierre/trees (A29-2, A30), as the files plugin draws its file tree. The
// paths come from tree-paths.js. The library draws its rows in the open shadow root of its container and has no hook for a row element,
// so the view marks each drawn row with its command when the root changes, and the binder delegates the presses in that root.
import { FileTree, themeToTreeStyles } from "./vendor/trees.js";
import { treePaths } from "./tree-paths.js";

// The rows have the values of the files tree (the files plugin, ui/tree.js): the 12px text and the 20px row of the sidebar list, the
// 10px gutter, the 4pt scroll bar and the colors of the app tokens, so the trees of the sections look the same.
const ROW_HEIGHT = 20;
const GUTTER = 10;
const CHEVRON_INK = 2.5;
const ROW_INK = 5.5;
const SCROLLBAR = `
::-webkit-scrollbar{-webkit-appearance:none;width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(127,127,127,0.22);border-radius:2px}
::-webkit-scrollbar-thumb:hover{background:rgba(127,127,127,0.42)}
::-webkit-scrollbar-corner{background:transparent}
`;
// A row of an agent or a definition is a file of the library, which draws a file icon even with no icon set; the row hides it.
const NO_FILE_ICON = "[data-item-type='file'] > [data-item-section='icon']{display:none}";

/** The tree colors. Every color is a var() of the app tokens, so no default color of the library shows. */
function themeStyles() {
  const style = getComputedStyle(document.documentElement);
  const mode = document.documentElement.dataset.mode === "light" ? "light" : "dark";
  return {
    ...themeToTreeStyles({ type: mode, bg: style.getPropertyValue("--card").trim(), fg: style.getPropertyValue("--fg").trim() }),
    "--trees-font-size-override": "12px",
    "--trees-font-family-override": "var(--font)",
    "--trees-padding-inline-override": "0px",
    "--trees-item-margin-x-override": "0px",
    "--trees-item-padding-x-override": `${GUTTER + CHEVRON_INK - ROW_INK}px`,
    "--trees-bg-override": "var(--card)",
    "--trees-bg-muted-override": "var(--inset)",
    "--trees-fg-override": "var(--fg)",
    "--trees-fg-muted-override": "var(--muted)",
    "--trees-accent-override": "var(--rail)",
    "--trees-border-color-override": "var(--edge)",
    "--trees-selected-bg-override": "var(--chip-sel)",
    "--trees-selected-fg-override": "var(--fg)",
    "color-scheme": mode,
  };
}

/**
 * Draws a tree in holder and returns {show(nodes)}, which replaces the rows with the paths of nodes. exposure is the binder of the view;
 * rowOf(value) gives the {name, command, params} of a row, the element name and the command that a press of the row runs. picked(value)
 * is called with the value of the row that the person selects, or null when no row is selected. detail(value) is the text at the end of
 * a row, or null for none. menu(value) lists the {label, command, params} entries of the menu that a right click on a row opens, or
 * is empty for no menu. rowOf may give a null command for a row that a press does not run. failed reports an error of a press.
 */
export function createTreeView(holder, { exposure, rowOf, picked, detail, menu = () => [], failed }) {
  let items = new Map();
  let syncing = false;
  const tree = new FileTree({
    paths: [],
    density: "compact",
    itemHeight: ROW_HEIGHT,
    initialExpansion: "open",
    // The rows are agents and definitions, not files, so the library draws no file icon.
    flattenEmptyDirectories: false,
    icons: { set: "none" },
    unsafeCSS: SCROLLBAR + NO_FILE_ICON,
    composition: {
      contextMenu: {
        triggerMode: "right-click",
        // The menu of a row: a button per entry, each connected to its declared command, which closes the menu when pressed.
        render(item, context) {
          if (!items.has(item.path)) return null;
          const entries = menu(items.get(item.path));
          if (entries.length === 0) return null;
          const box = document.createElement("div");
          box.className = "tree-menu";
          for (const entry of entries) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = entry.label;
            button.addEventListener("click", () => context.close());
            exposure.bind(button, entry.command, entry.params, { failed }).catch(failed);
            box.append(button);
          }
          return box;
        },
      },
    },
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
      if (command !== null) exposure.mark(row, command, params).catch(failed);
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
