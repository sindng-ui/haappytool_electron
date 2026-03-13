# CLI Analyze-Diff 안정화 및 CliApp 리팩토링 계획 🐧🚀

형님, 현재 CLI 모드가 개발 환경에서 Vite 서버가 안 켜져 있으면 무한 대기 타는 문제를 확인했습니다. 
또한 `CliApp.tsx`가 500줄을 넘어서 리팩토링이 필요한 시점이네요! 깔끔하게 정리해 드리겠습니다.

## User Review Required

> [!IMPORTANT]
> - CLI 실행 시 Vite 서버(`localhost:3000`)가 없으면 `dist` 폴더의 빌드 파일을 찾아 실행하도록 로직을 개선할 예정입니다.
> - `CliApp.tsx`의 비대한 로직들을 기능별(Analyze Diff, Log Extractor 등)로 분리하여 가독성과 유지보수성을 높이겠습니다.
> - 빌드 파일이 없는 상태에서 Vite도 안 켜져 있으면 형님께 친절하게 빌드나 서버 실행을 요청하게 하겠습니다.

## Proposed Changes

### [Component] CLI Orchestration & Startup
Vite 서버 연결 실패 시 Fallback 로직을 추가하고, GPU 관련 경고를 최소화합니다.

#### [MODIFY] [main.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/electron/main.cjs)
- CLI 모드에서도 GPU 관련 환경 변수를 더 확실히 차단하여 가상화 환경(WSL)에서의 오류를 줄입니다.

#### [MODIFY] [cli.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/electron/cli.cjs)
- `createHiddenWindow`에 타임아웃(5초)을 도입합니다.
- Vite 서버 접속 실패 시 `app://` 프로토콜(빌드된 파일)로 자동 전환을 시도합니다.
- `cli-ready` 대기 중에 실패할 경우 터미널에 명확한 에러 메시지를 출력하고 종료합니다.

---

### [Component] CLI Renderer Refactoring
`CliApp.tsx`가 지나치게 비대하므로 기능을 분리합니다.

#### [NEW] [useCliHandlers.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useCliHandlers.ts)
- `handleLogExtractor`, `handleAnalyzeDiff` 등 거대 핸들러들을 훅으로 분리합니다.

#### [MODIFY] [CliApp.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/CliApp.tsx)
- 500줄 이하로 줄이기 위해 핸들러 로직을 외부 훅으로 이전합니다.
- UI와 오케스트레이션 로직을 분리합니다.

---

### [Document] Documentation Updates
#### [MODIFY] [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/APP_MAP.md)
- 변경된 파일 구조 및 CLI 안정화 처리 내용을 업데이트합니다.

## Verification Plan

### Automated Tests
- CLI가 Vite 서버 없이도 정상적으로 에러를 뱉거나(빌드 없을 시) 빌드 파일로 실행되는지 확인하는 스크립트를 작성하여 테스트합니다.
- `npm run cli -- --help` 명령어가 즉각 응답하는지 확인합니다.

### Manual Verification
1. **Vite 서버 종료 상태**에서 `npm run cli -- analyze-diff ...` 실행 -> 5초 내에 "Building not found or Server not running" 메시지 혹은 빌드 파일 로드 확인.
2. **Vite 서버 실행 상태**에서 동일 명령 실행 -> 정상 동작 확인.
3. 리팩토링 후 `CliApp`이 정상적으로 각 커맨드(Log Extractor, Analyze Diff 등)를 수행하는지 확인.
