// The listing of a maker group (A17-3, A35, A37, docs/spec/makers.md#listing). listGroup plans the stored records and the roles of the
// group with the rules of makers.js: no file is written into the project, because a session loads the maker folder through its launch.
import { listRecords } from "./makers.js";

// The project root is an absolute path without a trailing slash.
function checkRoot(root) {
  if (typeof root !== "string" || !root.startsWith("/") || root.endsWith("/")) throw new Error("project root must be an absolute path without a trailing slash");
}

// Lists the group and returns the stored values {groups, definitions, accounts} after it and the roles {id, text, ko, files} to define.
// stored holds the current values of the project, folder the installed folder of the item and personHome the home of the person.
export function listGroup({ group, folder, personHome, stored, plugin, root, dataFolder }) {
  checkRoot(root);
  return listRecords({ group, folder, personHome, groups: stored.groups, definitions: stored.definitions, accounts: stored.accounts, plugin, cwd: root, dataFolder });
}

// The project keys whose stored value a listing changes, in the order of the keys: a value that equals the stored one is not written again.
export function storedChanges(before, after) {
  return ["groups", "definitions", "accounts"].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}
