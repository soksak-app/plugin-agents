# Maker groups

[한국어](makers.ko.md)

The extension point `agents.makers` is declared in `plugin.json` `extends` as `makers`, with the version `0.0.1` and the item schema `id` and `name`, both required strings. A maker plugin contributes one group in `contributes` under `agents.makers`, with `range`, `module`, `id` and `name`. The `id` names the group and `name` is its display name.

## Export

The contributed `module` exports the function `group`. The provider imports the module and calls `group()` for each connected item, as the extension point rule of the core plugin specification states. `group()` takes no argument and returns the group object, or a promise of it. A group whose `id` differs from the item `id`, or whose object does not match the schema below, is an invalid item and is not shown.

Paths in the group object are relative to the folder of the contributed group of the maker plugin: forward slashes, no leading slash and no `..` segment.

## Group object

The group object has these members. Required members must be present; optional members are not declared by this interface.

- `id`, `name`: the identifier and display name of the group, the same as the item.
- `plugin` (required): the folder of the corrected plugin that the agent CLI loads with its plugin directory option.
- `clis` (required): the CLIs that the group runs, each `claude` or `codex`. A group whose agents need claude hooks lists `claude` only.
- `agents` (required): the agent definitions. Each has `name` and `path` (a Markdown file of the definition), `cli` (`claude` or `codex`, required: the CLI that runs this agent), `port` (optional integer: the port of the agent's own web page, required when the agent serves one, such as the moai web view) and `model` (optional: the model of the definition, applied to the session).
- `skills` (required): the folders of the skills of the group.
- `variables` (required): environment variables of the agent process as an object of name to value. A value may hold the token `{home}`, which the agents plugin replaces with the home folder of the agent account.
- `path` (required): folders that the agent process prepends to `PATH`.
- `folders` (required): folders that the group creates in the project, each ending with `/`, such as `.moai/`, `.harness/` or `.superpowers/`.
- `rules` (required): instruction lines that the room appends to the agent prompt, such as the location rules of the group's outputs. An empty list is allowed.

The outputs of a group go only to the folders in `folders`. The rules of a group name these locations, for example `.superpowers/plans/` for plans.

The maker plugins that contribute groups are moai (`.moai/`, claude only, one port per agent for its web view), harness (`.harness/`) and superpowers (`.superpowers/`, locations in the rules). Each maker plugin corrects and copies its own files at installation; the agents plugin does not read the corrected content.

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
    "rules": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["id", "name", "plugin", "clis", "agents", "skills", "variables", "path", "folders", "rules"]
}
```
