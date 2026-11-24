// The records and the write of a maker group (A17-3 and A17-4, docs/spec/makers.md#listing and docs/spec/makers.md#writing). listGroup plans
// the stored records of the group with the rules of makers.js and takes no sidecar, so a listing writes no file and defines no role.
// writeGroup checks every file, writes the folders and files through the files sidecar requests (makers-files.js), and defines each role
// with core.role.define. Nothing is written when a check fails; a repeated write is idempotent.
import { listRecords, writePlan } from "./makers.js";
import { checkFiles, writeFiles } from "./makers-files.js";

// The project root is an absolute path without a trailing slash; each role file is the absolute path of the file in that root.
function checkRoot(root) {
  if (typeof root !== "string" || !root.startsWith("/") || root.endsWith("/")) throw new Error("project root must be an absolute path without a trailing slash");
}

// Lists the group and returns the stored values {groups, definitions, accounts} after it. stored holds the current values of the project.
export function listGroup({ group, stored, plugin, root, dataFolder }) {
  checkRoot(root);
  return listRecords({ group, groups: stored.groups, definitions: stored.definitions, accounts: stored.accounts, plugin, cwd: root, dataFolder });
}

// Writes the group and returns {written}, the project paths of the files that were written. requests is the sidecar request function of
// createRequests, and define(params) is core.role.define.
export async function writeGroup({ group, root, requests, define }) {
  checkRoot(root);
  const plan = writePlan(group);
  await checkFiles(requests, group.id, plan.files);
  const written = await writeFiles(requests, plan);
  for (const role of plan.roles) {
    await define({ id: role.id, text: role.text, ko: role.ko, files: role.files.map((path) => `${root}/${path}`) });
  }
  return { written };
}

// The project keys whose stored value a listing changes, in the order of the keys: a value that equals the stored one is not written again.
export function storedChanges(before, after) {
  return ["groups", "definitions", "accounts"].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}
