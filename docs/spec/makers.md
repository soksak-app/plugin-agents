# Maker groups

[한국어](makers.ko.md)

The extension point `agents.makers` is declared in `plugin.json` `extends` as `makers`, with the version `0.0.1` and the item schema `id` and `name`, both required strings. A maker plugin contributes one group in `contributes` under `agents.makers`, with `range`, `module`, `id` and `name`. The `id` names the group and `name` is its display name.

## Export

The contributed `module` exports the function `group`. The provider imports the module and calls `group()` for each connected item, as the extension point rule of the core plugin specification states. `group()` takes no argument and returns the group object, or a promise of it. A group whose `id` differs from the item `id`, or whose object does not match the schema below, is an invalid item and is not shown.

Paths in `files` and the `path` of each agent are project paths: forward slashes, no leading slash and no `..` segment. Each of them lies inside a folder of `folders`. The other paths of the group object are not read by the provider.

## Group object

The group object has these members. Required members must be present; optional members are not declared by this interface.

- `id`, `name`: the identifier and display name of the group, the same as the item.
- `plugin` (required): the folder of the corrected plugin that the agent CLI loads with its plugin directory option.
- `clis` (required): the CLIs that the group runs, each `claude` or `codex`. A group whose agents need claude hooks lists `claude` only.
- `agents` (required): the agent definitions. Each has `name`, `path` (the project path of the Markdown file of the definition, which must equal the `path` of one entry of `files`), `cli` (`claude` or `codex`, required: the CLI that runs this agent), `port` (optional integer: the port of the agent's own web page, required when the agent serves one, such as the moai web view) and `model` (optional: the model of the definition).
- `skills` (required): the folders of the skills of the group. Every file of a skill folder is an entry of `files`.
- `variables` (required): environment variables of the agent process as an object of name to value. A value may hold the token `{home}`, which the agents plugin replaces with the home folder of the agent account.
- `path` (required): folders that the agent process prepends to `PATH`.
- `folders` (required): folders that the group creates in the project, each ending with `/`, such as `.moai/`, `.harness/` or `.superpowers/`.
- `rules` (required): instruction lines that the room appends to the agent prompt, such as the location rules of the group's outputs. An empty list is allowed.
- `files` (required): the files of the group as `{path, text, executable?}` entries, `path` a project path inside a folder of `folders`, `text` the corrected content of the file and `executable` (optional boolean, default `false`) whether the write sets the execute bit of the file. The maker builds this list when it is packed, from its own corrected files. Each path is unique. A non-boolean `executable` makes the group invalid, as the schema below states.

The outputs of a group go only to the folders in `folders`. The rules of a group name these locations, for example `.superpowers/plans/` for plans.

The maker plugins that contribute groups are moai (`.moai/`, claude only, one port per agent for its web view), harness (`.harness/`) and superpowers (`.superpowers/`, locations in the rules). Each maker plugin corrects its own files and builds `files` from them when it is packed. The write writes exactly the paths of `files` and no other file: it never overwrites or removes a project file outside `files`. `folders` may name `.claude/`, which Claude Code reads for agents and skills, and the write does not refuse a path under it.

## Listing

When the definitions section reads a connected maker group, on load and on each change of the status `core.contributions`, it stores the records of the group without any user action. The listing writes no file and defines no role. It checks the group object first, then plans the following values, and refuses the listing of that group with the text of the rule when a check fails, before any value is stored:

1. Each agent gets the definition identifier `<group id>-<slug>`. The slug is the agent `name` in lower case, with every run of characters outside `a-z` and `0-9` replaced by one `-`, the `-` at both ends removed, and the whole identifier cut to 64 characters. An empty slug, or an identifier that repeats within the group, refuses the listing and names the agent.
2. The account of an agent is the account whose `cli` equals the agent `cli`. When none exists, the listing creates it as defined in [definitions](definitions.md#accounts-created-by-a-listing).
3. The definition of each agent is `{name, account, plugin, role, cwd, maker}`: `plugin` is the value of the setting `terminalPlugin`, `role` is the identifier, `cwd` is the project root of the window, and `maker` is the identifier of the group ([definitions](definitions.md#keys)).
4. The group record is stored under `groups` with its name and its members, which are the identifiers of the agents.

Each of the keys `accounts`, `definitions` and `groups` is stored only when its value changes. A second listing of an equal group changes nothing, and a definition or a member that the person added stays.

## Writing

The declared command `agents.group.write {group}` writes the files of a connected maker group and defines its roles. It checks every file before it makes the first write, and refuses the whole write with the text of the rule when a check fails:

1. Each `files` entry whose path exists in the project and whose current text differs from the entry text is refused with `maker <group>: <path> holds other content`. A path that does not exist, and a path whose current text equals the entry text, pass the check.
2. Each `folders` entry is created with `createFolder` of the files sidecar, relative to the project root. Each `files` entry is written with `write` of the files sidecar after its parent folders exist; a `files` path outside `folders` is refused. The request carries `executable` with the value of the entry, `false` when the entry has none. A file whose current text equals the entry text and that has no byte order mark is not written (a byte order mark is removed by a write), except an executable entry: the sidecar reports no mode, so an executable entry is written again with the current version of the file, which sets the mode to 0755 and keeps the text. The plugin declares the files sidecar at `>=0.0.13` in `plugin.json` `dependencies`, the version that reads `executable`; an older sidecar would ignore the member and create the file without the execute bit.
3. The definition of each agent takes the role file: `files` is the absolute path of the agent `path` entry of `files` in the project root (`core.role.define` takes absolute paths), and `text` and `ko` each name that file in one line. The role identifier is the identifier of the listing. Each role is defined with `core.role.define {id, text, ko, files}`.

The menu of a definition row whose group is a connected maker group has the entry `그룹 파일 쓰기`, which runs `agents.group.write {group}` with the identifier of that group, above the entry `삭제`.

The command returns `{written}`, the project paths of the `files` entries that the write wrote, in the order of `files`. An equal file is neither written nor listed. A refusal of core stops the command with its text; the files written before that refusal stay, and a repeated write writes only the files that differ.

Model and environment variables are not applied. The stored definition has no member for them ([definitions](definitions.md#keys)).

```json group-schema
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "plugin": { "type": "string" },
    "clis": { "type": "array", "items": { "type": "string", "enum": ["claude", "codex"] } },
    "agents": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "path": { "type": "string" },
          "cli": { "type": "string", "enum": ["claude", "codex"] },
          "port": { "type": "integer" },
          "model": { "type": "string" }
        },
        "required": ["name", "path", "cli"]
      }
    },
    "skills": { "type": "array", "items": { "type": "string" } },
    "variables": { "type": "object" },
    "path": { "type": "array", "items": { "type": "string" } },
    "folders": { "type": "array", "items": { "type": "string" } },
    "rules": { "type": "array", "items": { "type": "string" } },
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": { "path": { "type": "string" }, "text": { "type": "string" }, "executable": { "type": "boolean" } },
        "required": ["path", "text"]
      }
    }
  },
  "required": ["id", "name", "plugin", "clis", "agents", "skills", "variables", "path", "folders", "rules", "files"]
}
```
