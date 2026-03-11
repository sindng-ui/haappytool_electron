# 유닛 테스트(UT) 보강 계획서 🐧🧪

형님, 요청하신 영속화 및 Analyze Diff 관련 테스트를 보강하기 위한 계획입니다.

## 1. 보강 대상 및 항목

### A. 영속화 (Auto-loading) 테스트
- **대상**: `hooks/useLogFileOperations.ts` (또는 이를 포함한 `useLogExtractorLogic.ts`)
- **테스트 케이스**:
  1. **Single Mode 자동 로드**: `localStorage`에 `filePath`만 있을 때 앱 시작 시 `loadFile('left')`가 호출되는지 확인.
  2. **Split Mode 자동 로드**: `localStorage`에 `filePath`, `rightFilePath`, `isDualView: true`가 있을 때 양쪽 모두 `loadFile`이 호출되는지 확인.
  3. **Race Condition 방지**: `isLoaded` 플래그가 설정되기 전에는 유효하지 않은(빈) 상태가 저장되지 않는지 확인.

### B. Analyze Diff (Split Analysis) 테스트
- **대상**: `workers/SplitAnalysis.worker.ts` & `SplitAnalysisUtils.ts`
- **테스트 케이스**:
  1. **Global Alias Batch**: 동일 Alias의 처음과 끝을 잇는 거대 세그먼트가 정상적으로 생성되는지 확인.
  2. **Deduplication**: 시각적으로 중복되는(동일 라인 범위) 세그먼트가 워커 레벨에서 제거되는지 확인.
  3. **Signature Hash**: 상세해진 Alias 시그니처(`파일::함수(라인)`) 기반 매칭 정확도 확인.

## 2. 작업 순서

1. `test/hooks/useLogPersistence.test.tsx` 신규 생성 (영속화 집중 테스트)
2. `test/workers/SplitAnalysis.test.ts` 업데이트 (Deduplication, Global Batch 테스트 추가)
3. 전체 테스트 실행 및 결과 검증

---

> [!IMPORTANT]
> 형님, 테스트 코드 작성을 시작해도 될까요? "Proceed" 버튼 대신 답변 주시면 바로 고고하겠습니다! 🐧🫡
