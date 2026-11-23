# 에이전트 정의와 계정

[English](definitions.md)

Agents plugin은 project data key 두 개를 저장한다(`plugin.json`의 `data`, [project data](https://github.com/soksak-app/core/blob/main/docs/spec/plugins.md#project-data)). 각 key는 format 1이며(생략 시 기본값), workbench가 쓰는 저장 형식은 `{format, value}`다.

## Key

- `accounts`: 계정의 배열이며 기본값은 `[]`다. 각 계정은 `{id, cli, args, env}`다. `id`는 `^[a-z][a-z0-9-]{0,39}$`에 맞고 유일하다. `cli`는 에이전트 CLI의 program 이름이며, 공백이나 제어 문자 없이 1자 이상 255자 이하다. `args`는 text의 배열이고 인자 하나당 항목 하나다. `env`는 `^[A-Za-z_][A-Za-z0-9_]{0,127}$`에 맞는 환경 변수 이름의 유일한 배열이다. 변수 값은 저장하지 않는다.
- `definitions`: 기본값 `{}`인 객체이며, 정의 식별자에서 `{name, account, plugin, role, cwd}`로 가는 매핑이며, 선택 member `maker`를 가질 수 있다. `name`은 1자 이상 40자 이하다. `account`는 `accounts`의 계정 이름이다. `plugin`은 session을 실행하는 plugin이며, 정의할 때의 setting `terminalPlugin`(기본값 `terminal`) 값이다. `role`은 core role 식별자이며 정의 식별자와 같다. `cwd`는 절대 경로다. `maker`는 있을 때 이 정의를 저장한 목록의 maker group 식별자다([makers](makers.ko.md#목록)). 사람이 정의한 정의에는 `maker`가 없으며, 같은 식별자를 다시 정의해도 `maker`는 유지된다.

## 목록이 만든 계정

Maker group을 목록에 올릴 때([makers](makers.ko.md#목록)) 에이전트의 `cli`를 가진 계정이 없으면, 목록은 계정 `{id: <cli>, cli: <cli>, args: [], env: []}`를 만든다. 식별자 `<cli>`를 다른 `cli`의 계정이 이미 가지고 있으면 목록은 그 계정의 이름을 밝히며 거부한다. 목록은 다른 계정을 만들지 않는다.

## 해석

정의의 program과 args는 저장하지 않는다. 읽는 쪽은 계정에서 얻는다. `program`은 계정의 `cli`이고 `args`는 계정의 `args`다. 계정이 정의되지 않은 정의는 기본값으로 바꾸지 않고 거부한다.

## 거부

Reader는 다른 형식의 저장 값을 `agents project data`, key, 규칙을 담은 오류로 거부한다. 예를 들면 `agents project data definitions: definition <id> must have the members account, cwd, name, plugin and role, and optionally maker`이다. 어떤 값도 변환하지 않는다.

## 읽는 쪽

Clubhouse room은 두 key를 `runtime.data.get {key, plugin: "agents"}`(core F1075)로 읽고 위의 해석을 적용한다. Dependency가 이 plugin의 module을 import하는 조항이 없으므로, room은 해석 규칙의 복사본을 가진다.
