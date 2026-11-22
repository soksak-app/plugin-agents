# 변경 기록

[English](CHANGELOG.md)

- A1: Repository가 식별자 `agents`, 이름, 설명과 section `agents.running`, `agents.definitions`를 가진 manifest `plugin.json`을 갖는다. 두 section의 page `ui/running.html`과 `ui/definitions.html`은 A3과 A4 전까지 빈 document다. `test/manifest-shape.test.mjs`가 선언을 검사하고, `test/install.test.mjs`와 `test/test-script.test.mjs`가 Makefile과 test 명령을 검사한다. Version은 0.0.0이며 release하지 않았다.
- A7: Manifest `plugin.json`이 `extends`에 extension point `makers`를 version `0.1.0`과 필수 문자열 필드 `id`, `name`의 항목 schema로 선언한다. `test/manifest-shape.test.mjs`가 그 선언을 검사한다. Red: `plugin.json declares the extension point agents.makers in extends with its version and schema`가 `extends`가 undefined여서 실패했다. Green: `node --test test/`의 10개 test가 모두 통과하고, core `validateManifest`가 core 원본에 대해 한 번 실행했을 때 manifest를 받아들인다.
