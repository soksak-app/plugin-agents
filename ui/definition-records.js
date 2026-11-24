// The definition records of the definitions section (A5 in docs/features.md): one value per project under the key definitions
// (plugin.json data), an object of definition identifier to {name, account, plugin, role, cwd}. role is the core role identifier,
// equal to the definition identifier. plugin is the value of the setting terminalPlugin when the definition is made. program and
// args are not stored: they are resolved from the account, so a change of the account applies to every definition that names it.
// maker is optional: the identifier of the maker group whose listing stored the definition (docs/spec/makers.md#listing). A definition the
// person defines has no maker.

const WHERE = "projects.json plugins.agents.definitions";
const PLUGIN_ID = /^[a-z][a-z0-9-]{0,39}$/;
const MEMBERS = ["account", "cwd", "name", "plugin", "role"];
const OPTIONAL_MEMBERS = ["maker"];
const NAME_MAX = 40;

// Throws with the text of the rule when the value is not an object of definition identifier to the five members above, with the optional
// member maker, and names the file and the key so the person can find the stored value.
export function parseDefinitions(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${WHERE}: the value is not an object of definition identifier to {name, account, plugin, role, cwd}`);
  }
  for (const [id, record] of Object.entries(value)) {
    const keys = record !== null && typeof record === "object" && !Array.isArray(record) ? Object.keys(record) : null;
    const allowed = keys !== null && keys.every((key) => MEMBERS.includes(key) || OPTIONAL_MEMBERS.includes(key));
    if (!allowed || !MEMBERS.every((key) => keys.includes(key)) || keys.some((key) => typeof record[key] !== "string")) {
      throw new Error(`${WHERE}: definition ${id} must have the members account, cwd, name, plugin and role, and optionally maker`);
    }
  }
  return value;
}

// Returns a new object with the record of the identifier added, or replaced. The account must be one of the accounts, and the
// plugin, name and cwd are checked with the text of each rule. maker is stored when given, else the record of the identifier keeps the
// maker it has. The input is unchanged.
export function defineDefinition(definitions, accounts, { id, name, account, plugin, cwd, maker }) {
  parseDefinitions(definitions);
  if (typeof id !== "string" || id.length === 0) throw new Error("definition identifier must be a non-empty text");
  if (maker !== undefined && (typeof maker !== "string" || maker === "")) throw new Error("definition maker must be a non-empty text");
  const trimmed = typeof name === "string" ? name.trim() : "";
  if ([...trimmed].length < 1 || [...trimmed].length > NAME_MAX) throw new Error(`definition name must be 1 to ${NAME_MAX} characters`);
  if (!accounts.some((entry) => entry.id === account)) throw new Error(`account ${account} is not defined`);
  if (typeof plugin !== "string" || !PLUGIN_ID.test(plugin)) throw new Error(`definition plugin ${plugin} must be a plugin identifier`);
  if (typeof cwd !== "string" || !(cwd.startsWith("/") && !cwd.split("/").includes(".."))) {
    throw new Error("definition cwd must be an absolute path");
  }
  const kept = maker ?? (Object.hasOwn(definitions, id) ? definitions[id].maker : undefined);
  const record = { name: trimmed, account, plugin, role: id, cwd };
  if (kept !== undefined) record.maker = kept;
  return { ...definitions, [id]: record };
}

// Returns a new object without the record of the identifier. An identifier that the object does not hold is refused with the text of the rule.
export function removeDefinition(definitions, id) {
  parseDefinitions(definitions);
  if (!Object.hasOwn(definitions, id)) throw new Error(`definition ${id} is not defined`);
  const next = { ...definitions };
  delete next[id];
  return next;
}

// The identifiers of the definitions that name the account, in the order of the object.
export function definitionsUsingAccount(definitions, accountId) {
  parseDefinitions(definitions);
  return Object.keys(definitions).filter((id) => definitions[id].account === accountId);
}

// The definition with program and args of its account (docs/spec/definitions.md#resolution): the start values of an agent session. Refuses a missing definition, and a
// definition whose account the accounts do not define.
export function resolveDefinition(definitions, accounts, id) {
  parseDefinitions(definitions);
  if (!Object.hasOwn(definitions, id)) throw new Error(`definition ${id} is not defined`);
  const record = definitions[id];
  const account = accounts.find((entry) => entry.id === record.account);
  if (account === undefined) throw new Error(`definition ${id} uses account ${record.account} that is not defined`);
  // An account with a home starts its cli through env in that home, so the CLI uses the login of the account.
  const launch = account.home === null
    ? { program: account.cli, args: [...account.args] }
    : { program: "env", args: [`${account.home.variable}=${account.home.folder}`, account.cli, ...account.args] };
  return { id, name: record.name, account: record.account, plugin: record.plugin, ...launch, role: record.role, cwd: record.cwd };
}

