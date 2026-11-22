// The definitions of the definitions section (A5 in docs/features.md): a definition is a role that belongs to one group. The
// members of a group are role identifiers only; the text, the Korean text and the files of a role are read from the status
// core.roles, so the instruction text lives only in roles.json. The group object is the one of ui/groups.js.
import { parseGroups } from "./groups.js";

// The files of a definition as the page enters them: one absolute path per line. Blank lines separate nothing and are skipped;
// the rules of an absolute path and of control characters are core's, which refuses them in core.role.define.
export function parseFiles(text) {
  if (typeof text !== "string") throw new Error("files must be text");
  return text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

// Returns a new groups object with the identifier added to the members of the group. A group that holds the identifier already
// keeps it once; a group that the project does not define, or a group of another member, is refused with the text of the rule.
export function addMember(groups, group, id) {
  parseGroups(groups);
  if (!Object.hasOwn(groups, group)) throw new Error(`group ${group} is not defined`);
  for (const [other, value] of Object.entries(groups)) {
    if (other !== group && value.members.includes(id)) throw new Error(`role ${id} is already in group ${other}`);
  }
  const members = groups[group].members.includes(id) ? groups[group].members : [...groups[group].members, id];
  return { ...groups, [group]: { ...groups[group], members } };
}

// Returns a new groups object without the identifier in the members of the group. A group that the project does not define, or an
// identifier that the group does not hold, is refused with the text of the rule.
export function removeMember(groups, group, id) {
  parseGroups(groups);
  if (!Object.hasOwn(groups, group)) throw new Error(`group ${group} is not defined`);
  if (!groups[group].members.includes(id)) throw new Error(`role ${id} is not a member of group ${group}`);
  return { ...groups, [group]: { ...groups[group], members: groups[group].members.filter((member) => member !== id) } };
}

// The rows of the section: each group in the code point order of its identifier, with each member's definition from the value of
// core.roles. A member that core.roles does not define is a row with defined false and null fields.
export function roleRows(groups, roles) {
  parseGroups(groups);
  if (roles === null || typeof roles !== "object") throw new Error("core.roles is not an object");
  if (!Array.isArray(roles.roles)) throw new Error("core.roles has no roles list");
  const byId = new Map(roles.roles.map((role) => [role.id, role]));
  return Object.keys(groups).sort().map((id) => ({
    id,
    name: groups[id].name,
    members: groups[id].members.map((member) => {
      const role = byId.get(member);
      return role === undefined
        ? { id: member, text: null, ko: null, files: null, defined: false }
        : { id: member, text: role.text, ko: role.ko, files: role.files, defined: true };
    }),
  }));
}
