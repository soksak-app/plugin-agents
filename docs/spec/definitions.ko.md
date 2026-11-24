# 에이전트 정의와 계정

[English](definitions.md)

Agents plugin은 project data key 두 개를 저장한다(`plugin.json`의 `data`, [project data](https://github.com/soksak-app/core/blob/main/docs/spec/plugins.md#project-data)). 각 key는 format 1이며(생략 시 기본값), workbench가 쓰는 저장 형식은 `{format, value}`다.

## Key

- `accounts`: 계정의 배열이며 기본값은 `[]`다. 각 계정은 `{id, cli, args, env, home}`다. `id`는 `^[a-z][a-z0-9-]{0,39}$`에 맞고 유일하다. `cli`는 에이전트 CLI의 program 이름이며, 공백이나 제어 문자 없이 1자 이상 255자 이하다. `args`는 text의 배열이고 인자 하나당 항목 하나다. `env`는 `^[A-Za-z_][A-Za-z0-9_]{0,127}$`에 맞는 환경 변수 이름의 유일한 배열이다. 변수 값은 저장하지 않는다. `home`은 `null` 또는 계정의 configuration home인 `{variable, folder}`다([계정 home](#계정-home)).
- `definitions`: 기본값 `{}`인 객체이며, 정의 식별자에서 `{name, account, plugin, role, cwd}`로 가는 매핑이며, 선택 member `maker`와 `launch`를 가질 수 있다. `name`은 1자 이상 40자 이하다. `account`는 `accounts`의 계정 이름이다. `plugin`은 session을 실행하는 plugin이며, 정의할 때의 setting `terminalPlugin`(기본값 `terminal`) 값이다. `role`은 core role 식별자이며 정의 식별자와 같다. `cwd`는 절대 경로다. `maker`는 있을 때 이 정의를 저장한 목록의 maker group 식별자다([makers](makers.ko.md#목록)). 사람이 정의한 정의에는 `maker`가 없으며, 같은 식별자를 다시 정의해도 `maker`는 유지된다. `launch`는 `maker`가 있을 때만, 그리고 그때 반드시 있으며 `{args, env}`다. `args`는 text 배열이고 `env`는 `^[A-Za-z_][A-Za-z0-9_]{0,127}$`에 맞는 변수 이름에서 text로 가는 객체이며, 목록이 maker folder의 session에 주는 인자와 변수다([makers](makers.ko.md#목록)). 정의를 바꿔도 `launch`는 유지된다.

## 목록이 만든 계정

Maker group을 목록에 올릴 때([makers](makers.ko.md#목록)) 에이전트의 `cli`를 가진 계정이 없으면, 목록은 [계정 home](#계정-home)의 home을 가진 계정 `{id: <cli>, cli: <cli>, args: [], env: [], home}`를 만든다. 식별자 `<cli>`를 다른 `cli`의 계정이 이미 가지고 있으면 목록은 그 계정의 이름을 밝히며 거부한다. 목록은 다른 계정을 만들지 않는다.

## 계정 home

Agent CLI는 login과 설정을 configuration home에 두므로, 한 CLI의 두 계정은 각자 home을 가질 때만 두 login을 가진다. `cli`의 마지막 경로 segment가 home을 정한다. `claude`는 변수 `CLAUDE_CONFIG_DIR`에서, `codex`는 `CODEX_HOME`에서 home을 읽고, 다른 CLI의 계정은 `home: null`이다. Plugin이 `agents.account.define`이나 목록으로 `claude`나 `codex`의 계정을 정의하면 `home`을 `{variable, folder}`로 두며, `folder`는 `<dataFolder>/accounts/<id>`다. `dataFolder`는 view의 start values에 있는 plugin의 data folder다([start values](https://github.com/soksak-app/core/blob/main/docs/spec/native-surfaces.ko.md#view-표면)). Plugin은 계정을 저장하기 전에 선언된 program `account-home`, 곧 `mkdir -p -m 700 <folder>`로 folder를 만든다. Folder는 식별자에만 달려 있으므로 모든 project에서 같은 식별자의 계정은 home 하나와 그 login을 함께 쓴다. 다른 project가 같은 식별자를 쓸 수 있으므로 계정을 지워도 home은 남는다.

Home의 login은 그 CLI의 문서화된 status 명령으로 읽으며, 이 명령은 비밀 값을 출력하지 않는다.

- `claude`: program `claude-status`, 곧 `env CLAUDE_CONFIG_DIR=<folder> <cli> auth status --json`이다. `loggedIn`이 `true`이면 0으로, `false`이면 1로 끝나고, 읽은 folder인 `configDirectory`와 login의 종료 시각 또는 `null`인 `loginExpiresAt`을 출력한다. `folder`와 다른 `configDirectory`는 계정과 두 folder를 밝히는 오류다. 그때 CLI는 다른 login을 읽기 때문이다. `loggedIn`과 어긋나는 종료 상태와 status JSON이 아닌 출력은 계정을 밝히는 오류다.
- `codex`: program `codex-status`, 곧 `env CODEX_HOME=<folder> <cli> login status`이다. 종료 상태 0은 `true`, 1은 `false`다.
- `home: null`인 계정의 login은 `null`이다. 다른 종료 상태와 잘린 출력은 계정과 program을 밝히는 오류다.

계정의 login은 `{login, expires}`다. `expires`는 `claude`의 `loginExpiresAt`이며, CLI를 써도 늘어나지 않는다. `codex`와 home이 없는 계정은 `null`이다.

`agents.account.login {id, cwd}`는 현재 card에 setting `terminalPlugin`의 plugin으로 parameter `{program: "env", args: ["<variable>=<folder>", <cli>, ...<login args>], directory: cwd, title: "<id> 로그인"}`의 terminal 탭을 연다. Login 인자는 `claude`가 `[]`다. 빈 home에서 처음 시작하는 `claude`는 text style, login, 작업 folder의 trust를 물으므로, 사람은 그 계정의 member가 시작하는 folder에서 각각을 한 번 답한다. `codex`는 `["login"]`이며, login이 끝나면 끝난다. 절대 경로가 아닌 `cwd`는 `the login of account <id> needs an absolute working folder, not <cwd>`로, `home: null`인 계정은 `account <id> has no home`으로, 어떤 계정도 갖지 않은 식별자는 `account <id> is not defined`로 거부한다.

## 해석

정의의 program과 args는 저장하지 않는다. 읽는 쪽은 계정에서 얻는다. home이 있는 계정은 `program`이 `env`, `args`가 `["<variable>=<folder>", <cli>, ...<args>]`이므로 CLI가 계정의 home에서 시작하고 그 login을 쓴다. `home: null`인 계정은 `program`이 계정의 `cli`, `args`가 계정의 `args`다. `launch`가 있는 정의는 `launch.env`의 항목을 이름순으로 `<name>=<value>`로 home 변수 뒤에 더하므로 home이 없는 계정도 `program`이 `env`이고, 계정의 인자 뒤에 `launch.args`를 붙인다. 계정이 정의되지 않은 정의는 기본값으로 바꾸지 않고 거부한다.

## 거부

Reader는 다른 형식의 저장 값을 `agents project data`, key, 규칙을 담은 오류로 거부한다. 예를 들면 `agents project data definitions: definition <id> must have the members account, cwd, name, plugin and role, and maker with launch or neither`이다. 어떤 값도 변환하지 않는다.

## 읽는 쪽

Clubhouse room은 두 key를 `runtime.data.get {key, plugin: "agents"}`(core F1075)로 읽고 위의 해석을 적용한다. Dependency가 이 plugin의 module을 import하는 조항이 없으므로, room은 해석 규칙의 복사본을 가진다.

## 컨트롤과 대화상자

정의 섹션은 그룹과 그 정의를 나열한다. 이 컨트롤들은 선언된 command를 실행하며, 그룹이나 정의를 추가하거나 바꾸는 양식은 window의 대화상자다(`plugin.json`의 `dialogs`, [dialogs](https://github.com/soksak-app/core/blob/main/docs/spec/plugins.md#dialogs)).

- 섹션은 아이콘 `plus`의 action `그룹 추가`를 선언하고, core는 그것을 섹션 머리 오른쪽 끝에 그린다. 이 action은 `agents.group.open`을 실행하며, 이 command는 대화상자 `group`을 연다. 그룹이 없는 동안 섹션은 맨 위에 `그룹이 없어요.`를 보인다.
- 그룹 대화상자에는 이름 필드와 추가 버튼이 있다. 이름 필드는 저장된 그룹 중에 `default`라는 이름의 그룹이 없으면 `default`를, 있으면 빈 값을 보인다. 이름 필드의 Enter와 추가 버튼은 `agents.group.create {name}`을 실행한다. 그룹이 이미 가진 이름은 거부되며, 대화상자는 거부 문구를 보이고 아무것도 저장하지 않는다. 저장된 그룹이 추가되면 대화상자는 그룹의 식별자와 함께 닫힌다.
- 그룹 행 오른쪽 끝의 `+`(element `agents.definitions.add-definition`)는 `agents.definition.open {group}`을 실행하며, 이 command는 식별자 없이 대화상자 `definition`을 열어 그룹에 정의를 추가하게 한다.
- 정의 행을 더블클릭하면 `agents.definition.open {group, id}`가 실행되며, 대화상자 `definition`이 그 식별자로 열린다. 대화상자는 저장된 record와 `core.roles`에서 그 식별자의 role을 보인다. 보이는 값은 이름, 계정, 작업 폴더, role 텍스트, 한국어 role 텍스트, role 파일이다. 저장은 `agents.definition.change`를 실행하고 대화상자를 닫는다.
- 대화상자 `definition`의 필드는 이름, 계정(저장된 계정의 select이며, 각 option은 식별자와, login이 `false`면 ` (로그인 필요)`를 보인다), 작업 폴더, role 텍스트, 한국어 role 텍스트, role 파일(한 줄에 절대 경로 하나)이다. 저장은 `agents.definition.define {group, id, name, account, cwd, text, ko, files}`을 실행하며, `id`는 대화상자가 열릴 때 만든 새 식별자다. command가 성공한 뒤에 저장이 대화상자를 닫는다.
- 계정 select 아래에 대화상자는 버튼 로그인(element `agents.definition-dialog.login`)을 두며, 선택한 계정의 login이 `false`인 동안 켜진다. 이 버튼은 선택한 계정과 대화상자의 작업 folder로 `agents.account.login {id, cwd}`를 실행하고 대화상자를 닫는다. login은 대화상자가 덮는 terminal 탭에서 돌기 때문이다. 새 계정 줄은 식별자 필드, cli 필드, 버튼 추가(element `agents.definition-dialog.account-id`, `agents.definition-dialog.account-cli`, `agents.definition-dialog.account-add`)를 가지며, 추가는 `agents.account.define {id, cli, args: [], env: []}`를 실행하고 새 계정을 고른다. 대화상자는 열릴 때와 계정을 더한 뒤 나열한 각 계정의 login을 읽고, status `agents.definition-dialog.accounts`, 곧 식별자 순서의 `{accounts: [{id, cli, login, expires}]}`로 게시한다.
- 저장이나 추가의 거부는 대화상자 page, 곧 그 page의 error display에 거부 문구와 함께 보이고, 그 순간 `runtime.error`로 기록된다. 대화상자는 열린 채로 있고 저장된 값은 바뀌지 않는다. 각 필드는 자기가 주는 parameter와 함께 저장 command를 표시하므로, 필드는 연결된 control이다. 취소 버튼과 Escape는 `agents.dialog.cancel`을 실행하며, 이 command는 아무것도 바꾸지 않고 대화상자를 닫는다.

`agents.definition.change`는 `agents.definition.define`의 검사를 실행하고, 식별자가 그룹의 member이고 저장된 정의여야 한다고 요구한다. 같은 식별자로 `core.role.define`을 호출해 role을 다시 정의하며, 이름, 계정, 작업 폴더를 저장한다. record의 plugin, maker, launch는 그대로 둔다.

command는 그것을 바인딩한 대화상자의 document에서 실행된다. 페이지는 자신이 등록한 command만 실행하기 때문이다. 대화상자와 섹션은 규칙을 `ui/definition-commands.js`에서 공유하며, 양식의 순수 규칙은 `ui/dialog-rules.js`에 있다.
