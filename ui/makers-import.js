// The import of a maker group into the project (A17-3 and A17-4, docs/spec/makers.md#import). importGroup plans the record with the rules of
// makers.js, writes the folders and files through the files sidecar requests (makers-files.js), and defines each role with core.role.define
// before it returns the stored values. Nothing is stored when a check or a write fails; a repeated import is idempotent.
import { importPlan } from "./makers.js";
import { writeFiles } from "./makers-files.js";

// Imports the group and returns the stored values {groups, definitions, accounts} after it. stored holds the current values of the project,
// requests is the sidecar request function of createRequests, and define(params) is core.role.define. The project root is an absolute path
// without a trailing slash; each role file is the absolute path of the file in that root.
export async function importGroup({ group, stored, plugin, root, requests, define }) {
  if (typeof root !== "string" || !root.startsWith("/") || root.endsWith("/")) throw new Error("project root must be an absolute path without a trailing slash");
  const plan = importPlan({ group, groups: stored.groups, definitions: stored.definitions, accounts: stored.accounts, plugin, cwd: root });
  await writeFiles(requests, plan);
  for (const role of plan.roles) {
    await define({ id: role.id, text: role.text, ko: role.ko, files: role.files.map((path) => `${root}/${path}`) });
  }
  return { groups: plan.groups, definitions: plan.definitions, accounts: [...stored.accounts, ...plan.accounts] };
}

// The project keys whose stored value an import changes, in the order of the keys: a value that equals the stored one is not written again.
export function storedChanges(before, after) {
  return ["groups", "definitions", "accounts"].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}
