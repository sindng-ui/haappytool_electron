# CLI 설정 동기화 및 데이터 잠금 해결 계획

형님! 패키지된 앱에서 CLI를 실행할 때 발생하는 **데이터 잠금(Database Lock)** 문제와 **설정 미공유(localStorage 미검색)** 문제를 해결하기 위한 보완 계획입니다. 🐧💎

## 발생한 문제점
1. **데이터 잠금**: Electron(Chromium)은 하나의 `userData` 폴더를 한 번에 하나의 프로세스만 점유할 수 있습니다. GUI가 켜져 있으면 CLI가 같은 폴더에 접근하려다 IndexedDB/LocalStorage 잠금 에러를 내고 멈춥니다.
2. **설정 공유 불가**: `localStorage`는 브라우저 엔진 내부 저장소라 파일을 직접 읽기 어렵습니다. GUI에서 저장한 필터(Mission) 정보를 CLI가 알 수 없습니다.

## 해결 방법
- **GUI**: 설정을 저장할 때 `localStorage`뿐만 아니라 `userData/settings.json` 파일로도 백업합니다.
- **Main**: CLI 모드 진입 시, 충돌 방지를 위해 별도의 임시 `userData` 경로를 사용하도록 설정합니다.
- **CLI**: 실행 시 GUI가 저장해둔 `settings.json` 파일을 메인 프로세스에서 직접 읽어 렌더러로 넘겨줍니다.

---

## Proposed Changes

### [Electron Main]

#### [MODIFY] [main.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/electron/main.cjs)
- `cli` 인자 감지 시 `app.setPath('userData', ...)`를 호출하여 전용 경로 설정 (GUI와 충돌 차단).
- `saveSettingsToFile` IPC 핸들러 추가하여 `settings.json` 저장 기능 구현.

#### [MODIFY] [cli.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/electron/cli.cjs)
- 명령 실행 전 `settings.json` 파일을 읽어 payload에 포함하여 렌더러로 전달.

#### [MODIFY] [preload.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/electron/preload.cjs)
- `saveSettingsToFile` API 노출.

---

### [Frontend]

#### [MODIFY] [App.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/App.tsx)
- 설정 자동 저장 로직(`useEffect`)에 파일 저장 IPC 호출 추가.

#### [MODIFY] [CliApp.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/CliApp.tsx)
- `localStorage` 대신 메인 프로세스에서 전달받은 payload의 설정을 우선 사용하도록 수정.

---

## Verification Plan

### Manual Verification
1. GUI 앱을 실행한 상태로 유지.
2. 터미널에서 `.\HappyTool.exe cli log-extractor ...` 실행.
3. "No HappyTool settings found" 에러 없이 정상적으로 필터링이 시작되는지 확인.
4. GUI에서 수정한 필터가 CLI에 즉시 반영되는지 확인.
