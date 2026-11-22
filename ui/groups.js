// The group data of the definitions section (A4 in docs/features.md): one value per project under the key groups, an object
// of group identifier to {name, members}. Members are empty until A5 adds the definitions.

export const GROUP_NAME_MAX = 40;
// The form of a group identifier: lowercase letters, digits and hyphens, starting with a letter (the form of plugin identifiers).
const GROUP_ID = /^[a-z][a-z0-9-]{0,39}$/;

// Throws with the text of the rule when the value is not an object of group identifier to {name, members}.
export function parseGroups(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("groups data is not an object of group identifier to {name, members}");
  }
  for (const [id, group] of Object.entries(value)) {
    if (typeof group?.name !== "string") throw new Error(`group ${id} has no name`);
    if (!Array.isArray(group.members)) throw new Error(`group ${id} has no members list`);
  }
  return value;
}

// Returns a new object with the empty group added. Throws with the text of the rule when the name or the identifier is refused.
export function createGroup(groups, { id, name }) {
  parseGroups(groups);
  const trimmed = typeof name === "string" ? name.trim() : "";
  if ([...trimmed].length < 1 || [...trimmed].length > GROUP_NAME_MAX) {
    throw new Error(`group name must be 1 to ${GROUP_NAME_MAX} characters`);
  }
  if (!GROUP_ID.test(id)) throw new Error(`group identifier ${id} must match ${GROUP_ID.source}`);
  if (Object.hasOwn(groups, id)) throw new Error(`group ${id} already exists`);
  return { ...groups, [id]: { name: trimmed, members: [] } };
}

// The rows of the section: each group with its member count, in the code point order of its identifier.
export function groupRows(groups) {
  parseGroups(groups);
  return Object.keys(groups).sort().map((id) => ({ id, name: groups[id].name, count: groups[id].members.length }));
}
