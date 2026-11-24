# Maker group

[English](makers.md)

Extension point `agents.makers`는 `plugin.json`의 `extends`에 `makers`로 선언하며, version `0.0.1`과 항목 schema `id`, `name`(둘 다 필수 문자열)을 가진다. Maker plugin은 `contributes`의 `agents.makers` 아래에 group 하나를 `range`, `module`, `id`, `name`으로 기여한다. `id`는 group을 가리키고 `name`은 표시 이름이다.

## Export

기여된 `module`은 함수 `group`을 export한다. Provider는 module을 가져와 연결된 항목마다 `group()`을 호출한다. 이것은 core plugin specification의 extension point 규칙이다. `group()`은 인자가 없고 group object나 그 promise를 돌려준다. `id`가 항목의 `id`와 다르거나, object가 아래 schema에 맞지 않으면 그 항목은 invalid이며 보이지 않는다.

`files`와 agent의 `path`는 프로젝트 경로다. 슬래시를 쓰고, 앞에 `/`가 없고, `..` segment가 없어야 한다. 각 경로는 `folders`의 폴더 안에 있다. Group object의 다른 경로는 provider가 읽지 않는다.

## Group object

Group object는 다음 member를 가진다. 필수 member는 반드시 있어야 하며, 선택 member는 이 interface가 선언하지 않는다.

- `id`, `name`: group의 식별자와 표시 이름이다. 항목과 같다.
- `plugin`(필수): agent CLI가 plugin 디렉터리 옵션으로 읽는 교정된 plugin 폴더다.
- `clis`(필수): group이 실행하는 CLI 목록이며 각각 `claude` 또는 `codex`다. claude hook이 필요한 agent를 가진 group은 `claude`만 적는다.
- `agents`(필수): agent 정의 목록이다. 각 항목은 `name`, 정의 Markdown 파일의 프로젝트 경로 `path`(`files` 항목 하나의 `path`와 같아야 한다), `cli`(`claude` 또는 `codex`, 필수: 이 agent를 실행하는 CLI), `port`(선택 정수: agent 자신의 web page 포트이며, moai web view처럼 web page를 띄우는 agent에는 필수), `model`(선택: 정의의 model)을 가진다.
- `skills`(필수): group의 skill 폴더 목록이다. Skill 폴더의 모든 파일은 `files`의 항목이다.
- `variables`(필수): agent process의 환경 변수를 이름에서 값으로 가는 object로 준다. 값에는 토큰 `{home}`을 넣을 수 있으며, agents plugin이 이것을 agent 계정의 home 폴더로 바꾼다.
- `path`(필수): agent process가 `PATH` 앞에 붙이는 폴더 목록이다.
- `folders`(필수): group이 프로젝트에 만드는 폴더 목록이며, 각각 `/`로 끝난다. 예를 들어 `.moai/`, `.harness/`, `.superpowers/`다.
- `rules`(필수): room이 agent prompt에 덧붙이는 지시 줄 목록이다. group 산출물의 위치 규칙을 담는다. 빈 목록도 허용한다.
- `files`(필수): group의 파일을 `{path, text, executable?}` 항목으로 준다. `path`는 `folders`의 폴더 안의 프로젝트 경로이고, `text`는 파일의 교정된 내용이며, `executable`(선택 boolean, 기본값 `false`)은 쓰기가 파일의 실행 bit를 설정할지 정한다. Maker가 pack할 때 교정된 자기 파일로 이 목록을 만든다. 각 path는 유일하다. Boolean이 아닌 `executable`은 아래 schema가 밝히듯 group을 invalid로 만든다.

Group의 산출물은 `folders`의 폴더에만 간다. Group의 rule은 이 위치를 밝힌다. 예를 들어 plan은 `.superpowers/plans/`에 둔다.

Group을 기여하는 maker plugin은 moai(`.moai/`, claude 전용, agent마다 web view 포트 하나), harness(`.harness/`), superpowers(`.superpowers/`, 위치는 rule에 적는다)다. 각 maker plugin은 자신의 파일을 교정하고, pack할 때 그 파일로 `files`를 만든다. 쓰기는 `files`의 path에만 쓰며 다른 파일은 쓰지 않는다. `files` 밖의 프로젝트 파일을 덮어쓰거나 지우지 않는다. `folders`에는 `.claude/`를 넣을 수 있다. Claude Code가 그 아래의 agent와 skill을 읽으며, 쓰기는 그 아래 path를 거부하지 않는다.

## 목록

