# Global Alias Range 분석 구현 계획

## 유저 요구사항
- 특정 Alias(예: `OnCreate`)가 여러 번 발생할 경우, 각 지점 사이의 간격 외에 **해당 Alias가 처음 발생한 지점부터 마지막으로 발생한 지점까지**를 하나의 거대한 세그먼트로 추가로 제공해야 함.
- 기존의 세밀한 세그먼트 분석(Interval Analysis) 결과에는 영향을 주지 않아야 함.

## 설계 및 변경 사항

### [Utility]
#### [MODIFY] [SplitAnalysisUtils.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SplitAnalysisUtils.ts)
- `computeGlobalAliasRanges` 함수 신규 작성:
    - `AliasEvent[]`를 입력받아 Alias별(Signature 기준)로 그룹화합니다.
    - 그룹 내 이벤트가 2개 이상인 경우, `first.timestamp`와 `last.timestamp`의 차이를 계산하여 전체 소요 시간을 구합니다.
    - 시작/종료 지점은 `first.visualIndex`와 `last.visualIndex`로 설정합니다.

### [Worker]
#### [MODIFY] [SplitAnalysis.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SplitAnalysis.worker.ts)
- 신규 엔진 가동: `computeGlobalAliasRanges` 결과를 `results` 배열에 추가합니다.
- `key` 이름 규칙: `[Global Alias Batch] OnCreate (10 counts)` 형태로 명명하여 기존 개별 매칭과 구분합니다.

## 검증 계획
- `SegmentSync.test.ts`에 Global Range 검증 로직 추가.
- `OnCreate`가 여러 번 나오는 로그 데이터에서 하나의 보라색(Zap) 전역 세그먼트가 생성되는지 UI 확인.

[proceed]
