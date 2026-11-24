# Maker group

[English](makers.md)

Extension point `agents.makers`는 `plugin.json`의 `extends`에 `makers`로 선언하며, version `0.0.1`과 항목 schema `id`, `name`(둘 다 필수 문자열)을 가진다. Maker plugin은 `contributes`의 `agents.makers` 아래에 group 하나를 `range`, `module`, `id`, `name`으로 기여한다. `id`는 group을 가리키고 `name`은 표시 이름이다.

## Export

기여된 `module`은 함수 `group`을 export한다. Provider는 module을 가져와 연결된 항목마다 `group()`을 호출한다. 이것은 core plugin specification의 extension point 규칙이다. `group()`은 인자가 없고 group object나 그 promise를 돌려준다. `id`가 항목의 `id`와 다르거나, object가 아래 schema에 맞지 않으면 그 항목은 invalid이며 보이지 않는다.

`plugin`은 기여한 plugin의 설치 folder를 기준으로 한 상대 경로이며, 연결된 항목이 그 folder를 `folder`로 준다(core F1154). 각 agent의 `path`는 `plugin`이 가리키는 folder 기준이다. 둘 다 슬래시를 쓰고, 앞에 `/`가 없고, `..` segment가 없다. `folders`의 항목은 같은 형식의 프로젝트 경로다.

## Group object

Group object는 다음 member를 가진다. 필수 member는 반드시 있어야 하며, 선택 member는 이 interface가 선언하지 않고, 이 목록 밖의 member는 group을 invalid로 만든다.

- `id`, `name`: group의 식별자와 표시 이름이다. 항목과 같다.
- `plugin`(필수): maker가 pack할 때 채우고 어떤 쓰기도 바꾸지 않는 maker folder다. group의 Claude Code session은 이것을 두 번 읽는다. `--plugin-dir`로는 `hooks/hooks.json`의 hook을 등록하고 `bin/` folder를 Bash tool의 `PATH`에 두며, `--add-dir`로는 `.claude/agents/`의 agent와 `.claude/skills/`의 skill을 자기 이름으로 읽으므로 group의 본문이 쓰인 그대로 그것을 부른다. 그 `.claude/rules/`는 본문이 `.claude/rules/...` 경로로 가리키는 rule 파일을 담으며, agent가 추가된 folder에서 읽는다. group의 codex session은 그 `.agents/skills/`의 skill을 읽는다.
- `clis`(필수): group이 실행하는 CLI 목록이며 각각 `claude` 또는 `codex`다. claude hook이 필요한 agent를 가진 group은 `claude`만 적는다.
- `agents`(필수): agent 정의 목록이다. 각 항목은 `name`, maker folder 기준의 정의 Markdown 파일 `path`(예: `.claude/agents/manager-spec.md`), `cli`(`claude` 또는 `codex`, 필수: 이 agent를 실행하는 CLI), `port`(선택 정수: agent 자신의 web page 포트이며, moai web view처럼 web page를 띄우는 agent에는 필수), `model`(선택: 정의의 model)을 가진다.
- `variables`(필수): agent process의 환경 변수를 이름에서 text로 가는 object로 준다. 값에는 agent 계정의 home folder인 토큰 `{home}`과 절대 maker folder인 토큰 `{plugin}`을 넣을 수 있다.
- `folders`(필수): group이 프로젝트에 만드는 폴더 목록이며, 각각 `/`로 끝난다. 예를 들어 `.moai/`, `.harness/`, `.superpowers/`다.
- `rules`(필수): room이 agent prompt에 덧붙이는 지시 줄 목록이다. group 산출물의 위치 규칙을 담는다. 빈 목록도 허용한다.

Group의 산출물은 `folders`의 폴더에만 간다. Group의 rule은 이 위치를 밝힌다. 예를 들어 plan은 `.superpowers/plans/`에 둔다. maker folder의 어떤 파일도 프로젝트에 쓰지 않으므로, group은 그 folder로 시작한 session에서만 실행되고 다른 프로젝트나 정의는 그것을 보지 않는다.

