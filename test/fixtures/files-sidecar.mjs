// The in-memory files sidecar of the import tests: it answers the operations of the declared wire contract (docs/spec/files.md of the
// sidecar repository) for one project, and each request it answered is in log. This fixture is the only sidecar of the import tests.
import { createHash } from "node:crypto";
import { createRequests } from "../../ui/makers-files.js";

const digest = (text) => createHash("sha256").update(text).digest("hex");

// The in-memory project of the fake sidecar: its folders and files, and each request it answered.
export function fakeSidecar() {
  const folders = new Set([""]);
  const files = new Map();
  const log = [];
  const modes = new Map();
  const answer = (body) => {
    log.push(body);
    const { operation, path, id } = body;
    if (path.startsWith("/") || path.split("/").includes("..")) return { id, error: `path must be relative: ${path}` };
    if (operation === "createFolder") {
      const parts = path.split("/");
      for (let i = 1; i <= parts.length; i += 1) {
        const prefix = parts.slice(0, i).join("/");
        if (files.has(prefix)) return { id, error: `not a folder: ${prefix}` };
        folders.add(prefix);
      }
      return { id };
    }
    if (operation === "list") {
      if (!folders.has(path)) return { id, error: `not a folder: ${path}` };
      const prefix = path === "" ? "" : `${path}/`;
      const names = new Set();
      for (const file of files.keys()) if (file.startsWith(prefix)) names.add(file.slice(prefix.length).split("/")[0]);
      for (const folder of folders) if (folder !== path && folder.startsWith(prefix) && folder !== "") names.add(folder.slice(prefix.length).split("/")[0]);
      const entries = [...names].filter((name) => name !== "").map((name) => ({ name, directory: folders.has(`${prefix}${name}`) }));
      return { id, entries };
    }
    if (operation === "read") {
      if (!files.has(path)) return { id, error: `no such file: ${path}` };
      const text = files.get(path);
      return { id, text, version: digest(text), newline: "lf", bom: false };
    }
    if (operation === "write") {
      if (files.has(path) && body.expect !== digest(files.get(path))) return { id, error: `changed on disk: ${path}` };
      if (!files.has(path) && body.expect !== null) return { id, error: `write expects a version for a new file: ${path}` };
      if (body.executable !== undefined && typeof body.executable !== "boolean") return { id, error: "write executable must be a boolean" };
      // The sidecar sets 0755 for an executable write and keeps the mode of an existing file; a new file gets 0644 here, a stand-in for 0666 under the umask.
      if (body.executable === true) modes.set(path, "0755");
      else if (!files.has(path)) modes.set(path, "0644");
      files.set(path, body.text);
      return { id, version: digest(body.text) };
    }
    return { id, error: `unknown operation ${operation}` };
  };
  return { answer, files, folders, log, modes };
}

// Connects createRequests to the fake: each request is answered and its reply is paired with it, as the sidecar replies.
export function connect(sidecar) {
  const requests = createRequests((body) => {
    const reply = sidecar.answer(body);
    queueMicrotask(() => requests.receive(reply));
    return Promise.resolve();
  });
  return requests;
}
