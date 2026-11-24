// The rules of the dialogs of the definitions section (A28, A31): the name that the group dialog shows first, the parameters that the
// definition dialog sends to agents.definition.define and agents.definition.change, and the field values of a stored definition. The
// group rules are those of groups.js and the role rules those of roles.js.
import { parseGroups } from "./groups.js";

export const DEFAULT_GROUP_NAME = "default";
// The members of the parameters of the definition commands, in the order of the command declaration.
const DEFINITION_FIELDS = ["group", "id", "name", "account", "cwd", "text", "ko", "files"];

// The name that the group dialog shows: default while no stored group is named default, and empty otherwise. Throws with the text of the
// rule when groups is not the groups data.
export function defaultGroupName(groups) {
  parseGroups(groups);
  return Object.values(groups).some((group) => group.name === DEFAULT_GROUP_NAME) ? "" : DEFAULT_GROUP_NAME;
}

// The parameters of agents.definition.define and agents.definition.change from the values of the definition dialog. Each member is text;
// a value that is not text is refused with the name of its member, and the rules of each value are those of the command.
export function definitionParams(values) {
  return Object.fromEntries(DEFINITION_FIELDS.map((field) => {
    if (typeof values[field] !== "string") throw new Error(`definition field ${field} must be text`);
    return [field, values[field]];
  }));
}

// The field values of the definition dialog for a stored definition: its name, account and working folder from the record, and its text,
// Korean text and files from the role of core.roles with the identifier of the record. The files are one absolute path per line. Throws
// with the text of the rule when core.roles holds no such role.
export function definitionFormValues(record, roles) {
  if (roles === null || typeof roles !== "object" || !Array.isArray(roles.roles)) throw new Error("core.roles has no roles list");
  const role = roles.roles.find((entry) => entry.id === record.role);
  if (role === undefined) throw new Error(`role ${record.role} is not defined`);
  if (!Array.isArray(role.files)) throw new Error(`role ${record.role} has no files list`);
  return { name: record.name, account: record.account, cwd: record.cwd, text: role.text, ko: role.ko, files: role.files.join("\n") };
}
