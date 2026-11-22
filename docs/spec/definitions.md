# Agent definitions and accounts

[한국어](definitions.ko.md)

The agents plugin stores two project data keys (`plugin.json` `data`, [project data](https://github.com/soksak-app/core/blob/main/docs/spec/plugins.md#project-data)); each has format 1, the default when omitted, and the stored form `{format, value}` that the workbench writes.

## Keys

- `accounts`: an array of accounts, default `[]`. Each account is `{id, cli, args, env}`: `id` matches `^[a-z][a-z0-9-]{0,39}$` and is unique; `cli` is the program name of the agent CLI, 1 to 255 characters without white space or control characters; `args` is an array of text, one argument each; `env` is an array of unique environment variable names matching `^[A-Za-z_][A-Za-z0-9_]{0,127}$`. No variable value is stored.
- `definitions`: an object, default `{}`, of definition identifier to `{name, account, plugin, role, cwd}`. `name` is 1 to 40 characters; `account` names an account of `accounts`; `plugin` is the plugin that runs the session (the setting `terminalPlugin`, default `terminal`, when the definition was made); `role` is the core role identifier, equal to the definition identifier; `cwd` is an absolute path.

## Resolution

A definition's program and arguments are not stored. A reader resolves them from its account: `program` is the account's `cli` and `args` is its `args`. A definition whose account is not defined is refused, not resolved to a default.

## Refusals

A reader refuses a stored value of another form with an error that names `agents project data`, the key and the rule: for example `agents project data definitions: definition <id> must have the members account, cwd, name, plugin and role`. No value is converted.

## Readers

The clubhouse room reads both keys through `runtime.data.get {key, plugin: "agents"}` (core F1075) and applies the resolution above. It holds a copy of the resolution rule because no clause lets a dependency import this plugin's module.
