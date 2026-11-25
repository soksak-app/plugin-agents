// Checks the rules of the dialogs of the definitions section (A28, A31): the default name of the group dialog, the parameters of the
// definition commands from the dialog values, and the field values of a stored definition. The literal values are the expectations.
import assert from "node:assert/strict";
import test from "node:test";
import { definitionFormValues, definitionParams, defaultGroupName } from "../ui/dialog-rules.js";

test("defaultGroupName is default while no group has the name default, and empty when one does", () => {
  assert.equal(defaultGroupName({}), "default");
  assert.equal(defaultGroupName({ a: { name: "Alpha", members: [], leader: null } }), "default");
  assert.equal(defaultGroupName({ a: { name: "default", members: [], leader: null } }), "");
  assert.equal(defaultGroupName({ a: { name: "Default", members: [], leader: null } }), "default");
});

test("defaultGroupName refuses a value that is not the groups data", () => {
  assert.throws(() => defaultGroupName([]), /groups data is not an object/);
  assert.throws(() => defaultGroupName({ a: { members: [] } }), /group a has no name/);
});

test("definitionParams builds the parameters of the definition commands with each member as text", () => {
  const values = { group: "moai", id: "moai-lead", name: "Lead", account: "claude", cwd: "/work", text: "t", ko: "k", files: "/a.md\n/b.md" };
  assert.deepEqual(definitionParams(values), { group: "moai", id: "moai-lead", name: "Lead", account: "claude", cwd: "/work", text: "t", ko: "k", files: "/a.md\n/b.md" });
  assert.deepEqual(Object.keys(definitionParams(values)), ["group", "id", "name", "account", "cwd", "text", "ko", "files"]);
});

test("definitionParams refuses a member that is missing or is not text, with the name of the member", () => {
  const values = { group: "moai", id: "moai-lead", name: "Lead", account: "claude", cwd: "/work", text: "t", ko: "k", files: "" };
  assert.throws(() => definitionParams({ ...values, files: ["/a.md"] }), /definition field files must be text/);
  assert.throws(() => definitionParams({ ...values, cwd: undefined }), /definition field cwd must be text/);
});

test("definitionFormValues fills the fields from the record and the role of core.roles, with the files one per line", () => {
  const record = { name: "Lead", account: "claude", plugin: "terminal", role: "moai-lead", cwd: "/work" };
  const roles = { roles: [{ id: "other", text: "x", ko: "y", files: [] }, { id: "moai-lead", text: "t", ko: "k", files: ["/a.md", "/b.md"] }] };
  assert.deepEqual(definitionFormValues(record, roles), { name: "Lead", account: "claude", cwd: "/work", text: "t", ko: "k", files: "/a.md\n/b.md" });
});

test("definitionFormValues refuses a record whose role core.roles does not hold, and a roles value without a list", () => {
  const record = { name: "Lead", account: "claude", plugin: "terminal", role: "moai-lead", cwd: "/work" };
  assert.throws(() => definitionFormValues(record, { roles: [] }), /role moai-lead is not defined/);
  assert.throws(() => definitionFormValues(record, null), /core.roles has no roles list/);
});
