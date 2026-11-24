// The maker groups of a connected item (A17, A35, A37, docs/spec/makers.md): checks the group object of an item and plans the records of a
// listing (listRecords: the accounts, the definitions with the launch of the maker folder, the group record and the roles). No file is
// written into the project: a session loads the maker folder through the arguments and variables of its launch. The rules of the stored
// values are those of groups.js, roles.js, accounts.js and definition-records.js.
import { parseGroups } from "./groups.js";
import { addMember } from "./roles.js";
import { defineAccount, parseAccounts } from "./accounts.js";
import { defineDefinition, parseDefinitions } from "./definition-records.js";

// The extension point of the maker groups as the provider names it: the local name that plugin.json declares in extends. The
// contributions of the view bridge refuse the full name agents.makers (core docs/spec/plugins.md#extension-points).
export const MAKERS_POINT = "makers";

const CLIS = ["claude", "codex"];
const DEFINITION_ID_MAX = 64;
const GROUP_MEMBERS = ["agents", "clis", "folders", "id", "name", "plugin", "rules", "variables"];
const VARIABLE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

// The slug of an agent name (docs/spec/makers.md#listing): lower case, each run of characters outside a-z and 0-9 as one dash, the dashes
// at both ends removed. It may be empty; the caller refuses an empty slug.
export function agentSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// The definition identifier of an agent: the group identifier, a dash and the slug, cut to 64 characters. Refuses an empty slug and
// names the agent.
export function definitionIdentifier(groupId, name) {
  const slug = agentSlug(name);
  if (slug === "") throw new Error(`agent ${name} has an empty identifier slug`);
  return `${groupId}-${slug}`.slice(0, DEFINITION_ID_MAX);
}

// Throws unless the value is a relative path: text, no leading slash, no backslash and no .. segment.
function checkRelativePath(path, where) {
  if (typeof path !== "string" || path === "" || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) {
    throw new Error(`${where} must be a relative path without .. segments`);
  }
}

// Returns the group object of a connected item after the checks of docs/spec/makers.md. Throws with the text of the rule when a check fails.
export function parseMakerGroup(group, itemId) {
  if (group === null || typeof group !== "object" || Array.isArray(group)) throw new Error(`group of item ${itemId} is not an object`);
  for (const key of GROUP_MEMBERS) {
    if (!Object.hasOwn(group, key)) throw new Error(`group ${group.id ?? itemId} must have the member ${key}`);
  }
  const unknown = Object.keys(group).find((key) => !GROUP_MEMBERS.includes(key));
  if (unknown !== undefined) throw new Error(`group ${group.id ?? itemId} has the unknown member ${unknown}`);
  if (group.id !== itemId) throw new Error(`group identifier ${group.id} differs from the item identifier ${itemId}`);
  if (typeof group.name !== "string") throw new Error(`group ${group.id} member name must be text`);
  checkRelativePath(group.plugin, `group ${group.id} member plugin`);
  if (!Array.isArray(group.clis) || group.clis.some((cli) => !CLIS.includes(cli))) throw new Error(`group ${group.id} member clis must be a list of claude or codex`);
  for (const key of ["folders", "rules"]) {
    if (!Array.isArray(group[key]) || group[key].some((entry) => typeof entry !== "string")) {
      throw new Error(`group ${group.id} member ${key} must be a list of text`);
    }
  }
  if (group.folders.some((folder) => !folder.endsWith("/"))) throw new Error(`group ${group.id} member folders must end with /`);
  for (const folder of group.folders) checkRelativePath(folder, `group ${group.id} folder ${folder}`);
  if (group.variables === null || typeof group.variables !== "object" || Array.isArray(group.variables)) {
    throw new Error(`group ${group.id} member variables must be an object`);
  }
  for (const [name, value] of Object.entries(group.variables)) {
    if (!VARIABLE.test(name) || typeof value !== "string") throw new Error(`group ${group.id} variable ${name} must be a variable name with a text value`);
  }
  if (!Array.isArray(group.agents)) throw new Error(`group ${group.id} member agents must be a list`);
  for (const agent of group.agents) {
    if (typeof agent?.name !== "string" || !CLIS.includes(agent.cli)) throw new Error(`group ${group.id} agent must have name, path and cli claude or codex`);
    checkRelativePath(agent.path, `agent ${agent.name} path`);
    if (agent.port !== undefined && !Number.isInteger(agent.port)) throw new Error(`agent ${agent.name} port must be an integer`);
    if (agent.model !== undefined && typeof agent.model !== "string") throw new Error(`agent ${agent.name} model must be text`);
  }
  return group;
}

// The maker folder of a group: the installed folder of the item (core F1154) joined with plugin.
export function makerFolder(group, folder) {
  if (typeof folder !== "string" || !folder.startsWith("/") || folder.endsWith("/")) {
    throw new Error(`group ${group.id}: the installed folder of the item must be an absolute path without a trailing slash`);
  }
  return `${folder}/${group.plugin.replace(/\/$/, "")}`;
}

