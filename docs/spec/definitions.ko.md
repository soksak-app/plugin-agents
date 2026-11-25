# 에이전트 정의와 계정

[English](definitions.md)

Agents plugin은 project data key 세 개를 workbench가 쓰는 저장 형식 `{format, value}`로 저장한다(`plugin.json`의 `data`, [project data](https://github.com/soksak-app/core/blob/main/docs/spec/plugins.md#project-data)). `accounts`와 `definitions`는 format 1이고(생략 시 기본값), `groups`는 format 2다.

## Key

- `accounts`: 계정의 배열이며 기본값은 `[]`다. 각 계정은 `{id, cli, args, env, home}`다. `id`는 `^[a-z][a-z0-9-]{0,39}$`에 맞고 유일하다. `cli`는 에이전트 CLI의 program 이름이며, 공백이나 제어 문자 없이 1자 이상 255자 이하다. `args`는 text의 배열이고 인자 하나당 항목 하나다. `env`는 `^[A-Za-z_][A-Za-z0-9_]{0,127}$`에 맞는 환경 변수 이름의 유일한 배열이다. 변수 값은 저장하지 않는다. `home`은 `null` 또는 계정의 configuration home인 `{variable, folder}`다([계정 home](#계정-home)).
- `definitions`: 기본값 `{}`인 객체이며, 정의 식별자에서 `{name, account, plugin, role, cwd}`로 가는 매핑이며, 선택 member `maker`와 `launch`를 가질 수 있다. `name`은 1자 이상 40자 이하다. `account`는 `accounts`의 계정 이름이다. `plugin`은 session을 실행하는 plugin이며, 정의할 때의 setting `terminalPlugin`(기본값 `terminal`) 값이다. `role`은 core role 식별자이며 정의 식별자와 같다. `cwd`는 절대 경로다. `maker`는 있을 때 이 정의를 저장한 목록의 maker group 식별자다([makers](makers.ko.md#목록)). 사람이 정의한 정의에는 `maker`가 없으며, 같은 식별자를 다시 정의해도 `maker`는 유지된다. `launch`는 `maker`가 있을 때만, 그리고 그때 반드시 있으며 `{args, env}`다. `args`는 text 배열이고 `env`는 `^[A-Za-z_][A-Za-z0-9_]{0,127}$`에 맞는 변수 이름에서 text로 가는 객체이며, 목록이 maker folder의 session에 주는 인자와 변수다([makers](makers.ko.md#목록)). 정의를 바꿔도 `launch`는 유지된다.
- `groups`: 기본값 `{}`인 객체이며, group 식별자에서 `{name, members, leader}`로 가는 매핑이다. 식별자는 `^[a-z][a-z0-9-]{0,39}$`에 맞는다. `name`은 1자 이상 40자 이하이고 group 사이에서 유일하다. `members`는 정의 식별자의 배열이며 각 식별자는 많아야 한 group에 속한다. `leader`는 그 group의 member이고, `members`가 비어 있을 때만 `null`이다([leader](#leader)). format 1 형식 `{name, members}` 같은 다른 형식의 group은 group 식별자와 찾은 member를 밝혀 거부한다.

## Leader

각 group에는 그 group의 member인 leader가 정확히 하나 있다. group을 받은 방은 mention 없는 메시지를 leader에게 보내므로, leader는 방이 아니라 group에 속한다. group이 처음 받은 member가 leader가 된다. leader를 빼면 남은 첫 member가 leader가 되고, 마지막 member를 빼면 `leader`는 `null`이 된다. `agents.group.leader {group, id}`는 member `id`를 group `group`의 leader로 만든다. 이 command는 멱등하며, 저장되지 않은 group은 `group <group> is not defined`로, group이 갖지 않은 식별자는 `role <id> is not a member of group <group>`으로 거부한다.

## 목록이 만든 계정

Maker group을 목록에 올릴 때([makers](makers.ko.md#목록)) 에이전트의 `cli`를 가진 계정이 없으면, 목록은 [계정 home](#계정-home)의 home을 가진 계정 `{id: <cli>, cli: <cli>, args: [], env: [], home}`를 만든다. 식별자 `<cli>`를 다른 `cli`의 계정이 이미 가지고 있으면 목록은 그 계정의 이름을 밝히며 거부한다. 목록은 다른 계정을 만들지 않는다.

## 계정 home

Agent CLI는 login과 설정을 configuration home에 두므로, 한 CLI의 두 계정은 각자 home을 가질 때만 두 login을 가진다. `cli`의 마지막 경로 segment가 home을 정한다. `claude`는 변수 `CLAUDE_CONFIG_DIR`에서, `codex`는 `CODEX_HOME`에서 home을 읽고, 다른 CLI의 계정은 `home: null`이다. Plugin이 `agents.account.define`이나 목록으로 `claude`나 `codex`의 계정을 정의하면 `home`을 `{variable, folder}`로 두며, `folder`는 `<dataFolder>/accounts/<id>`다. `dataFolder`는 view의 start values에 있는 plugin의 data folder다([start values](https://github.com/soksak-app/core/blob/main/docs/spec/native-surfaces.ko.md#view-표면)). Plugin은 계정을 저장하기 전에 선언된 program `account-home`, 곧 `mkdir -p -m 700 <folder>`로 folder를 만든다. Folder는 식별자에만 달려 있으므로 모든 project에서 같은 식별자의 계정은 home 하나와 그 login을 함께 쓴다. 다른 project가 같은 식별자를 쓸 수 있으므로 계정을 지워도 home은 남는다.

Home의 login은 그 CLI의 문서화된 status 명령으로 읽으며, 이 명령은 비밀 값을 출력하지 않는다.

- `claude`: program `claude-status`, 곧 `env CLAUDE_CONFIG_DIR=<folder> <cli> auth status --json`이다. `loggedIn`이 `true`이면 0으로, `false`이면 1로 끝나고, 읽은 folder인 `configDirectory`와 login의 종료 시각 또는 `null`인 `loginExpiresAt`을 출력한다. `folder`와 다른 `configDirectory`는 계정과 두 folder를 밝히는 오류다. 그때 CLI는 다른 login을 읽기 때문이다. `loggedIn`과 어긋나는 종료 상태와 status JSON이 아닌 출력은 계정을 밝히는 오류다.
- `codex`: program `codex-status`, 곧 `env CODEX_HOME=<folder> <cli> login status`이다. 종료 상태 0은 `true`, 1은 `false`다.
- `home: null`인 계정의 login은 `null`이다. 다른 종료 상태와 잘린 출력은 계정과 program을 밝히는 오류다.

계정의 login은 `{login, expires}`다. `expires`는 `claude`의 `loginExpiresAt`이며, CLI를 써도 늘어나지 않는다. `codex`와 home이 없는 계정은 `null`이다.

`agents.account.login {id}`는 사람이 쓰던 대화상자 안에서 계정의 login을 실행하고 탭을 열지 않는다. 계정의 home을 만든 뒤 선언된 program `claude-login`이나 `codex-login`, 곧 `plugin:bin/login.mjs <claude|codex> <folder> <cli>`를 실행한다. 이 program은 home의 variable을 folder로 두고 CLI의 문서화된 login command `claude auth login`이나 `codex login`을 실행한다. program은 sign-in 주소를 `sok agents.definition-dialog.sign-in --surface dialog/agents/definition --url <address>`로 대화상자에 넘긴다. `claude`는 주소를 variable `BROWSER`의 program에 주고, program은 그 값을 plugin의 `bin/login-page.mjs`로 둔다. macOS에서 `BROWSER`의 program을 열지 않는 `codex`는 주소를 출력하고, program은 `https://` 주소가 있는 첫 출력 줄에서 그것을 읽는다. sign-in page는 browser를 CLI가 기다리는 local 주소로 보내므로, CLI는 home에 login을 저장하고 끝난다. command는 실행이 끝나면 home의 [shared settings](#shared-settings)를 쓰고 login을 다시 읽은 뒤 `{id, login}`으로 답한다. 0이 아닌 status로 끝난 실행은 `login of account <id> ended with status <code>: <standard error>`로, `home: null`인 계정은 `account <id> has no home`으로, 어떤 계정도 갖지 않은 식별자는 `account <id> is not defined`로 거부한다. `agents.account.login.cancel`은 열린 실행을 끝내고, 그러면 login command는 `cancelled`로 끝난다.

### Shared settings

home은 사람의 설정을 받아서, member가 사람이 이미 답한 것, 예를 들어 권한을 우회하는 mode의 경고를 다시 묻지 않는다. 선언된 program `home-settings`, 곧 `plugin:bin/home-settings.mjs <folder>`는 사람의 설정 파일 `$HOME/.claude/settings.json`의 key를 `<folder>/settings.json`에 복사한다. 인증 key(`apiKeyHelper`, `awsAuthRefresh`, `awsCredentialExport`, `forceLoginMethod`, `forceLoginOrgUUID`)와 이름에 `KEY`, `TOKEN`, `SECRET`, `PASSWORD`가 들어간 `env`의 각 variable은 복사하지 않는다. 복사한 값은 `<folder>/soksak-shared-settings.json`에 두고, 사람의 값이 둔 값과 다를 때만 home의 key를 바꾼다. 그래서 home 안에서 바꾼 값은 사람이 그 key를 바꿀 때까지 남는다. 사람이 지운 key는 home이 아직 둔 값을 가질 때 home에서도 지운다. 각 파일은 mode `0600`의 새 파일로 써서 경로 위로 rename하고, `$HOME/.claude`에는 아무것도 쓰지 않으며 link를 만들지 않는다. `codex`의 home은 설정을 받지 않는다. 없는 사람의 설정 파일은 빈 설정이고, JSON object가 아닌 파일은 `home-settings: <path> is not a JSON object`로 거부한다. 대화상자는 login마다 이 program을 실행한다.

## 해석

정의의 program과 args는 저장하지 않는다. 읽는 쪽은 계정에서 얻는다. home이 있는 계정은 `program`이 `env`, `args`가 `["<variable>=<folder>", <cli>, ...<args>]`이므로 CLI가 계정의 home에서 시작하고 그 login을 쓴다. `home: null`인 계정은 `program`이 계정의 `cli`, `args`가 계정의 `args`다. `launch`가 있는 정의는 `launch.env`의 항목을 이름순으로 `<name>=<value>`로 home 변수 뒤에 더하므로 home이 없는 계정도 `program`이 `env`이고, 계정의 인자 뒤에 `launch.args`를 붙인다. 계정이 정의되지 않은 정의는 기본값으로 바꾸지 않고 거부한다.

## 거부

Reader는 다른 형식의 저장 값을 `agents project data`, key, 규칙을 담은 오류로 거부한다. 예를 들면 `agents project data definitions: definition <id> must have the members account, cwd, name, plugin and role, and maker with launch or neither`이다. 어떤 값도 변환하지 않는다.

## 읽는 쪽

Clubhouse room은 두 key를 `runtime.data.get {key, plugin: "agents"}`(core F1075)로 읽고 위의 해석을 적용한다. Dependency가 이 plugin의 module을 import하는 조항이 없으므로, room은 해석 규칙의 복사본을 가진다.

## 컨트롤과 대화상자

사이드바에서 `혼`(souls)이라는 이름을 가진 정의 섹션은 그룹과 그 정의를 나열한다. 이 컨트롤들은 선언된 command를 실행하며, 그룹이나 정의를 추가하거나 바꾸는 양식은 window의 대화상자다(`plugin.json`의 `dialogs`, [dialogs](https://github.com/soksak-app/core/blob/main/docs/spec/plugins.md#dialogs)).

- 섹션은 아이콘 `plus`의 action `그룹 추가`를 선언하고, core는 그것을 섹션 머리 오른쪽 끝에 그린다. 이 action은 `agents.group.open`을 실행하며, 이 command는 대화상자 `group`을 연다. 그룹이 없는 동안 섹션은 맨 위에 `그룹이 없어요.`를 보인다.
- 그룹 대화상자에는 이름 필드와 추가 버튼이 있다. 이름 필드는 저장된 그룹 중에 `default`라는 이름의 그룹이 없으면 `default`를, 있으면 빈 값을 보인다. 이름 필드의 Enter와 추가 버튼은 `agents.group.add {name}`을 실행하고, 이 command는 `agents.group.create {name}`을 실행한 뒤 그룹의 식별자와 함께 대화상자를 닫는다. 그룹이 이미 가진 이름은 거부되며, 대화상자는 거부 문구를 보이고 아무것도 저장하지 않는다. 저장된 그룹이 추가되면 대화상자는 그룹의 식별자와 함께 닫힌다. 대화상자의 `agents.group.create`, `agents.definition.define`, `agents.definition.change`는 저장하고 호출자에게 식별자로 답하며 대화상자를 열어 둔다. 닫기는 대화상자를 기다리는 모든 호출을 `surface-closed`로 끝내기 때문이다. 대화상자는 add와 save command만 명시적으로 끝낸다.
- 그룹 행 오른쪽 끝의 `+`(element `agents.definitions.add-definition`)는 `agents.definition.open {group}`을 실행하며, 이 command는 식별자 없이 대화상자 `definition`을 열어 그룹에 정의를 추가하게 한다.
- 정의 행의 아이콘(element `agents.definitions.leader`)은 로봇 이모지나 그 program의 아이콘을 보이고, 그 group leader의 행에서는 별 이모지(U+2B50)를 보인다. 아이콘을 누르면 그 행의 group과 식별자로 `agents.group.leader {group, id}`가 실행되고 행은 선택되지 않는다. 그래서 다른 member의 아이콘을 누르면 별이 그 행으로 옮겨 간다.
- 정의 행을 더블클릭하면 `agents.definition.open {group, id}`가 실행되며, 대화상자 `definition`이 그 식별자로 열린다. 대화상자는 저장된 record와 `core.roles`에서 그 식별자의 role을 보인다. 보이는 값은 이름, 계정, 작업 폴더, role 텍스트, 한국어 role 텍스트, role 파일이다. 저장은 `agents.definition.change`를 실행하고 대화상자를 닫는다.
- 대화상자 `definition`의 필드는 이름, 계정(저장된 계정의 select이며, 각 option은 식별자와, login이 `false`면 ` (로그인 필요)`를 보인다), 작업 폴더, role 텍스트, 한국어 role 텍스트, role 파일(한 줄에 절대 경로 하나)이다. 저장 버튼은 `agents.definition.save {group, id, name, account, cwd, text, ko, files}`을 실행하며, `id`는 대화상자가 열릴 때 만든 새 식별자다. 이 command는 `agents.definition.define`을, 저장된 정의면 `agents.definition.change`를 실행한 뒤 식별자와 함께 대화상자를 닫는다.
- 계정 select 아래에 대화상자는 버튼 로그인(element `agents.definition-dialog.login`)을 두며, 선택한 계정의 login이 `false`인 동안 켜진다. 이 버튼은 선택한 계정으로 `agents.account.login {id}`를 실행한다. 계정 줄 아래에 대화상자는 element `agents.definition-dialog.login-page`를 둔다. 이 element는 대화상자의 document region `login`을 담고, `agents.definition-dialog.sign-in {url}`이 sign-in 주소를 그 안에 load할 때까지 숨는다. 실행이 열린 동안 버튼 로그인 취소(element `agents.definition-dialog.login-cancel`)가 로그인 버튼 자리에 서서 `agents.account.login.cancel`을 실행하며, status `agents.definition-dialog.login-run`은 열린 실행의 `{id, url, page}`이다. 주소가 오기 전의 `url`은 `null`이고, `page`는 region의 마지막 상태 `{url, title, loading, error}`이며 region이 보고하기 전에는 `null`이다. 실행이 없으면 status는 `null`이다. sign-in page를 보이는 동안 대화상자는 제목, 계정 줄, region, 오류 줄만 보이고 region은 창의 높이를 채운다. 실행이 끝나면 region을 숨기고 계정의 login을 다시 읽는다. 새 계정 줄은 식별자 필드, cli 필드, 버튼 추가(element `agents.definition-dialog.account-id`, `agents.definition-dialog.account-cli`, `agents.definition-dialog.account-add`)를 가지며, 추가는 `agents.account.define {id, cli, args: [], env: []}`를 실행하고 새 계정을 고른다. 대화상자는 열릴 때와 계정을 더한 뒤 나열한 각 계정의 login을 읽고, status `agents.definition-dialog.accounts`, 곧 식별자 순서의 `{accounts: [{id, cli, login, expires}]}`로 게시한다.
- 저장이나 추가의 거부는 대화상자 page, 곧 그 page의 error display에 거부 문구와 함께 보이고, 그 순간 `runtime.error`로 기록된다. 대화상자는 열린 채로 있고 저장된 값은 바뀌지 않는다. 각 필드는 자기가 주는 parameter와 함께 저장 command를 표시하므로, 필드는 연결된 control이다. 취소 버튼과 Escape는 `agents.dialog.cancel`을 실행하며, 이 command는 아무것도 바꾸지 않고 대화상자를 닫는다. 대화상자 page는 parameter 읽기, composition, 저장된 값 읽기 같은 다른 모든 시작 단계보다 먼저 취소 버튼, Escape, `agents.dialog.cancel`을 등록한다. 실패한 시작 단계는 거부로 보이고 기록되며, 취소 버튼과 Escape는 그래도 대화상자를 닫는다.

`agents.definition.change`는 `agents.definition.define`의 검사를 실행하고, 식별자가 그룹의 member이고 저장된 정의여야 한다고 요구한다. 같은 식별자로 `core.role.define`을 호출해 role을 다시 정의하며, 이름, 계정, 작업 폴더를 저장한다. record의 plugin, maker, launch는 그대로 둔다.

command는 그것을 바인딩한 대화상자의 document에서 실행된다. 페이지는 자신이 등록한 command만 실행하기 때문이다. 대화상자와 섹션은 규칙을 `ui/definition-commands.js`에서 공유하며, 양식의 순수 규칙은 `ui/dialog-rules.js`에 있다.
