# Analyze Diff CLI 명령 추가 구현 계획서 🐧💻⚡

형님의 요청에 따라, GUI를 띄우지 않고도 터미널에서 두 로그 파일의 성능 차이를 분석하여 JSON 결과물로 뽑아낼 수 있는 `analyze-diff` 명령을 추가합니다.

## Proposed Changes

### [Component] CLI Core 🐧💻

#### [MODIFY] [cli.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/electron/cli.cjs)
- `analyze-diff` 명령어를 새롭게 정의합니다.
- 필수 옵션: `-f (filter)`, `-l (left log)`, `-r (right log)`
- 선택 옵션: `-o (output json path)`

### [Component] CLI Renderer 🐧🛠️

#### [MODIFY] [CliApp.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/CliApp.tsx)
- `handleAnalyzeDiff` 함수를 구현하여 다음 과정을 오케스트레이션합니다.
    1.  **초기화**: 설정 파일 로드 및 지정된 미션(Filter) 검색.
    2.  **병렬 필터링**: `LogProcessorWorker` 2개를 띄워 좌/우 로그를 동시에 필터링.
    3.  **지표 추출**: 필터링 완료 후 각 워커로부터 `ANALYSIS_METRICS` 및 `ALIAS_EVENTS` 추출.
    4.  **비교 분석**: `SplitAnalysisWorker`를 실행하여 추출된 지표 간의 차이 분석.
    5.  **데이터 취합**: 분석 결과(`results`, `pointResults`)를 기반으로 Summary(regression, improvement 등)를 계산하고 최종 JSON 객체 생성.
    6.  **결과 저장**: 지정된 경로에 JSON 파일을 저장하고 CLI 종료.

## Verification Plan

### Automated Tests
- `npm run test`를 통해 기존 CLI 테스트가 깨지지 않는지 확인합니다.

### Manual Verification
- 터미널에서 다음 명령을 실행하여 결과 JSON이 올바르게 생성되는지 확인합니다.
  ```bash
  ./happytool-cli cli analyze-diff -f "MyMission" -l left.log -r right.log -o output.json
  ```
- 생성된 `output.json`에 `summary`, `timeline`, `newLogs` 정보가 모두 포함되어 있는지 확인합니다.

---
형님, Headless 분석 자동화의 시작입니다! 진행하시겠습니까? 🐧🫡⚡🧪✨
<button>Proceed</button>
