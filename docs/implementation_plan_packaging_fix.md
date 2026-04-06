# 패키징 오류 (debug.log 파일 잠금) 해결 계획

형님, 패키징 중에 `dist_electron\win-unpacked\debug.log` 파일이 다른 프로세스에 의해 사용 중이라 삭제하지 못하는 문제가 발생했슴다. 보통 이건 이전에 실행했던 앱이 완전히 종료되지 않았거나, 윈도우가 파일을 붙잡고 있을 때 발생함다. 🐧

## Proposed Changes

### 빌드 시스템

#### [NEW] [cleanup_build.cjs](file:///K:/Antigravity_Projects/gitbase/happytool_electron/scripts/cleanup_build.cjs)
빌드 시작 전에 실행 중인 `BigBrain.exe` 프로세스를 정리하고, 잠긴 파일을 해제하려고 시도하는 스크립트입니다.

#### [MODIFY] [package.json](file:///K:/Antigravity_Projects/gitbase/happytool_electron/package.json)
`electron:build` 관련 스크립트 앞에 `cleanup_build.cjs`를 실행하도록 수정합니다.

## Verification Plan

### Automated Tests
- 빌드 명령을 실행하여 프로세스 정리 로직이 정상 동작하는지 확인합니다.
- `node scripts/cleanup_build.cjs` 직접 실행 테스트

### Manual Verification
1. 앱을 일부러 실행해 둔 상태에서 `npm run electron:build:dir` (또는 해당 오류가 발생했던 명령)을 실행합니다.
2. 스크립트가 프로세스를 자동으로 죽이고 빌드가 정상적으로 시작되는지 확인합니다.