// The launch {args, env} of an agent of a checked group (docs/spec/makers.md#listing): the arguments and variables that its session adds to
// the resolution of its account. home is the home folder of the account or null; personHome is the home of the person, which a codex
// session gives to the commands that it runs.
export function launchOf(group, agent, { maker, home, account, personHome }) {
  const env = {};
  for (const [name, value] of Object.entries(group.variables)) {
    if (value.includes("{home}") && home === null) throw new Error(`group ${group.id} variable ${name} needs the home of account ${account}`);
    env[name] = value.replaceAll("{home}", home ?? "").replaceAll("{plugin}", maker);
  }
  if (agent.cli === "claude") return { args: ["--plugin-dir", maker, "--add-dir", maker], env };
  // codex reads the skills of $HOME/.agents/skills and has no option that names a skill folder for one run (agents A37 (9)).
  if (Object.hasOwn(group.variables, "HOME")) throw new Error(`group ${group.id} variable HOME is the maker folder of a codex session`);
  if (typeof personHome !== "string" || !personHome.startsWith("/")) throw new Error(`group ${group.id}: the home of the person must be an absolute path`);
  return { args: ["-c", `shell_environment_policy.set={HOME=${JSON.stringify(personHome)}}`], env: { ...env, HOME: maker } };
}

// The agents of a checked group with their definition identifiers. Refuses an identifier that repeats within the group, naming the agent.
function agentIdentifiers(group) {
  const agents = group.agents.map((agent) => ({ agent, id: definitionIdentifier(group.id, agent.name) }));
  const ids = new Set();
  for (const { agent, id } of agents) {
    if (ids.has(id)) throw new Error(`agent ${agent.name} repeats the identifier ${id} of the group`);
    ids.add(id);
  }
  return agents;
}

// Plans the stored records of a listing of a checked group (docs/spec/makers.md#listing). Returns {accounts, definitions, groups, roles}:
// the accounts after the listing (the accounts of each agent cli, created when none exists), the definitions with the maker member of the
// group and the launch of the maker folder, the group record with each agent identifier as a member, and the role of each agent with the
// absolute path of its file. folder is the installed folder of the item. Throws with the text of the rule before any value is returned
// when a check fails.
export function listRecords({ group, folder, personHome, groups, definitions, accounts, plugin, cwd, dataFolder }) {
  parseMakerGroup(group, group.id);
  parseGroups(groups);
  parseDefinitions(definitions);
  parseAccounts(accounts);
  const agents = agentIdentifiers(group);
  const maker = makerFolder(group, folder);
  // The accounts: the first account of each agent cli, or the account created from it (docs/spec/definitions.md#accounts-created-by-a-listing).
  let next = accounts;
  const accountOf = new Map();
  for (const { agent } of agents) {
    const found = next.find((entry) => entry.cli === agent.cli);
    if (found !== undefined) {
      accountOf.set(agent.cli, found.id);
      continue;
    }
    if (next.some((entry) => entry.id === agent.cli)) throw new Error(`account ${agent.cli} is defined with cli ${next.find((entry) => entry.id === agent.cli).cli}`);
    next = defineAccount(next, { id: agent.cli, cli: agent.cli, args: [], env: [] }, dataFolder);
    accountOf.set(agent.cli, agent.cli);
  }
  // The definitions: each agent with its account, the plugin of the terminal setting, the project root, its identifier as role and the group as maker.
  let nextDefinitions = definitions;
  for (const { agent, id } of agents) {
    try {
      const account = next.find((entry) => entry.id === accountOf.get(agent.cli));
      const launch = launchOf(group, agent, { maker, home: account.home?.folder ?? null, account: account.id, personHome });
      nextDefinitions = defineDefinition(nextDefinitions, next, { id, name: agent.name, account: account.id, plugin, cwd, maker: group.id, launch });
    } catch (error) {
      throw new Error(`agent ${agent.name}: ${error.message}`);
    }
  }
  // The group record: the group with its name, then each agent identifier added as a member unless the group holds it already.
  let nextGroups = Object.hasOwn(groups, group.id) ? groups : { ...groups, [group.id]: { name: group.name, members: [] } };
  nextGroups = { ...nextGroups, [group.id]: { ...nextGroups[group.id], name: group.name } };
  for (const { id } of agents) nextGroups = addMember(nextGroups, group.id, id);
  // The roles: each agent with the absolute path of its file in the maker folder, which core.role.define takes.
  const roles = agents.map(({ agent, id }) => ({
    id,
    text: `Follow the definition in ${maker}/${agent.path}.`,
    ko: `${maker}/${agent.path} 파일의 정의를 따른다.`,
    files: [`${maker}/${agent.path}`],
  }));
  return { accounts: next, definitions: nextDefinitions, groups: nextGroups, roles };
}
