// The writes of a maker group to the project (A17-3, docs/spec/makers.md#import) through the files sidecar of the view. createRequests
// pairs each request with its reply by identifier, and writeFiles makes the requests of the plan: createFolder for each folder and each
// parent of a file, list and read to find the current version of a file, and write with expect. The sidecar answers the operations of
// its wire contract (docs/spec/files.md of the sidecar repository).

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

// Writes the folders and files of a plan (docs/spec/makers.md#import) and returns the paths whose text was written. A file whose current
// text equals the new text is not written. A project path that is a folder is refused with its name.
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
    const directory = slash === -1 ? "" : file.path.slice(0, slash);
    const name = file.path.slice(slash + 1);
    await makeFolder(directory);
    const listing = await requests.request({ operation: "list", path: directory });
    const entry = listing.entries.find((item) => item.name === name);
    if (entry !== undefined && entry.directory) throw new Error(`${file.path} is a folder in the project`);
    let expect = null;
    if (entry !== undefined) {
      const current = await requests.request({ operation: "read", path: file.path });
      // The sidecar reports no mode, so an executable file is written again even when its text is current; that write sets 0755.
      if (current.text === file.text && current.bom === false && file.executable !== true) continue;
      expect = current.version;
    }
    await requests.request({ operation: "write", path: file.path, text: file.text, expect, bom: false, executable: file.executable === true });
    written.push(file.path);
  }
  return written;
}
