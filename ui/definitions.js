// The agent definitions section (A4, A5): lists the groups of the project with their roles, opens the dialogs that add a group or a
// definition (A28) and the dialog that changes a definition (A31). The groups are project data under the key groups (plugin.json data), read and changed through the view
// bridge; the group rules are those of groups.js and the role rules those of roles.js. A role is defined and removed through
// core.role.define and core.role.remove, and its text is read from the status core.roles.
import { createExpose } from "@soksak/plugin-api";
import { createViewBridge } from "@soksak/plugin-api/view";
import { exposurePort } from "./exposure-port.js";
import { parseGroups } from "./groups.js";
import { parseAccounts } from "./accounts.js";
import { parseDefinitions, removeDefinition } from "./definition-records.js";
import { removeMember, roleRows } from "./roles.js";
import { changeDefinitionRecord, createGroupRecord, defineDefinitionRecord, terminalPlugin } from "./definition-commands.js";
import { createRequests } from "./makers-files.js";
import { listGroup, storedChanges, writeGroup } from "./makers-import.js";
import { MAKERS_POINT, parseMakerGroup } from "./makers.js";
import { definitionMenu, definitionNodes } from "./tree-paths.js";
import { createTreeView } from "./tree-view.js";

const CREATE = "agents.group.create";
const DEFINE = "agents.definition.define";
const CHANGE = "agents.definition.change";
const REMOVE = "agents.definition.remove";
const OPEN_GROUP = "agents.group.open";
const OPEN_DEFINITION = "agents.definition.open";
const KEY = "groups";
const DEFINITIONS = "definitions";
const ACCOUNTS = "accounts";
const WRITE = "agents.group.write";
const SIDECAR = "@soksak/sidecar-files";

// Errors that occur before the bridge exists wait in losses and are written to the application log once it does.
const losses = [];
let reportError = (where, text) => losses.push([where, text]);
const bridge = createViewBridge({
  handler: window.webkit.messageHandlers["sok-view"],
  report: (event) => { if (event.kind !== "open-calls") reportError("view calls", JSON.stringify(event)); },
});
reportError = (where, text) => bridge.runtime.error(where, text);
for (const [where, text] of losses.splice(0)) reportError(where, text);

const start = window.sokSurface;
if (start === null || typeof start !== "object") throw new Error("the definitions section has no start values: window.sokSurface is missing");

const list = document.getElementById("groups");
const empty = document.getElementById("empty");
// The rules of the commands that the dialogs of this section serve too: each runs in its own document with the same bridge.
const api = { data: bridge.runtime.data, calls: bridge.calls, settings: bridge.runtime.settings };

// The values of the reads, each replaced when its watch delivers a new one: the groups of the project and core.roles.
let groups = {};
let records = {};
let roles = null;

// The tree of the groups and their definitions, drawn by the tree library (tree-view.js) once the binder exists. A right click on a
// definition opens a menu whose entries run agents.group.write for a connected maker group and agents.definition.remove with its group
// and identifier.
let tree = null;
const treeView = () => tree ??= createTreeView(list, {
  exposure,
  rowOf: () => ({ name: "agents.definitions.row", command: null, params: null }),
  picked: () => {},
  detail: ({ member }) => (member.defined ? null : "정의되지 않음"),
  // The + at the right end of a group row opens the dialog that adds a definition to the group; a double click on a definition row opens
  // the dialog of that definition.
  folderAction: ({ group }) => ({ name: "agents.definitions.add-definition", label: "+", title: "정의 추가", command: OPEN_DEFINITION, params: { group } }),
  activate: { command: OPEN_DEFINITION, params: ({ group, member }) => ({ group, id: member.id }) },
  menu: (value) => definitionMenu(value, makers.map((entry) => entry.item.id)),
  failed: (error) => reportError("agents.definitions", `row: ${error?.message ?? error}`),
});

// Draws each group with its roles. Nothing is drawn before core.roles has arrived.
function render() {
  if (roles === null) return;
  const rows = roleRows(groups, roles);
  treeView().show(definitionNodes(rows, records));
  // The tree fills the section, so it is hidden while there is no group and the empty text shows at the top.
  list.hidden = rows.length === 0;
  empty.hidden = rows.length > 0;
}

// Reads the groups and the definitions of the project and draws them; a stored value that does not match the rule is written to the log.
async function reload() {
  try {
    groups = parseGroups((await bridge.runtime.data.get(KEY)) ?? {});
    records = parseDefinitions((await bridge.runtime.data.get(DEFINITIONS)) ?? {});
    render();
  } catch (error) {
    reportError("agents.definitions", `groups could not be read: ${error?.message ?? error}`);
  }
}

// The command agents.group.create {name}: adds an empty group to the stored groups and returns its identifier.
const create = (params) => createGroupRecord(api, params);

// The command agents.group.open: opens the group dialog of the window, which runs agents.group.create. The dialog is not awaited, so the
// command ends when the dialog is open; a refusal of the dialog is written to the application log.
function openGroup() {
  openDialog("group", {});
  return null;
}

// The command agents.definition.open {group, id}: opens the definition dialog of the window for the group. Without id the dialog adds a
// definition to the group; with id it shows the stored definition for changing.
function openDefinition({ group, id }) {
  openDialog("definition", { group, id: id ?? null });
  return null;
}

function openDialog(name, params) {
  bridge.runtime.dialog(name, params).catch((error) => reportError("agents.definitions", `dialog ${name}: ${error?.message ?? error}`));
}

