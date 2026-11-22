// Checks the writes of a maker group to the project (A17-3, docs/spec/makers.md#import): the requests to the files sidecar
// (ui/makers-files.js), with createFolder for each folder, list and read to find the current version, and write with expect for each
// file. The fake sidecar answers the operations of the declared wire contract (docs/spec/files.md of the sidecar repository) in memory.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createRequests, writeFiles } from "../ui/makers-files.js";

const digest = (text) => createHash("sha256").update(text).digest("hex");

// The in-memory project of the fake sidecar: its folders and files, and each request it answered.
function fakeSidecar() {
  const folders = new Set([""]);
  const files = new Map();
  const log = [];
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
      files.set(path, body.text);
      return { id, version: digest(body.text) };
    }
    return { id, error: `unknown operation ${operation}` };
  };
  return { answer, files, folders, log };
}

// Connects the requests of createRequests to the fake: each request is answered as the sidecar replies, one reply per message.
function connect(sidecar) {
  let requests;
  requests = createRequests((body) => {
    const reply = sidecar.answer(body);
    queueMicrotask(() => requests.receive(reply));
    return Promise.resolve();
  });
  return requests;
}

const PLAN = {
  folders: [".moai/"],
  files: [
    { path: ".moai/agents/backend.md", text: "# Backend\n" },
    { path: ".claude/agents/reviewer.md", text: "# Reviewer\n" },
  ],
};

test("createRequests resolves a request with the reply that carries its identifier, and rejects a reply with an error", async () => {
  const sent = [];
  const requests = createRequests((body) => { sent.push(body); return Promise.resolve(); });
  const first = requests.request({ operation: "createFolder", path: "a" });
  const second = requests.request({ operation: "createFolder", path: "b" });
  assert.equal(sent[0].id !== sent[1].id, true);
  assert.equal(requests.receive({ id: sent[1].id, error: "not a folder: b" }), true);
  assert.equal(requests.receive({ id: sent[0].id }), true);
  await assert.rejects(second, /not a folder: b/);
  assert.deepEqual(await first, { id: sent[0].id });
  assert.equal(requests.receive({ id: "unknown" }), false);
});

test("writeFiles creates each folder and writes each file of a new project with expect null", async () => {
  const sidecar = fakeSidecar();
  const written = await writeFiles(connect(sidecar), PLAN);
  assert.deepEqual(written, [".moai/agents/backend.md", ".claude/agents/reviewer.md"]);
  assert.equal(sidecar.files.get(".moai/agents/backend.md"), "# Backend\n");
  assert.equal(sidecar.files.get(".claude/agents/reviewer.md"), "# Reviewer\n");
  assert.equal(sidecar.folders.has(".claude/agents"), true);
  assert.equal(sidecar.log.filter((body) => body.operation === "write").every((body) => body.expect === null), true);
});

test("writeFiles writes nothing for a file whose text is equal, and replaces a changed file with its current version", async () => {
  const sidecar = fakeSidecar();
  const requests = connect(sidecar);
  await writeFiles(requests, PLAN);
  sidecar.log.length = 0;
  assert.deepEqual(await writeFiles(requests, PLAN), []);
  assert.equal(sidecar.log.some((body) => body.operation === "write"), false);
  const changed = { folders: PLAN.folders, files: [{ path: ".moai/agents/backend.md", text: "# Backend v2\n" }] };
  assert.deepEqual(await writeFiles(requests, changed), [".moai/agents/backend.md"]);
  assert.equal(sidecar.files.get(".moai/agents/backend.md"), "# Backend v2\n");
});

test("writeFiles leaves a project file outside the files untouched", async () => {
  const sidecar = fakeSidecar();
  const requests = connect(sidecar);
  sidecar.folders.add(".moai");
  sidecar.files.set(".moai/user-notes.md", "mine\n");
  await writeFiles(requests, PLAN);
  assert.equal(sidecar.files.get(".moai/user-notes.md"), "mine\n");
});

test("writeFiles refuses a listed path whose name is a folder in the project, and reports the sidecar error", async () => {
  const sidecar = fakeSidecar();
  const requests = connect(sidecar);
  sidecar.folders.add(".moai/agents/backend.md");
  await assert.rejects(writeFiles(requests, PLAN), /backend\.md is a folder/);
});
