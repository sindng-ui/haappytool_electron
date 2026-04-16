# RAG 서버 실행 오류 (ENOENT) 수정 계획

## 문제 원인 분석
형님, 현재 발생하고 있는 `spawn python ENOENT` 에러의 원인을 분석해 보니 다음과 같습니다:

1. **ASAR 패키징 문제**: `electron:build` 시 `server/rag_analyzer` 폴더(파이썬 venv 포함)가 `app.asar` 파일 안으로 압축되어 들어갑니다.
2. **실행 불가능한 경로**: Electron의 `child_process.spawn`은 `.asar` 압축 파일 내부에 있는 실행 파일(python.exe)을 직접 실행할 수 없습니다. OS가 해당 경로를 인식하지 못하기 때문입니다.
3. **경로 탐색 실패**: 현재 `main.cjs` 코드는 `app.getAppPath()`를 기준으로 경로를 찾는데, 빌드된 앱에서는 이 경로가 `app.asar`를 가리킵니다. 여기서 파이썬 실행 파일을 찾지 못해 시스템 기본 `python` 명령어로 폴백(fallback)하게 되고, 사용자 환경에 파이썬이 PATH에 등록되어 있지 않으면 `ENOENT` 에러가 발생합니다.

## 해결 방안

### 1. ASAR Unpack 설정 추가
`package.json`의 `build` 설정에서 `server/rag_analyzer` 폴더를 `asarUnpack` 목록에 추가합니다. 이렇게 하면 빌드 시 이 폴더만 압축에서 제외되어 `app.asar.unpacked` 폴더에 실제 파일로 남게 됩니다.

### 2. 메인 프로세스 경로 로직 수정
`electron/main.cjs` 내의 `start-rag-server` 핸들러에서, 앱이 패키징된 상태(`app.isPackaged`)일 경우 `app.asar.unpacked` 내의 경로를 참조하도록 수정합니다.

## 상세 변경 사항

### [package.json](file:///k:/Antigravity_Projects/gitbase/happytool_electron/package.json)
- `build.asarUnpack` 필드에 `"server/rag_analyzer/**/*"` 추가.

### [electron/main.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/electron/main.cjs)
- `ragDir` 결정 로직에서 패키징 여부에 따라 `.unpacked` 경로를 사용하도록 분기 처리.
- 로깅을 강화하여 어떤 경로에서 파이썬을 시도하는지 명확히 출력.

## 검증 계획
1. **코드 수정**: 위 사항들 적용.
2. **빌드 테스트**: `npm run electron:build:dir` (또는 fast 빌드)를 실행하여 `dist_electron/win-unpacked/resources/app.asar.unpacked/server/rag_analyzer` 폴더가 생성되는지 확인.
3. **실행 확인**: 빌드된 실행 파일을 실행하여 RAG 서버가 정상적으로 `spawn` 되는지 확인.

---
형님, 이 계획대로 진행해도 되겠습니까? 확인해 주시면 바로 작업 시작하겠습니다! 🐧🚀
