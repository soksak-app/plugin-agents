// The agent definitions section (A4, A5): lists the groups of the project with their roles, creates an empty group and defines
// a role in a group. The groups are project data under the key groups (plugin.json data), read and changed through the view
// bridge; the group rules are those of groups.js and the role rules those of roles.js. A role is defined and removed through
// core.role.define and core.role.remove, and its text is read from the status core.roles.
import { createExpose } from "@soksak/plugin-api";
import { createViewBridge } from "@soksak/plugin-api/view";
import { exposurePort } from "./exposure-port.js";
import { createGroup, parseGroups } from "./groups.js";
import { parseAccounts } from "./accounts.js";
import { defineDefinition, parseDefinitions, removeDefinition } from "./definition-records.js";
import { addMember, parseFiles, removeMember, roleRows } from "./roles.js";
import { createRequests } from "./makers-files.js";
import { listGroup, storedChanges, writeGroup } from "./makers-import.js";
import { MAKERS_POINT, parseMakerGroup } from "./makers.js";

const CREATE = "agents.group.create";
const DEFINE = "agents.definition.define";
const REMOVE = "agents.definition.remove";
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
const form = document.getElementById("create");
const input = document.getElementById("name");
const defineForm = document.getElementById("define");
const defineGroup = document.getElementById("define-group");
const defineAccount = document.getElementById("define-account");

// The values of the reads, each replaced when its watch delivers a new one: the groups, the accounts of the project and core.roles.
let groups = {};
let accounts = [];
let roles = null;

// Draws each group with its roles, and the group choice of the define form. Nothing is drawn before core.roles has arrived.
function render() {
  if (roles === null) return;
  const rows = roleRows(groups, roles);
  list.replaceChildren(...rows.map((row) => {
    const item = document.createElement("li");
    const head = document.createElement("p");
    head.textContent = `${row.name} (${row.members.length})`;
    const members = document.createElement("ul");
    members.replaceChildren(...row.members.map((member) => {
      const line = document.createElement("li");
      line.textContent = member.defined ? `${member.id}: ${member.text}` : `${member.id}: 정의되지 않음`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "제거";
      line.append(remove);
      // The button runs the command with its group and identifier; the binder connects the element to the declared command.
      exposure.bind(remove, REMOVE, { group: row.id, id: member.id }).catch((error) => reportError("agents.definitions", `bind ${member.id}: ${error?.message ?? error}`));
      return line;
    }));
    item.append(head, members);
    return item;
  }));
  const selected = defineGroup.value;
  defineGroup.replaceChildren(...rows.map((row) => {
    const option = document.createElement("option");
    option.value = row.id;
    option.textContent = row.name;
    return option;
  }));
  if (rows.some((row) => row.id === selected)) defineGroup.value = selected;
  const chosen = defineAccount.value;
  defineAccount.replaceChildren(...accounts.map((account) => {
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = account.id;
    return option;
  }));
  if (accounts.some((account) => account.id === chosen)) defineAccount.value = chosen;
  empty.hidden = rows.length > 0;
}

// Reads the groups of the project and draws them; a stored value that does not match the rule is written to the log.
async function reload() {
  try {
    groups = parseGroups((await bridge.runtime.data.get(KEY)) ?? {});
    accounts = parseAccounts((await bridge.runtime.data.get(ACCOUNTS)) ?? []);
    render();
  } catch (error) {
    reportError("agents.definitions", `groups could not be read: ${error?.message ?? error}`);
  }
}

// A new group identifier: a letter first, then the time and a random part, so two groups created at once differ.
const newId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// The command agents.group.create {name}: adds an empty group to the stored groups and returns its identifier.
async function create({ name }) {
  const id = newId();
  await bridge.runtime.data.change(KEY, (current) => createGroup(current, { id, name }));
  return { id };
}

// The plugin that runs a definition's session: the value of the setting terminalPlugin, read at the time of the definition.
async function terminalPlugin() {
  const settings = await bridge.runtime.settings.read();
  if (typeof settings?.terminalPlugin !== "string") throw new Error("the setting terminalPlugin is not a text");
  return settings.terminalPlugin;
}

// The command agents.definition.define {group, id, name, account, cwd, text, ko, files}: checks the group, the membership, the account
// and the record before core is called, defines the role with core.role.define, then stores the record and adds its identifier to the
// members of the group. A refusal of core writes nothing.
async function define({ group, id, name, account, cwd, text, ko, files }) {
  const current = parseGroups((await bridge.runtime.data.get(KEY)) ?? {});
  addMember(current, group, id);
  const accounts = parseAccounts((await bridge.runtime.data.get(ACCOUNTS)) ?? []);
  const plugin = await terminalPlugin();
  defineDefinition(parseDefinitions((await bridge.runtime.data.get(DEFINITIONS)) ?? {}), accounts, { id, name, account, plugin, cwd });
  const stored = await bridge.calls.request("core.role.define", { id, text, ko, files: parseFiles(files) });
  await bridge.runtime.data.change(DEFINITIONS, (value) => defineDefinition(value, accounts, { id: stored.id, name, account, plugin, cwd }));
  await bridge.runtime.data.change(KEY, (value) => addMember(value, group, stored.id));
  return { id: stored.id };
}

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

// The connected maker groups of agents.makers, each drawn by its name. A group is listed (docs/spec/makers.md#listing) on load and on each
// change of core.contributions, and written by the command agents.group.write {group}.
let makers = [];
function renderMakers() {
  const rows = makers.map((entry) => {
    const row = document.createElement("li");
    row.textContent = entry.item.name;
    return row;
  });
  document.getElementById("makers").replaceChildren(...rows);
  document.getElementById("no-makers").hidden = rows.length > 0;
}

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
      const next = listGroup({ group: contributed, stored, plugin: await terminalPlugin(), root: start.project.root });
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
    renderMakers();
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

// The forms enter their values through the inputs; Enter runs the command instead of submitting the page.
form.addEventListener("submit", (event) => event.preventDefault());
defineForm.addEventListener("submit", (event) => event.preventDefault());
await Promise.all([
  exposure.command(CREATE, create), bridge.commands.register(CREATE, create),
  exposure.command(DEFINE, define), bridge.commands.register(DEFINE, define),
  exposure.command(REMOVE, remove), bridge.commands.register(REMOVE, remove),
  exposure.command(WRITE, writeMaker), bridge.commands.register(WRITE, writeMaker),
]);
await exposure.mark(input, CREATE, {}, "name");
await exposure.delegate(form);
await exposure.mark(defineGroup, DEFINE, {}, "group");
await exposure.mark(defineAccount, DEFINE, {}, "account");
for (const [name, element] of [["id", "define-id"], ["name", "define-name"], ["cwd", "define-cwd"], ["text", "define-text"], ["ko", "define-ko"], ["files", "define-files"]]) {
  await exposure.mark(document.getElementById(element), DEFINE, {}, name);
}
await exposure.delegate(defineForm);
bridge.runtime.status.watch("core.roles", (value) => { roles = value; render(); });
bridge.runtime.data.on(() => { reload(); });
bridge.runtime.status.watch("core.contributions", () => { reloadMakers(); });
await reload();
await files.on(start.surface, onSidecar);
await files.onFailure(start.surface, onSidecarFailure);
await reloadMakers();
