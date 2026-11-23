// The writes of a maker group to the project (A17-3, docs/spec/makers.md#writing) through the files sidecar of the view. createRequests
// pairs each request with its reply by identifier. checkFiles refuses a file that holds other content before any write, and writeFiles
// makes the requests of the plan: createFolder for each folder and each parent of a file, list and read to find the current version of a
// file, and write with expect. The sidecar answers the operations of its wire contract (docs/spec/files.md of the sidecar repository).

// Returns the request function of a sidecar session: request(body) sends body with a new identifier and resolves with the reply that
// carries it, or rejects with the error text of a reply that has one. receive(message) pairs a reply with its request and returns
// false for a message that no request waits for.
export function createRequests(send) {
  let next = 0;
  const waiting = new Map();
  return {
    request(body) {
      next += 1;
      const id = `makers-${next}`;
      return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        Promise.resolve(send({ ...body, id })).catch((error) => {
          waiting.delete(id);
          reject(error);
        });
      });
    },
    receive(message) {
      if (message === null || typeof message !== "object" || !Object.hasOwn(message, "id")) return false;
      const call = waiting.get(message.id);
      if (call === undefined) return false;
      waiting.delete(message.id);
      if (typeof message.error === "string") call.reject(new Error(message.error));
      else call.resolve(message);
      return true;
    },
  };
}

// Returns the reply of read for a project path {text, bom, version}, or undefined when no folder on its path holds it. Each name is
// looked up in the listing of its parent, so a folder that does not exist yet is not an error. A path whose folder is a file, or whose
// name is a folder, is refused with its path.
async function currentFile(requests, path) {
  const names = path.split("/");
  let directory = "";
  for (let i = 0; i < names.length; i += 1) {
    const here = directory === "" ? names[i] : `${directory}/${names[i]}`;
    const listing = await requests.request({ operation: "list", path: directory });
    const entry = listing.entries.find((item) => item.name === names[i]);
    if (entry === undefined) return undefined;
    const last = i === names.length - 1;
    if (!last && !entry.directory) throw new Error(`${here} is a file in the project`);
    if (last && entry.directory) throw new Error(`${path} is a folder in the project`);
    directory = here;
  }
  return requests.request({ operation: "read", path });
}

// Refuses the files of a group whose current text differs from the entry text, with the group and the path, before any write is made. A
// path that does not exist and a path whose text is equal pass. The check issues no write.
export async function checkFiles(requests, group, files) {
  for (const file of files) {
    const current = await currentFile(requests, file.path);
    if (current !== undefined && current.text !== file.text) throw new Error(`maker ${group}: ${file.path} holds other content`);
  }
}

// Writes the folders and files of a plan (docs/spec/makers.md#writing) and returns the paths whose text was written, in the order of the
// files. A file whose current text equals the new text is not written, except an executable file. A project path that is a folder is
// refused with its name. The caller runs checkFiles first; this function replaces a file that holds other content.
export async function writeFiles(requests, { folders, files }) {
  const made = new Set();
  const makeFolder = async (path) => {
    if (path === "" || made.has(path)) return;
    await requests.request({ operation: "createFolder", path });
    made.add(path);
  };
  for (const folder of folders) await makeFolder(folder.replace(/\/$/, ""));
  const written = [];
  for (const file of files) {
    const slash = file.path.lastIndexOf("/");
    await makeFolder(slash === -1 ? "" : file.path.slice(0, slash));
    const current = await currentFile(requests, file.path);
    // The sidecar reports no mode, so an executable file is written again even when its text is current; that write sets 0755.
    if (current !== undefined && current.text === file.text && current.bom === false && file.executable !== true) continue;
    await requests.request({ operation: "write", path: file.path, text: file.text, expect: current === undefined ? null : current.version, bom: false, executable: file.executable === true });
    written.push(file.path);
  }
  return written;
}
