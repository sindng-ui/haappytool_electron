# Analyze Diff CLI 결과 포맷 개선 구현 계획서 🐧📝⚡

형님의 요청에 따라, 분석 결과 JSON의 `key` 필드를 더 직관적인 `파일명::함수명(라인) ➔ 파일명::함수명(라인)` 포맷으로 통일합니다.

## Proposed Changes

### [Component] Analysis Engine 🐧⚙️

#### [MODIFY] [SplitAnalysisUtils.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SplitAnalysisUtils.ts)
- `getFormattedSig(fileName, functionName, lineNum)` 헬퍼 함수를 추가하여 시그니처 포맷을 통일합니다.
- `matchAliasEvents`: 단일 지점 매칭 시에도 `Sig ➔ Sig` 포맷을 사용하거나, 형님의 의도에 맞게 시그니처를 가공합니다.
- `computeAliasIntervals`: 기존 `rinv.sig` 대신 통일된 포맷을 사용합니다.
- `computeGlobalAliasRanges`: 시작(`first`)과 끝(`last`) 메타데이터를 사용하여 `StartSig ➔ EndSig` 포맷으로 `key`를 생성합니다. (기존 `[Global Alias Batch]` 등의 접두어 제거)

#### [MODIFY] [SplitAnalysis.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SplitAnalysis.worker.ts)
- 일반 인터벌 분석 로직에서도 `key` 생성 시 `prevSig ➔ currentSig` 구조가 형님이 요청하신 포맷과 일치하도록 확인하고 보정합니다.

## User Review Required

> [!IMPORTANT]
> **디버깅 및 구분을 위한 접미사 유지 여부**
> 동일한 구간이 여러 번 나타날 경우(예: 루프 내 반복), UI에서 React `key` 중복 경고가 발생하거나 특정 항목 선택 시 혼선이 생길 수 있습니다. 
> 따라서 내부적으로는 `(#1)`, `(#2)` 등의 카운트를 붙여 고유성을 유지하되, 형님이 보시는 JSON 리포트에는 최대한 깔끔하게 나오도록 조율하겠습니다.

## Verification Plan

### Automated Tests
- `npm run cli -- analyze-diff` 명령을 실행하여 생성된 JSON의 `key` 값이 요청하신 포맷으로 변경되었는지 확인합니다.

### Manual Verification
- GUI의 Timeline 탭에서 여전히 항목들이 정상적으로 표시되고, 클릭 시 로그 점프 기능이 잘 작동하는지 확인합니다. (Key 중복 문제 체크)

---
형님, 이제 JSON만 봐도 어디서 어디로 튀었는지 한눈에 보이실 겁니다! 고고할까요? 🐧🫡⚡🧪✨
<button>Proceed</button>
