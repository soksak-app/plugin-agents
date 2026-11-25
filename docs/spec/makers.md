# Maker groups

[한국어](makers.ko.md)

The extension point `agents.makers` is declared in `plugin.json` `extends` as `makers`, with the version `0.0.1` and the item schema `id` and `name`, both required strings. A maker plugin contributes one group in `contributes` under `agents.makers`, with `range`, `module`, `id` and `name`. The `id` names the group and `name` is its display name.

## Export

The contributed `module` exports the function `group`. The provider imports the module and calls `group()` for each connected item, as the extension point rule of the core plugin specification states. `group()` takes no argument and returns the group object, or a promise of it. A group whose `id` differs from the item `id`, or whose object does not match the schema below, is an invalid item and is not shown.

`plugin` is a path relative to the installed folder of the contributing plugin, which the connected item gives as `folder` (core F1154); the `path` of each agent is relative to the folder that `plugin` names. Both use forward slashes and hold no leading slash and no `..` segment. The entries of `folders` are project paths of the same form.

## Group object

The group object has these members. Required members must be present; optional members are not declared by this interface, and a member outside this list makes the group invalid.

- `id`, `name`: the identifier and display name of the group, the same as the item.
- `plugin` (required): the maker folder, which the maker fills when it is packed and which no write changes. A Claude Code session of the group loads it twice: with `--plugin-dir`, which registers the hooks of its `hooks/hooks.json` and puts its `bin/` folder on the `PATH` of the Bash tool, and with `--add-dir`, which loads the agents of its `.claude/agents/` and the skills of its `.claude/skills/` under their own names, so the texts of the group call them as they are written. Its `.claude/rules/` holds the rule files that the texts name by the path `.claude/rules/...`, which the agents read from the added folder. A codex session of the group reads the skills of its `.agents/skills/`.
- `clis` (required): the CLIs that the group runs, each `claude` or `codex`. A group whose agents need claude hooks lists `claude` only.
- `agents` (required): the agent definitions. Each has `name`, `path` (the Markdown file of the definition, relative to the maker folder, such as `.claude/agents/manager-spec.md`), `cli` (`claude` or `codex`, required: the CLI that runs this agent), `port` (optional integer: the port of the agent's own web page, required when the agent serves one, such as the moai web view) and `model` (optional: the model of the definition).
- `variables` (required): environment variables of the agent process as an object of name to text. A value may hold the token `{home}`, the home folder of the agent account, and the token `{plugin}`, the absolute maker folder.
- `folders` (required): folders that the group creates in the project, each ending with `/`, such as `.moai/`, `.harness/` or `.superpowers/`.
- `rules` (required): instruction lines that the room appends to the agent prompt, such as the location rules of the group's outputs. An empty list is allowed.

The outputs of a group go only to the folders in `folders`. The rules of a group name these locations, for example `.superpowers/plans/` for plans. No file of the maker folder is written into a project, so a group runs only in the sessions that start with its folder and no other project or definition sees it.

The maker plugins that contribute groups are moai (`.moai/`, claude only, one port per agent for its web view), harness (`.harness/`) and superpowers (`.superpowers/`, locations in the rules). Each maker plugin corrects its own files and builds its maker folder from them when it is packed.

## Listing

When the definitions section reads a connected maker group, on load and on each change of the status `core.contributions`, it stores the records of the group and defines its roles without any user action. The listing writes no file. It checks the group object first, then plans the following values, and refuses the listing of that group with the text of the rule when a check fails, before any value is stored:

1. Each agent gets the definition identifier `<group id>-<slug>`. The slug is the agent `name` in lower case, with every run of characters outside `a-z` and `0-9` replaced by one `-`, the `-` at both ends removed, and the whole identifier cut to 64 characters. An empty slug, or an identifier that repeats within the group, refuses the listing and names the agent.
2. The account of an agent is the account whose `cli` equals the agent `cli`. When none exists, the listing creates it as defined in [definitions](definitions.md#accounts-created-by-a-listing).
3. The maker folder is `<folder>/<plugin>`, the installed folder of the item joined with `plugin`. The launch of each agent is `{args, env}`, the arguments and the environment variables that a session of the agent adds to the resolution of its account ([definitions](definitions.md#resolution)). `env` holds each entry of `variables`, with `{home}` replaced by the home folder of the account and `{plugin}` by the maker folder. For an agent of `claude`, `args` is `["--plugin-dir", <maker folder>, "--add-dir", <maker folder>]`. For an agent of `codex`, which reads the skills of `$HOME/.agents/skills/` and has no option that names a skill folder for one run, `env` also holds `HOME` set to the maker folder, and `args` is `["-c", "shell_environment_policy.set={HOME=\"<home of the person>\"}"]`, so the commands that codex runs keep the home of the person; the home of the person is the output of the declared program `person-home`, `printenv HOME`. A value with `{home}` whose account has no home refuses the listing with `group <id> variable <name> needs the home of account <account>`, and a codex group whose `variables` name `HOME` refuses it with `group <id> variable HOME is the maker folder of a codex session`.
4. The definition of each agent is `{name, account, plugin, role, cwd, maker, launch}`: `plugin` is the value of the setting `terminalPlugin`, `role` is the identifier, `cwd` is the project root of the window, `maker` is the identifier of the group and `launch` the launch of step 3 ([definitions](definitions.md#keys)).
5. The group record is stored under `groups` with its name, its members, which are the identifiers of the agents, and its leader: a new group takes its first member as leader, and a stored group keeps its leader ([leader](definitions.md#leader)).
6. The role of each agent is defined with `core.role.define {id, text, ko, files}`: `id` is the identifier, `files` holds the absolute path of the agent file, `<maker folder>/<path>`, and `text` and `ko` each name that file in one line.

Each of the keys `accounts`, `definitions` and `groups` is stored only when its value changes, and the roles are defined after the stored values. A second listing of an equal group stores nothing, and a definition or a member that the person added stays. A new installed folder, such as the folder of an updated maker, changes the launch and the role files, which the next listing stores.

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
    "variables": { "type": "object" },
    "folders": { "type": "array", "items": { "type": "string" } },
    "rules": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["id", "name", "plugin", "clis", "agents", "variables", "folders", "rules"]
}
```