연결된 maker group을 정의 section의 view가 읽으면(load 시와 status `core.contributions`가 바뀔 때마다), 사용자 동작 없이 그 group의 기록을 저장한다. 목록은 파일을 쓰지 않고 role을 정의하지 않는다. 목록은 먼저 group object를 검사한 뒤 다음 값을 계획하며, 검사가 하나라도 실패하면 어떤 값도 저장하기 전에 그 group의 목록을 규칙의 문장과 함께 거부한다.

1. 각 agent는 정의 식별자 `<group id>-<slug>`를 얻는다. Slug는 agent `name`을 소문자로 바꾸고, `a-z`와 `0-9` 밖의 문자가 연속한 부분을 `-` 하나로 바꾸고, 양 끝의 `-`를 뗀 뒤, 전체 식별자를 64자로 자른 값이다. 빈 slug이거나 group 안에서 식별자가 겹치면 목록을 거부하고 agent 이름을 밝힌다.
2. Agent의 계정은 `cli`가 agent의 `cli`와 같은 계정이다. 없으면 목록이 [definitions](definitions.ko.md#목록이-만든-계정)가 정한 대로 만든다.
3. 각 agent의 정의는 `{name, account, plugin, role, cwd, maker}`다. `plugin`은 setting `terminalPlugin`의 값이고, `role`은 식별자이며, `cwd`는 창의 프로젝트 루트이고, `maker`는 group의 식별자다([definitions](definitions.ko.md#key)).
4. Group 기록은 `groups`에 이름과 member와 함께 저장하며, member는 agent 식별자다.

`accounts`, `definitions`, `groups` key는 각각 값이 바뀔 때만 저장한다. 같은 group을 두 번 목록에 올리면 아무것도 바뀌지 않으며, 사람이 더한 정의나 member는 남는다.

## 쓰기

선언된 명령 `agents.group.write {group}`은 연결된 maker group의 파일을 쓰고 그 role을 정의한다. 첫 쓰기 전에 모든 파일을 검사하며, 검사가 하나라도 실패하면 전체 쓰기를 규칙의 문장과 함께 거부한다.

1. `files` 항목 중 프로젝트에 경로가 있고 현재 text가 항목의 text와 다른 파일은 `maker <group>: <path> holds other content`로 거부한다. 경로가 없는 파일과 현재 text가 항목의 text와 같은 파일은 검사를 통과한다.
2. `folders`의 각 항목은 files sidecar의 `createFolder`로 프로젝트 루트 기준으로 만든다. 각 `files` 항목은 상위 폴더가 생긴 뒤 files sidecar의 `write`로 쓴다. `folders` 밖의 `files` path는 거부한다. 요청은 항목의 값을 담은 `executable`을 가지며, 항목에 없으면 `false`다. 현재 text가 항목의 text와 같고 byte order mark가 없는 파일은 쓰지 않는다(byte order mark는 쓰기가 없앤다). 다만 실행 가능한 항목은 예외다. Sidecar는 mode를 알려 주지 않으므로, 실행 가능한 항목은 파일의 현재 version으로 다시 쓰며, 이는 text를 유지하고 mode를 0755로 설정한다. Plugin은 `plugin.json`의 `dependencies`에 files sidecar를 `>=0.0.13`으로 선언한다. `executable`을 읽는 version이며, 이전 sidecar는 member를 무시하고 실행 bit가 없는 파일을 만든다.
3. 각 agent의 정의는 role 파일을 가진다. `files`는 agent `path`와 같은 `files` 항목의 프로젝트 루트 기준 절대 경로이고(`core.role.define`이 절대 경로를 받는다), `text`와 `ko`는 각각 그 파일을 밝히는 한 줄이다. Role 식별자는 목록의 식별자다. 각 role은 `core.role.define {id, text, ko, files}`로 정의한다.

group이 연결된 maker group인 definition 행의 메뉴에는 `그룹 파일 쓰기` 항목이 `삭제` 항목 위에 있고, 이 항목은 그 group의 식별자로 `agents.group.write {group}`를 실행한다.

명령은 `{written}`을 돌려준다. 쓰기가 쓴 `files` 항목의 프로젝트 경로이며 `files`의 순서를 따른다. 같은 파일은 쓰지도 나열하지도 않는다. Core의 거부는 명령을 그 text와 함께 멈춘다. 거부 전에 쓴 파일은 남으며, 같은 명령을 다시 실행하면 다른 파일만 쓴다.

Model과 환경 변수는 적용하지 않는다. 저장된 정의에 그 값을 담는 member가 없기 때문이다([definitions](definitions.ko.md#key)).

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
