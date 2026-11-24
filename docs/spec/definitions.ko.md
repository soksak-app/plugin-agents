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

## 컨트롤과 대화상자

정의 섹션은 그룹과 그 정의를 나열한다. 이 컨트롤들은 선언된 command를 실행하며, 그룹이나 정의를 추가하거나 바꾸는 양식은 window의 대화상자다(`plugin.json`의 `dialogs`, [dialogs](https://github.com/soksak-app/core/blob/main/docs/spec/plugins.md#dialogs)).

- 섹션은 아이콘 `plus`의 action `그룹 추가`를 선언하고, core는 그것을 섹션 머리 오른쪽 끝에 그린다. 이 action은 `agents.group.open`을 실행하며, 이 command는 대화상자 `group`을 연다. 그룹이 없는 동안 섹션은 맨 위에 `그룹이 없어요.`를 보인다.
- 그룹 대화상자에는 이름 필드와 추가 버튼이 있다. 이름 필드는 저장된 그룹 중에 `default`라는 이름의 그룹이 없으면 `default`를, 있으면 빈 값을 보인다. 이름 필드의 Enter와 추가 버튼은 `agents.group.create {name}`을 실행한다. 그룹이 이미 가진 이름은 거부되며, 대화상자는 거부 문구를 보이고 아무것도 저장하지 않는다. 저장된 그룹이 추가되면 대화상자는 그룹의 식별자와 함께 닫힌다.
- 그룹 행 오른쪽 끝의 `+`(element `agents.definitions.add-definition`)는 `agents.definition.open {group}`을 실행하며, 이 command는 식별자 없이 대화상자 `definition`을 열어 그룹에 정의를 추가하게 한다.
- 정의 행을 더블클릭하면 `agents.definition.open {group, id}`가 실행되며, 대화상자 `definition`이 그 식별자로 열린다. 대화상자는 저장된 record와 `core.roles`에서 그 식별자의 role을 보인다. 보이는 값은 이름, 계정, 작업 폴더, role 텍스트, 한국어 role 텍스트, role 파일이다. 저장은 `agents.definition.change`를 실행하고 대화상자를 닫는다.
- 대화상자 `definition`의 필드는 이름, 계정(저장된 계정의 select), 작업 폴더, role 텍스트, 한국어 role 텍스트, role 파일(한 줄에 절대 경로 하나)이다. 저장은 `agents.definition.define {group, id, name, account, cwd, text, ko, files}`을 실행하며, `id`는 대화상자가 열릴 때 만든 새 식별자다. command가 성공한 뒤에 저장이 대화상자를 닫는다.
- 저장이나 추가의 거부는 대화상자 page, 곧 그 page의 error display에 거부 문구와 함께 보이고, 그 순간 `runtime.error`로 기록된다. 대화상자는 열린 채로 있고 저장된 값은 바뀌지 않는다. 각 필드는 자기가 주는 parameter와 함께 저장 command를 표시하므로, 필드는 연결된 control이다. 취소 버튼과 Escape는 `agents.dialog.cancel`을 실행하며, 이 command는 아무것도 바꾸지 않고 대화상자를 닫는다.

`agents.definition.change`는 `agents.definition.define`의 검사를 실행하고, 식별자가 그룹의 member이고 저장된 정의여야 한다고 요구한다. 같은 식별자로 `core.role.define`을 호출해 role을 다시 정의하며, 이름, 계정, 작업 폴더를 저장한다. record의 plugin과 maker는 그대로 둔다.

command는 그것을 바인딩한 대화상자의 document에서 실행된다. 페이지는 자신이 등록한 command만 실행하기 때문이다. 대화상자와 섹션은 규칙을 `ui/definition-commands.js`에서 공유하며, 양식의 순수 규칙은 `ui/dialog-rules.js`에 있다.
