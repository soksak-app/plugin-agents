// The commands of the definitions section that add a group and define or change a definition (A4, A5, A28, A31). The definitions section
// and each dialog page serve them in their own document, so the rules run here with the view bridge of the document: api holds
// runtime.data, runtime.settings, runtime.program, the view calls of that bridge and dataFolder, the data folder of the plugin in the start
// values. The rules of each store are those of groups.js, accounts.js,
// definition-records.js and roles.js.
import { createGroup, parseGroups } from "./groups.js";
import { defineAccount, homeFolderArgs, loginOf, loginProgram, loginTab, parseAccounts, removeAccount } from "./accounts.js";
import { defineDefinition, definitionsUsingAccount, parseDefinitions } from "./definition-records.js";
import { addMember, parseFiles } from "./roles.js";

const GROUPS = "groups";
const DEFINITIONS = "definitions";
const ACCOUNTS = "accounts";

// A new identifier: the letter, the time and a random part, so two identifiers created at once differ.
const newId = (letter) => `${letter}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const newDefinitionId = () => newId("d");

// The plugin that runs a definition's session: the value of the setting terminalPlugin, read at the time of the definition.
export async function terminalPlugin(api) {
  const settings = await api.settings.read();
  if (typeof settings?.terminalPlugin !== "string") throw new Error("the setting terminalPlugin is not a text");
  return settings.terminalPlugin;
}

// The command agents.group.create {name}: adds an empty group to the stored groups and returns its identifier.
export async function createGroupRecord(api, { name }) {
  const id = newId("g");
  await api.data.change(GROUPS, (current) => createGroup(current, { id, name }));
  return { id };
}

// The command agents.definition.define {group, id, name, account, cwd, text, ko, files}: checks the group, the membership, the account
// and the record before core is called, defines the role with core.role.define, then stores the record and adds its identifier to the
// members of the group. A refusal of core writes nothing.
export async function defineDefinitionRecord(api, { group, id, name, account, cwd, text, ko, files }) {
  const current = parseGroups((await api.data.get(GROUPS)) ?? {});
  addMember(current, group, id);
  const accounts = parseAccounts((await api.data.get(ACCOUNTS)) ?? []);
  const plugin = await terminalPlugin(api);
  defineDefinition(parseDefinitions((await api.data.get(DEFINITIONS)) ?? {}), accounts, { id, name, account, plugin, cwd });
  const stored = await api.calls.request("core.role.define", { id, text, ko, files: parseFiles(files) });
  await api.data.change(DEFINITIONS, (value) => defineDefinition(value, accounts, { id: stored.id, name, account, plugin, cwd }));
  await api.data.change(GROUPS, (value) => addMember(value, group, stored.id));
  return { id: stored.id };
}

// The command agents.definition.change {group, id, name, account, cwd, text, ko, files}: changes the stored definition with the identifier,
// which must be a member of the group. The checks are those of agents.definition.define. The plugin and the maker of the record stay as
// they are; the role is redefined with core.role.define under the same identifier. A refusal of core writes nothing.
export async function changeDefinitionRecord(api, { group, id, name, account, cwd, text, ko, files }) {
  const groups = parseGroups((await api.data.get(GROUPS)) ?? {});
  if (!Object.hasOwn(groups, group)) throw new Error(`group ${group} is not defined`);
  if (!groups[group].members.includes(id)) throw new Error(`role ${id} is not a member of group ${group}`);
  const accounts = parseAccounts((await api.data.get(ACCOUNTS)) ?? []);
  const records = parseDefinitions((await api.data.get(DEFINITIONS)) ?? {});
  if (!Object.hasOwn(records, id)) throw new Error(`definition ${id} is not defined`);
  const { plugin } = records[id];
  defineDefinition(records, accounts, { id, name, account, plugin, cwd });
  const stored = await api.calls.request("core.role.define", { id, text, ko, files: parseFiles(files) });
  await api.data.change(DEFINITIONS, (value) => defineDefinition(value, accounts, { id: stored.id, name, account, plugin, cwd }));
  return { id: stored.id };
}

// Runs a declared program and returns its exit status; a run that the host refuses fails with its reason.
async function exitStatus(api, name, args) {
  const reply = await api.program.run(name, args);
  return reply.code;
}

// Creates the home folder of an account with the declared program account-home (mkdir -p -m 700), so the CLI finds its home.
export async function createHome(api, account) {
  if (account.home === null) return;
  const code = await exitStatus(api, "account-home", homeFolderArgs(account));
  if (code !== 0) throw new Error(`home of account ${account.id}: mkdir ended with status ${code}`);
}

// The command agents.account.define {id, cli, args, env}: adds the account with its home, or replaces the one with the same identifier,
// after the home folder exists (docs/spec/definitions.md#account-homes).
export async function defineAccountRecord(api, { id, cli, args, env }) {
  const next = defineAccount(parseAccounts((await api.data.get(ACCOUNTS)) ?? []), { id, cli, args, env }, api.dataFolder);
  await createHome(api, next.find((entry) => entry.id === id));
  await api.data.change(ACCOUNTS, (current) => defineAccount(parseAccounts(current ?? []), { id, cli, args, env }, api.dataFolder));
  return { id };
}

// The command agents.account.remove {id}: removes the account from the project and keeps its home, which another project may name. An
// account that a definition names is refused, because the definition would have no program to start.
export async function removeAccountRecord(api, { id }) {
  const users = definitionsUsingAccount(parseDefinitions((await api.data.get(DEFINITIONS)) ?? {}), id);
  if (users.length > 0) throw new Error(`account ${id} is used by definition ${users.join(", ")}`);
  await api.data.change(ACCOUNTS, (current) => removeAccount(parseAccounts(current ?? []), id));
  return null;
}

// The command agents.account.login {id}: opens a terminal tab in the current card that runs the login of the cli in the home of the account.
export async function loginAccount(api, { id }) {
  const account = parseAccounts((await api.data.get(ACCOUNTS)) ?? []).find((entry) => entry.id === id);
  if (account === undefined) throw new Error(`account ${id} is not defined`);
  const tab = loginTab(account, await terminalPlugin(api));
  await createHome(api, account);
  await api.calls.request("core.layout.open", tab);
  return { id };
}

// The login of each account, {id, cli, login}, in the order of the identifiers: true or false from the login program of its home, and
// null for an account without a home.
export async function accountLogins(api, accounts) {
  const rows = [];
  for (const account of [...accounts].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const program = await loginProgram(account);
    const login = program === null ? null : loginOf(account, await exitStatus(api, program.name, program.args));
    rows.push({ id: account.id, cli: account.cli, login });
  }
  return rows;
}