// The command agents.definition.define {group, id, name, account, cwd, text, ko, files} and agents.definition.change, whose rules are in
// definition-commands.js.
const define = (params) => defineDefinitionRecord(api, params);
const change = (params) => changeDefinitionRecord(api, params);

// The command agents.definition.remove {group, id}: checks the membership, removes the role with core.role.remove, then removes the
// record and the identifier from the members of the group. A refusal of core keeps the record and the member.
async function remove({ group, id }) {
  const current = parseGroups((await bridge.runtime.data.get(KEY)) ?? {});
  removeMember(current, group, id);
  const records = parseDefinitions((await bridge.runtime.data.get(DEFINITIONS)) ?? {});
  removeDefinition(records, id);
  await bridge.calls.request("core.role.remove", { id });
  await bridge.runtime.data.change(DEFINITIONS, (value) => removeDefinition(value, id));
  await bridge.runtime.data.change(KEY, (value) => removeMember(value, group, id));
  return null;
}

const exposure = createExpose(exposurePort(bridge, "agents.definitions", reportError), () => start.declarations);

// The files sidecar of the section writes the files of a maker group (A17-3). Its replies reach requests, which pairs each with its request.
const files = bridge.runtime.sidecar(SIDECAR);
const requests = createRequests((body) => files.send(start.surface, body, []));
const onSidecar = (body) => {
  if (!requests.receive(body)) reportError("agents.definitions", `files sidecar sent a message that no request waits for: ${JSON.stringify(body)}`);
};
const onSidecarFailure = (reason) => reportError("agents.definitions", `files sidecar failed: ${reason}`);

// The connected maker groups of agents.makers. A group is listed (docs/spec/makers.md#listing) on load and on each change of
// core.contributions, and written by the command agents.group.write {group}; its stored group shows in the tree.
let makers = [];

// The stored values that a listing reads: the groups, the definitions and the accounts of the project.
async function readStored() {
  return {
    groups: parseGroups((await bridge.runtime.data.get(KEY)) ?? {}),
    definitions: parseDefinitions((await bridge.runtime.data.get(DEFINITIONS)) ?? {}),
    accounts: parseAccounts((await bridge.runtime.data.get(ACCOUNTS)) ?? []),
  };
}

// Stores the records of each connected maker group for the keys that its listing changes. A group whose check fails is marked invalid and
// reported; the other groups are still listed. Each group reads the stored values again, so a listing sees the changes of the one before.
async function listMakers() {
  for (const entry of makers) {
    let contributed;
    try {
      contributed = parseMakerGroup(await (await import(entry.module)).group(), entry.item.id);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      entry.fail(text);
      reportError("agents.definitions", `maker group ${entry.item.id} is invalid: ${text}`);
      continue;
    }
    try {
      const stored = await readStored();
      const next = listGroup({ group: contributed, stored, plugin: await terminalPlugin(api), root: start.project.root });
      for (const key of storedChanges(stored, next)) await bridge.runtime.data.change(key, () => next[key]);
    } catch (error) {
      reportError("agents.definitions", `maker group ${entry.item.id} could not be listed: ${error?.message ?? error}`);
    }
  }
}

// The listings run one after another: each is queued behind the one before it.
let listing = Promise.resolve();

async function reloadMakers() {
  try {
    makers = await bridge.contributions(MAKERS_POINT);
  } catch (error) {
    reportError("agents.definitions", `maker groups could not be read: ${error?.message ?? error}`);
    return;
  }
  listing = listing.then(listMakers);
  await listing;
}

// The command agents.group.write {group}: writes the files of the maker group of the connected item with that identifier and defines its
// roles (docs/spec/makers.md#writing). The module's group() is checked first; an invalid group marks its item invalid. A refused file or a
// refusal of core stops the command with its text.
async function writeMaker({ group }) {
  const entry = makers.find((candidate) => candidate.item.id === group);
  if (entry === undefined) throw new Error(`maker group ${group} is not connected`);
  let contributed;
  try {
    contributed = parseMakerGroup(await (await import(entry.module)).group(), entry.item.id);
  } catch (error) {
    entry.fail(error instanceof Error ? error.message : String(error));
    throw error;
  }
  return writeGroup({ group: contributed, root: start.project.root, requests, define: (params) => bridge.calls.request("core.role.define", params) });
}

// The commands take their values from their caller. The header button and the + of a group row run the commands that open the dialogs
// (A28), and a double click on a definition row runs agents.definition.open with its identifier (A31).
await Promise.all([
  exposure.command(CREATE, create), bridge.commands.register(CREATE, create),
  exposure.command(DEFINE, define), bridge.commands.register(DEFINE, define),
  exposure.command(CHANGE, change), bridge.commands.register(CHANGE, change),
  exposure.command(REMOVE, remove), bridge.commands.register(REMOVE, remove),
  exposure.command(WRITE, writeMaker), bridge.commands.register(WRITE, writeMaker),
  exposure.command(OPEN_GROUP, openGroup), bridge.commands.register(OPEN_GROUP, openGroup),
  exposure.command(OPEN_DEFINITION, openDefinition), bridge.commands.register(OPEN_DEFINITION, openDefinition),
]);
bridge.runtime.status.watch("core.roles", (value) => { roles = value; render(); });
bridge.runtime.data.on(() => { reload(); });
bridge.runtime.status.watch("core.contributions", () => { reloadMakers(); });
await reload();
await files.on(start.surface, onSidecar);
await files.onFailure(start.surface, onSidecarFailure);
await reloadMakers();