Group을 기여하는 maker plugin은 moai(`.moai/`, claude 전용, agent마다 web view 포트 하나), harness(`.harness/`), superpowers(`.superpowers/`, 위치는 rule에 적는다)다. 각 maker plugin은 자신의 파일을 교정하고, pack할 때 그 파일로 maker folder를 만든다.

## 목록

연결된 maker group을 정의 section의 view가 읽으면(load 시와 status `core.contributions`가 바뀔 때마다), 사용자 동작 없이 그 group의 기록을 저장하고 role을 정의한다. 목록은 파일을 쓰지 않는다. 목록은 먼저 group object를 검사한 뒤 다음 값을 계획하며, 검사가 하나라도 실패하면 어떤 값도 저장하기 전에 그 group의 목록을 규칙의 문장과 함께 거부한다.

1. 각 agent는 정의 식별자 `<group id>-<slug>`를 얻는다. Slug는 agent `name`을 소문자로 바꾸고, `a-z`와 `0-9` 밖의 문자가 연속한 부분을 `-` 하나로 바꾸고, 양 끝의 `-`를 뗀 뒤, 전체 식별자를 64자로 자른 값이다. 빈 slug이거나 group 안에서 식별자가 겹치면 목록을 거부하고 agent 이름을 밝힌다.
2. Agent의 계정은 `cli`가 agent의 `cli`와 같은 계정이다. 없으면 목록이 [definitions](definitions.ko.md#목록이-만든-계정)가 정한 대로 만든다.
3. maker folder는 항목의 설치 folder에 `plugin`을 이은 `<folder>/<plugin>`이다. 각 agent의 launch는 `{args, env}`이며, agent session이 계정의 해석([definitions](definitions.ko.md#해석))에 더하는 인자와 환경 변수다. `env`는 `variables`의 각 항목을 담으며, `{home}`은 계정의 home folder로, `{plugin}`은 maker folder로 바꾼다. `claude` agent의 `args`는 `["--plugin-dir", <maker folder>, "--add-dir", <maker folder>]`다. `codex`는 `$HOME/.agents/skills/`의 skill을 읽고 한 실행에 skill folder를 지정하는 option이 없으므로, `codex` agent의 `env`는 maker folder로 둔 `HOME`도 담고, `args`는 `["-c", "shell_environment_policy.set={HOME=\"<사람의 home>\"}"]`이므로 codex가 실행하는 명령은 사람의 home을 유지한다. 사람의 home은 선언된 program `person-home`, `printenv HOME`의 출력이다. 계정에 home이 없는데 `{home}`을 가진 값은 목록을 `group <id> variable <name> needs the home of account <account>`로 거부하고, `variables`가 `HOME`을 가진 codex group은 `group <id> variable HOME is the maker folder of a codex session`으로 거부한다.
4. 각 agent의 정의는 `{name, account, plugin, role, cwd, maker, launch}`다. `plugin`은 setting `terminalPlugin`의 값이고, `role`은 식별자이며, `cwd`는 창의 프로젝트 루트이고, `maker`는 group의 식별자, `launch`는 3단계의 launch다([definitions](definitions.ko.md#key)).
5. Group 기록은 `groups`에 이름과 member와 함께 저장하며, member는 agent 식별자다.
6. 각 agent의 role은 `core.role.define {id, text, ko, files}`로 정의한다. `id`는 식별자이고, `files`는 agent 파일의 절대 경로 `<maker folder>/<path>`를 담으며, `text`와 `ko`는 각각 그 파일을 밝히는 한 줄이다.

`accounts`, `definitions`, `groups` key는 각각 값이 바뀔 때만 저장하고, role은 저장한 뒤에 정의한다. 같은 group을 두 번 목록에 올리면 아무것도 저장하지 않으며, 사람이 더한 정의나 member는 남는다. 갱신된 maker의 folder처럼 설치 folder가 새로 바뀌면 launch와 role 파일이 바뀌고, 다음 목록이 그것을 저장한다.

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
