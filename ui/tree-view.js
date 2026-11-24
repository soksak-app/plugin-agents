// The tree of an agents section, drawn by the tree library @pierre/trees (A29-2, A30), as the files plugin draws its file tree. The
// paths come from tree-paths.js. The library draws its rows in the open shadow root of its container and has no hook for a row element,
// so the view marks each drawn row with its command when the root changes, and the binder delegates the presses in that root.
import { FileTree, themeToTreeStyles } from "./vendor/trees.js";
import { treePaths } from "./tree-paths.js";
import { AGENT_ICON_SYMBOLS } from "./vendor/agent-icons.js";

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
// A row of an agent or a definition is a file of the library. Its icon slot shows the robot emoji (U+1F916) of the system emoji font
// in place of the file icon, and a row of a known agent CLI shows the icon of its program from @lobehub/icons-static-svg (A32).
const AGENT_ICON = "soksak-agent";
const SPRITES = `<svg xmlns="http://www.w3.org/2000/svg"><symbol id="${AGENT_ICON}" viewBox="0 0 24 24"><text x="12" y="20"
 font-size="22" text-anchor="middle">\u{1F916}</text></symbol>${Object.values(AGENT_ICON_SYMBOLS).join("")}</svg>`;

// The menu of a right click has the look of the core picker (core packages/workbench/app.css .picker): the card background, the
// theme border, a shadow, and one line per entry in the 12px text, with the inset color under the pointer. The library places the
// menu in the light DOM of its container, so the page style reaches it.
const MENU_CSS = `
.tree-menu{min-width:120px;padding:4px;background:var(--card);border:var(--bw) solid var(--edge);border-radius:6px;
  box-shadow:0 4px 12px rgb(0 0 0 / 0.24)}
.tree-menu button{display:block;width:100%;padding:4px 8px;border:0;border-radius:4px;background:transparent;color:var(--fg);
  font:inherit;font-family:var(--font);font-size:12px;text-align:left;white-space:nowrap;cursor:pointer}
.tree-menu button:hover{background:var(--inset)}
`;

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
 * is empty for no menu. rowOf may give a null command for a row that a press does not run. icon(value) is the program of the icon of a
 * row, a key of AGENT_ICON_SYMBOLS, or null for the robot icon. failed reports an error of a press.
 * folderAction(value) is the {name, label, title, command, params} of the control at the right end of a folder that carries a value: the
 * label is its text, its element name marks it, and a press runs the command; null for no control. activate is null or {command,
 * params(value)}: a double click on a row runs the command through the binder with the params of the row value, and a row whose params
 * are null runs nothing. Both read the values that treePaths keeps.
 */
export function createTreeView(holder, { exposure, rowOf, picked, detail, menu = () => [], icon = () => null, folderAction = () => null, activate = null, failed }) {
  let items = new Map();
  let folders = new Map();
  let syncing = false;
  if (!document.getElementById("tree-menu-style")) {
    const style = document.createElement("style");
    style.id = "tree-menu-style";
    style.textContent = MENU_CSS;
    document.head.append(style);
  }
  const tree = new FileTree({
    paths: [],
    density: "compact",
    itemHeight: ROW_HEIGHT,
    initialExpansion: "open",
    // The rows are agents and definitions, not files, so the library draws no file icon.
    flattenEmptyDirectories: false,
    icons: { set: "none", spriteSheet: SPRITES, remap: { "file-tree-icon-file": { name: AGENT_ICON, viewBox: "0 0 24 24" } } },
    unsafeCSS: SCROLLBAR,
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
      if (folders.has(item.path)) {
        const action = folderAction(folders.get(item.path));
        return action === null ? null : { text: action.label, title: action.title };
      }
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
  // The control of a folder is the text of its decoration, a span that the press runs. The library toggles a folder on a click of its row,
  // so the control is bound with stop and the click ends at the control. The library reuses a span for another row, so each span is bound
  // once and reads the action of its current row at the press; a span of a row without a control runs nothing.
  const boundControls = new WeakSet();
  const controlAction = (control) => {
    const path = control.closest("[data-item-path]")?.dataset.itemPath;
    return folders.has(path) ? folderAction(folders.get(path)) : null;
  };
  const markRows = () => {
    for (const row of root.querySelectorAll("[data-item-path]")) {
      const path = row.dataset.itemPath;
      const control = row.querySelector("[data-item-section='decoration'] span");
      if (control) {
        delete control.dataset.command;
        delete control.dataset.params;
        delete control.dataset.expose;
        control.removeAttribute("role");
        control.removeAttribute("aria-label");
      }
      if (folders.has(path)) {
        const action = folderAction(folders.get(path));
        if (action !== null && control) {
          control.dataset.expose = action.name;
          control.setAttribute("role", "button");
          control.setAttribute("aria-label", action.title);
          if (boundControls.has(control)) exposure.mark(control, action.command, action.params).catch(failed);
          else {
            boundControls.add(control);
            exposure.bind(control, action.command, () => controlAction(control).params, { stop: true, when: () => controlAction(control) !== null, failed })
              .catch(failed);
          }
        }
        continue;
      }
      if (!items.has(path)) continue;
      const { name, command, params } = rowOf(items.get(path));
      row.dataset.expose = name;
      if (command !== null) exposure.mark(row, command, params).catch(failed);
      // The library draws the file icon as <use href="#soksak-agent">; a row of a known program draws the symbol of its program.
      const program = icon(items.get(path));
      const use = row.querySelector("[data-item-section='icon'] use");
      if (use) use.setAttribute("href", `#${program === null ? AGENT_ICON : `${AGENT_ICON}-${program}`}`);
    }
  };
  exposure.delegate(root).catch(failed);
  // A double click on a row runs the command of activate through the binder, bound on the host of the shadow root with the dblclick
  // event; the params are those of the row under the pointer, read from the composed path of the event.
  if (activate !== null) {
    const rowParams = (event) => {
      const row = event.composedPath().find((node) => node.dataset?.itemPath !== undefined);
      return row && items.has(row.dataset.itemPath) ? activate.params(items.get(row.dataset.itemPath)) : null;
    };
    exposure.bind(root.host, activate.command, rowParams, { event: "dblclick", when: (event) => rowParams(event) !== null, failed }).catch(failed);
  }
  // The library reuses a row element for another item by changing its path, so a change of the path marks the rows again.
  new MutationObserver(markRows).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-item-path"] });
  const applyTheme = () => Object.entries(themeStyles()).forEach(([name, value]) => holder.style.setProperty(name, value));
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-mode"] });
  return {
    show(nodes) {
      const next = treePaths(nodes);
      items = next.items;
      folders = next.folders;
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
