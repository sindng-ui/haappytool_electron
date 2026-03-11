# Analyze Diff 매칭 로직 고도화: 메시지 패턴 포함 시그니처

## 1. 개요
현재 'Analyze Diff'는 파일명과 함수명만으로 로그의 고유 식별자(Signature)를 생성합니다. 이로 인해 동일한 함수 내에 여러 로그가 있을 경우 시그니처 충돌이 발생하여, 중간에 새로운 로그가 삽입될 경우 매칭이 틀어지는 문제가 발생합니다. 이를 해결하기 위해 로그 메시지의 정적 패턴(숫자, Hex 제외)을 시그니처에 포함시켜 식별력을 높입니다.

## 2. 변경 사항

### [MODIFY] [SplitAnalysisUtils.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SplitAnalysisUtils.ts)
- `getFormattedSig` 함수가 `preview` (로그 본문)를 인자로 받아 패턴을 추출하도록 수정합니다.
- 시그니처 생성 방식 변경: `파일명::함수명::[메시지패턴]`
- `matchAliasEvents` 내의 이벤트 시그니처 생성 로직에도 메시지 패턴을 추가하여 정확도를 높입니다.

### [MODIFY] [SplitAnalysis.test.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/test/workers/SplitAnalysis.test.ts) 및 [SplitAnalysisUtils.test.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/test/utils/SplitAnalysisUtils.test.ts)
- 변경된 시그니처 포맷에 맞게 테스트 케이스의 기댓값(Assertion)을 업데이트합니다.
- **[신규 테스트]**: 동일 함수 내 로그 삽입 시나리오 테스트를 추가하여 이번 문제 상황이 해결되었는지 검증합니다.

## 3. 검증 계획

### 자동화 테스트
- `npm test test/utils/SplitAnalysisUtils.test.ts test/workers/SplitAnalysis.test.ts` 실행
- 모든 테스트가 통과하는지 확인합니다.

### 수동 검증
- 형님이 제보해 주신 상황(`test_startup_2.log`에 새로운 로그 한 줄 삽입)을 재현하여 GUI에서 Analyze Diff의 'Timeline' 브릿지가 깨지지 않고 정확히 정렬되는지 확인합니다.

---

형님, 이 계획대로 진행하면 중간에 로그가 들어와도 "이름은 같지만 본문 근육이 다른" 로그들을 정확히 구분해낼 수 있습니다! Proceed 버튼 눌러주시면 바로 작업 들어갈게요! 🐧�
