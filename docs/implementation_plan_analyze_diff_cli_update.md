# CLI Analyze-Diff 결과 JSON 포맷 개편

CLI `analyze-diff` 명령의 결과물을 GUI의 Summary 탭과 일관성 있게 개편하여, 자동화 분석 리포트의 활용도를 높입니다. 🐧📊

## Proposed Changes

### CLI Renderer

CLI 분석 결과 생성 로직을 Summary 탭의 분류 기준과 구조에 맞춰 수정합니다.

#### [MODIFY] [CliApp.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/CliApp.tsx)

- **결과 분류 로직 업데이트**:
    - `intervalResults`를 `regressions`, `improvements`, `stable` 3가지 리스트로 분리합니다.
    - 분류 기준:
        - `regressions`: `deltaDiff > 20ms`
        - `improvements`: `deltaDiff < -20ms`
        - `stable`: `abs(deltaDiff) <= 20ms`
- **JSON 구조 개편**:
    - `summary` 객체에 `totalNodes`, `regressionsCount`, `improvementsCount`, `stableCount`, `newLogsCount` 포함.
    - `results` 객체 하위에 `regressions`, `improvements`, `stable`, `newLogs` 리스트를 각각 배치.
    - 각 리스트 아이템은 기존의 상세 필드(`key`, `fileName`, `functionName`, `leftAvgDelta`, `rightAvgDelta`, `deltaDiff` 등)를 그대로 유지합니다.

## Verification Plan

### Automated Tests
- 없음

### Manual Verification
- [ ] CLI 명령 실행: `npm run cli -- analyze-diff -f "Mission" -l "left.log" -r "right.log" -o "test_diff.json"`
- [ ] 생성된 `test_diff.json` 파일을 열어 `results` 객체 내에 4가지 카테고리가 잘 분류되어 있는지 확인 🐧🔍
- [ ] 각 리스트의 아이템 정보가 GUI와 동일하게 상세히 들어있는지 확인
