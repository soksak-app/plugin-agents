# Agent definitions and accounts

[한국어](definitions.ko.md)

The agents plugin stores two project data keys (`plugin.json` `data`, [project data](https://github.com/soksak-app/core/blob/main/docs/spec/plugins.md#project-data)); each has format 1, the default when omitted, and the stored form `{format, value}` that the workbench writes.

## Keys

- `accounts`: an array of accounts, default `[]`. Each account is `{id, cli, args, env, home}`: `id` matches `^[a-z][a-z0-9-]{0,39}$` and is unique; `cli` is the program name of the agent CLI, 1 to 255 characters without white space or control characters; `args` is an array of text, one argument each; `env` is an array of unique environment variable names matching `^[A-Za-z_][A-Za-z0-9_]{0,127}$`. No variable value is stored. `home` is `null` or `{variable, folder}`, the configuration home of the account ([account homes](#account-homes)).
- `definitions`: an object, default `{}`, of definition identifier to `{name, account, plugin, role, cwd}` with the optional members `maker` and `launch`. `name` is 1 to 40 characters; `account` names an account of `accounts`; `plugin` is the plugin that runs the session (the setting `terminalPlugin`, default `terminal`, when the definition was made); `role` is the core role identifier, equal to the definition identifier; `cwd` is an absolute path. `maker`, when present, is the identifier of the maker group whose listing stored the definition ([makers](makers.md#listing)); a definition that the person defines has no `maker`, and defining an identifier again keeps its `maker`. `launch`, present exactly when `maker` is, is `{args, env}`: `args` an array of text and `env` an object of variable name, matching `^[A-Za-z_][A-Za-z0-9_]{0,127}$`, to text, the arguments and variables that the listing gives a session of the maker folder ([makers](makers.md#listing)). Changing a definition keeps its `launch`.

## Accounts created by a listing

When a maker group is listed ([makers](makers.md#listing)) and no account has the `cli` of an agent, the listing creates the account `{id: <cli>, cli: <cli>, args: [], env: [], home}` with the home of [account homes](#account-homes). An account that already has the identifier `<cli>` with another `cli` refuses the listing and names that account. No other account is created by a listing.

## Account homes

An agent CLI keeps its login and settings in a configuration home, so two accounts of one CLI hold two logins only when each has its own home. The last path segment of `cli` decides the home: `claude` reads it from the variable `CLAUDE_CONFIG_DIR` and `codex` from `CODEX_HOME`; an account of another CLI has `home: null`. When the plugin defines an account of `claude` or `codex`, through `agents.account.define` or a listing, it sets `home` to `{variable, folder}` with `folder` equal to `<dataFolder>/accounts/<id>`, where `dataFolder` is the data folder of the plugin in the start values of the view ([start values](https://github.com/soksak-app/core/blob/main/docs/spec/native-surfaces.md#view-surfaces)), and it creates the folder with the declared program `account-home`, `mkdir -p -m 700 <folder>`, before it stores the account. The folder depends only on the identifier, so the accounts with one identifier in all projects share one home and its login. Removing an account keeps its home, because another project may name the same identifier.

The login of a home is read without its secret:

- `claude`: the program `claude-login`, `security find-generic-password -s "Claude Code-credentials-<hash>"`, where `<hash>` is the first 8 hexadecimal digits of the SHA-256 of `folder`; the CLI keeps the login of a home in that keychain item. Exit status 0 is `true` and 44 is `false`.
- `codex`: the program `codex-login`, `test -f <folder>/auth.json`. Exit status 0 is `true` and 1 is `false`.
- An account with `home: null` has the login `null`. Any other exit status is an error that names the account and the status.

`agents.account.login {id}` opens a terminal tab in the current card with the plugin of the setting `terminalPlugin` and the parameters `{program: "env", args: ["<variable>=<folder>", <cli>, ...<login args>], title: "<id> 로그인"}`. The login arguments are `[]` for `claude`, whose first start in an empty home asks for the login, and `["login"]` for `codex`. An account with `home: null` is refused with `account <id> has no home`, and an identifier that no account has with `account <id> is not defined`.

## Resolution

A definition's program and arguments are not stored. A reader resolves them from its account: for an account with a home, `program` is `env` and `args` is `["<variable>=<folder>", <cli>, ...<args>]`, so the CLI starts in the home of the account and uses its login; for an account with `home: null`, `program` is the account's `cli` and `args` is its `args`. A definition with `launch` adds the entries of `launch.env`, sorted by name, as `<name>=<value>` after the home variable, so `program` is `env` also for an account without a home, and appends `launch.args` after the arguments of the account. A definition whose account is not defined is refused, not resolved to a default.

## Refusals

A reader refuses a stored value of another form with an error that names `agents project data`, the key and the rule: for example `agents project data definitions: definition <id> must have the members account, cwd, name, plugin and role, and maker with launch or neither`. No value is converted.

## Readers

The clubhouse room reads both keys through `runtime.data.get {key, plugin: "agents"}` (core F1075) and applies the resolution above. It holds a copy of the resolution rule because no clause lets a dependency import this plugin's module.

## Controls and dialogs

The definitions section lists the groups with their definitions. Its controls run declared commands, and the forms that add a group or a definition, or change one, are dialogs of the window (`dialogs` of `plugin.json`, [dialogs](https://github.com/soksak-app/core/blob/main/docs/spec/plugins.md#dialogs)).

- The section declares the action `그룹 추가` with the icon `plus`, which core draws at the right end of the section header; it runs `agents.group.open`, which opens the dialog `group`. While there is no group the section shows the text `그룹이 없어요.` at its top.
- The group dialog has a name field, which holds `default` while no stored group is named `default` and is empty otherwise, and an add button. Enter in the field and the add button run `agents.group.create {name}`. A name that a group already has is refused, and the dialog shows the refusal and stores nothing. A stored group is added and the dialog closes with the identifier of the group.
- The `+` at the right end of a group row (element `agents.definitions.add-definition`) runs `agents.definition.open {group}`, which opens the dialog `definition` without an identifier, to add a definition to the group.
- A double click on a definition row runs `agents.definition.open {group, id}`, which opens the dialog `definition` with the identifier. The dialog shows the stored record and the role of `core.roles` with that identifier: the name, the account, the working folder, the role text, the Korean role text and the role files. Its save runs `agents.definition.change` and closes the dialog.
- The dialog `definition` has the fields name, account (a select of the stored accounts, each option labeled with the identifier and, for the login `false`, ` (로그인 필요)`), working folder, role text, Korean role text and role files, one absolute path per line. Its save runs `agents.definition.define {group, id, name, account, cwd, text, ko, files}`, where `id` is a new identifier made when the dialog opens. The save closes the dialog after the command succeeds.
- Under the account select the dialog has the button 로그인 (element `agents.definition-dialog.login`), enabled while the selected account has the login `false`, which runs `agents.account.login {id}` with the selected account and closes the dialog, because the login runs in the terminal tab that the dialog covers. A row 새 계정 holds an identifier field and a cli field and the button 추가 (elements `agents.definition-dialog.account-id`, `agents.definition-dialog.account-cli` and `agents.definition-dialog.account-add`), which runs `agents.account.define {id, cli, args: [], env: []}` and selects the new account. The dialog reads the login of each listed account when it opens and after an account is added, and publishes them as the status `agents.definition-dialog.accounts`, `{accounts: [{id, cli, login}]}` in the order of the identifiers.
- A refusal of a save or of an add is shown on the dialog page, its error display, with the text of the refusal, and recorded at that moment through `runtime.error`; the dialog stays open and the stored values are unchanged. Each field marks the save command with the parameter that it gives, so the fields are connected controls. The cancel button and Escape run `agents.dialog.cancel`, which closes the dialog without a change.

`agents.definition.change` runs the checks of `agents.definition.define`, requires the identifier to be a member of the group and a stored definition, redefines the role with `core.role.define` under the same identifier, and stores the name, the account and the working folder. The plugin, the maker and the launch of the record stay as they are.

The commands run in the document of the dialog that binds them, because a page runs only the commands it registers. The dialogs and the section share the rules in `ui/definition-commands.js`, and the pure rules of the forms are in `ui/dialog-rules.js`.
