# Maker group

[English](makers.md)

Extension point `agents.makers`는 `plugin.json`의 `extends`에 `makers`로 선언하며, version `0.0.1`과 항목 schema `id`, `name`(둘 다 필수 문자열)을 가진다. Maker plugin은 `contributes`의 `agents.makers` 아래에 group 하나를 `range`, `module`, `id`, `name`으로 기여한다. `id`는 group을 가리키고 `name`은 표시 이름이다.

## Export

기여된 `module`은 함수 `group`을 export한다. Provider는 module을 가져와 연결된 항목마다 `group()`을 호출한다. 이것은 core plugin specification의 extension point 규칙이다. `group()`은 인자가 없고 group object나 그 promise를 돌려준다. `id`가 항목의 `id`와 다르거나, object가 아래 schema에 맞지 않으면 그 항목은 invalid이며 보이지 않는다.

Group object의 경로는 maker plugin의 기여된 group 폴더를 기준으로 한다. 슬래시를 쓰고, 앞에 `/`가 없고, `..` segment가 없어야 한다.

## Group object

Group object는 다음 member를 가진다. 필수 member는 반드시 있어야 하며, 선택 member는 이 interface가 선언하지 않는다.

- `id`, `name`: group의 식별자와 표시 이름이다. 항목과 같다.
- `plugin`(필수): agent CLI가 plugin 디렉터리 옵션으로 읽는 교정된 plugin 폴더다.
- `clis`(필수): group이 실행하는 CLI 목록이며 각각 `claude` 또는 `codex`다. claude hook이 필요한 agent를 가진 group은 `claude`만 적는다.
- `agents`(필수): agent 정의 목록이다. 각 항목은 `name`, 정의 Markdown 파일 `path`, `cli`(`claude` 또는 `codex`, 필수: 이 agent를 실행하는 CLI), `port`(선택 정수: agent 자신의 web page 포트이며, moai web view처럼 web page를 띄우는 agent에는 필수), `model`(선택: 정의의 model, session에 적용)을 가진다.
- `skills`(필수): group의 skill 폴더 목록이다.
- `variables`(필수): agent process의 환경 변수를 이름에서 값으로 가는 object로 준다. 값에는 토큰 `{home}`을 넣을 수 있으며, agents plugin이 이것을 agent 계정의 home 폴더로 바꾼다.
- `path`(필수): agent process가 `PATH` 앞에 붙이는 폴더 목록이다.
- `folders`(필수): group이 프로젝트에 만드는 폴더 목록이며, 각각 `/`로 끝난다. 예를 들어 `.moai/`, `.harness/`, `.superpowers/`다.
- `rules`(필수): room이 agent prompt에 덧붙이는 지시 줄 목록이다. group 산출물의 위치 규칙을 담는다. 빈 목록도 허용한다.

Group의 산출물은 `folders`의 폴더에만 간다. Group의 rule은 이 위치를 밝힌다. 예를 들어 plan은 `.superpowers/plans/`에 둔다.

Group을 기여하는 maker plugin은 moai(`.moai/`, claude 전용, agent마다 web view 포트 하나), harness(`.harness/`), superpowers(`.superpowers/`, 위치는 rule에 적는다)다. 각 maker plugin은 설치할 때 자신의 파일을 가져와 교정하고 복사하며, agents plugin은 교정된 내용을 읽지 않는다.

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
