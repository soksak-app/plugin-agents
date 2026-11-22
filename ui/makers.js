// The import of a maker group (A17, docs/spec/makers.md#import): checks the group object of a connected item and plans the writes
// of the project, the accounts, the definitions and the group record. The writes themselves are made by the definitions section
// (ui/definitions.js); the rules of the stored values are those of groups.js, roles.js, accounts.js and definition-records.js.
import { parseGroups } from "./groups.js";
import { addMember } from "./roles.js";
import { defineAccount, parseAccounts } from "./accounts.js";
import { defineDefinition, parseDefinitions } from "./definition-records.js";

// The extension point of the maker groups as the provider names it: the local name that plugin.json declares in extends. The
// contributions of the view bridge refuse the full name agents.makers (core docs/spec/plugins.md#extension-points).
export const MAKERS_POINT = "makers";

const CLIS = ["claude", "codex"];
const DEFINITION_ID_MAX = 64;
const GROUP_MEMBERS = ["agents", "clis", "folders", "files", "id", "name", "path", "plugin", "rules", "skills", "variables"];

// The slug of an agent name (docs/spec/makers.md#import): lower case, each run of characters outside a-z and 0-9 as one dash, the dashes
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

// Throws unless the value is a relative project path: text, no leading slash, no backslash and no .. segment.
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
  if (group.id !== itemId) throw new Error(`group identifier ${group.id} differs from the item identifier ${itemId}`);
  if (typeof group.name !== "string" || typeof group.plugin !== "string") throw new Error(`group ${group.id} member name and plugin must be text`);
  if (!Array.isArray(group.clis) || group.clis.some((cli) => !CLIS.includes(cli))) throw new Error(`group ${group.id} member clis must be a list of claude or codex`);
  for (const key of ["folders", "path", "rules", "skills"]) {
    if (!Array.isArray(group[key]) || group[key].some((entry) => typeof entry !== "string")) {
      throw new Error(`group ${group.id} member ${key} must be a list of text`);
    }
  }
  if (group.folders.some((folder) => !folder.endsWith("/"))) throw new Error(`group ${group.id} member folders must end with /`);
  if (group.folders.some((folder) => { try { checkRelativePath(folder, "folder"); return false; } catch { return true; } })) {
    throw new Error(`group ${group.id} member folders must hold relative paths`);
  }
  if (group.variables === null || typeof group.variables !== "object" || Array.isArray(group.variables)) {
    throw new Error(`group ${group.id} member variables must be an object`);
  }
  if (!Array.isArray(group.files)) throw new Error(`group ${group.id} member files must be a list`);
  const paths = new Set();
  for (const file of group.files) {
    if (file === null || typeof file !== "object" || typeof file.text !== "string") throw new Error(`group ${group.id} file entry must have text`);
    checkRelativePath(file.path, `file ${file.path}`);
    if (!group.folders.some((folder) => file.path.startsWith(folder))) throw new Error(`file ${file.path} is not inside a folder of folders`);
    if (file.executable !== undefined && typeof file.executable !== "boolean") throw new Error(`file ${file.path} executable must be a boolean`);
    if (paths.has(file.path)) throw new Error(`file ${file.path} repeats`);
    paths.add(file.path);
  }
  if (!Array.isArray(group.agents)) throw new Error(`group ${group.id} member agents must be a list`);
  for (const agent of group.agents) {
    if (typeof agent?.name !== "string" || typeof agent.path !== "string" || !CLIS.includes(agent.cli)) {
      throw new Error(`group ${group.id} agent must have name, path and cli claude or codex`);
    }
    if (!paths.has(agent.path)) throw new Error(`agent ${agent.name} path ${agent.path} is not a path of files`);
    if (agent.port !== undefined && !Number.isInteger(agent.port)) throw new Error(`agent ${agent.name} port must be an integer`);
  }
  return group;
}

// Plans the import of a checked group object. Returns {folders, files, accounts, definitions, groups, roles}: the folders and files to write,
// the accounts to create, the stored definitions and groups records after the import, and the role of each agent for core.role.define.
// Throws with the text of the rule before any write when a check fails.
export function importPlan({ group, groups, definitions, accounts, plugin, cwd }) {
  parseMakerGroup(group, group.id);
  parseGroups(groups);
  parseDefinitions(definitions);
  parseAccounts(accounts);
  const agents = group.agents.map((agent) => ({ agent, id: definitionIdentifier(group.id, agent.name) }));
  const ids = new Set();
  for (const { agent, id } of agents) {
    if (ids.has(id)) throw new Error(`agent ${agent.name} repeats the identifier ${id} of the group`);
    ids.add(id);
  }
  // The accounts: the first account of each agent cli, or the account created from it (docs/spec/definitions.md#accounts-created-by-an-import).
  let next = accounts;
  const created = [];
  const accountOf = new Map();
  for (const { agent } of agents) {
    const found = next.find((entry) => entry.cli === agent.cli);
    if (found !== undefined) {
      accountOf.set(agent.cli, found.id);
      continue;
    }
    if (next.some((entry) => entry.id === agent.cli)) throw new Error(`account ${agent.cli} is defined with cli ${next.find((entry) => entry.id === agent.cli).cli}`);
    next = defineAccount(next, { id: agent.cli, cli: agent.cli, args: [], env: [] });
    created.push(next[next.length - 1]);
    accountOf.set(agent.cli, agent.cli);
  }
  // The definitions: each agent with its account, the plugin of the terminal setting, the project root and its identifier as role.
  let nextDefinitions = definitions;
  for (const { agent, id } of agents) {
    try {
      nextDefinitions = defineDefinition(nextDefinitions, next, { id, name: agent.name, account: accountOf.get(agent.cli), plugin, cwd });
    } catch (error) {
      throw new Error(`agent ${agent.name}: ${error.message}`);
    }
  }
  // The group record: the group with its name, then each agent identifier added as a member unless the group holds it already.
  let nextGroups = Object.hasOwn(groups, group.id) ? groups : { ...groups, [group.id]: { name: group.name, members: [] } };
  nextGroups = { ...nextGroups, [group.id]: { ...nextGroups[group.id], name: group.name } };
  for (const { id } of agents) nextGroups = addMember(nextGroups, group.id, id);
  const roles = agents.map(({ agent, id }) => ({
    id,
    text: `Follow the definition in ${agent.path}.`,
    ko: `${agent.path} 파일의 정의를 따른다.`,
    files: [agent.path],
  }));
  return { folders: [...group.folders], files: group.files.map((file) => ({ path: file.path, text: file.text, executable: file.executable === true })), accounts: created, definitions: nextDefinitions, groups: nextGroups, roles };
}
