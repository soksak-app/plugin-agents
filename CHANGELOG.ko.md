# 변경 기록

[English](CHANGELOG.md)

- A1: Repository가 식별자 `agents`, 이름, 설명과 section `agents.running`, `agents.definitions`를 가진 manifest `plugin.json`을 갖는다. 두 section의 page `ui/running.html`과 `ui/definitions.html`은 A3과 A4 전까지 빈 document다. `test/manifest-shape.test.mjs`가 선언을 검사하고, `test/install.test.mjs`와 `test/test-script.test.mjs`가 Makefile과 test 명령을 검사한다. Version은 0.0.0이며 release하지 않았다.
- A7: Manifest `plugin.json`이 `extends`에 extension point `makers`를 version `0.1.0`과 필수 문자열 필드 `id`, `name`의 항목 schema로 선언한다. `test/manifest-shape.test.mjs`가 그 선언을 검사한다. Red: `plugin.json declares the extension point agents.makers in extends with its version and schema`가 `extends`가 undefined여서 실패했다. Green: `node --test test/`의 10개 test가 모두 통과하고, core `validateManifest`가 core 원본에 대해 한 번 실행했을 때 manifest를 받아들인다.
- A8: `extends`의 point `makers` version을 `0.0.1`로 정했다. Plugin version은 0.0 계열을 유지하기 때문이다. Red: `test/manifest-shape.test.mjs`의 version 검사가 `0.1.0`으로 실패했다. Green: `node --test test/`의 10개 test가 모두 통과하고, core `validateManifest`가 manifest를 받아들인다.
- A9: Extension point `agents.makers`의 interface를 `docs/spec/makers.ko.md`에 정의한다. 기여된 module은 `group()`을 export하고, 필수 member와 agent별 선택 `port`, `model`을 가진 group object를 돌려준다. `test/maker-interface.test.mjs`가 spec의 schema를 sample group으로 검사한다. Red: spec이 없을 때 test가 실패했다. Green: 4개 test가 모두 통과한다.
