# 검색 기능 고도화 구현 계획

검색 입력 및 차트 업데이트와 관련된 사용자 불편 사항을 해결하기 위해 다음과 같은 개선을 진행합니다.

## 핵심 개선 사항

### 1. 검색 대소문자 무시 (Case-insensitive)
- `checkSegmentMatch` 로직에서 모든 텍스트 비교 시 `toLowerCase()`를 적용하여 대소문자 구분 없이 검색되도록 보장합니다.

### 2. 백스페이스로 키워드 삭제 기능 개선
- 검색창에 공백(` `)만 있거나 비어 있을 때 백스페이스를 누르면 마지막으로 추가된 키워드 태그가 삭제되도록 `PerfTopBar.tsx`의 핸들러를 수정합니다.

### 3. 키워드 추가/삭제 시 차트 즉시 업데이트
- `PerfFlameGraph.tsx`에서 검색 조건(`searchTerms`, `showOnlyFail`, `perfThreshold` 등)이 변경될 때 캔버스를 즉시 다시 그리도록 트리거를 강화합니다. 마우스 이벤트 없이도 상태 변화가 즉각 반영되도록 합니다.

## 상세 변경 내역

### [LogViewer Component Layer]

#### [MODIFY] [PerfTopBar.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard/PerfTopBar.tsx)
- `handleKeyDown`에서 `searchInput.trim()`을 사용하여 공백 유무와 상관없이 백스페이스 삭제 로직이 작동하도록 수정합니다.

#### [MODIFY] [usePerfDashboardState.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/usePerfDashboardState.ts)
- `checkSegmentMatch`에서 `s.name`, `s.fileName`, `s.functionName` 및 `logs` 검색 시 일관되게 소문자 변환 비교를 수행합니다.
- `addSearchTerm` 시 입력값이 중복되는지 체크할 때도 대소문자를 구분하지 않도록 개선합니다.

#### [MODIFY] [PerfFlameGraph.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard/PerfFlameGraph.tsx)
- 상태 변화 감지 `useEffect`의 의존성 배열을 보강합니다.
- 특정 상태 변경 시 `isDirtyRef.current = true` 설정 후 `requestAnimationFrame`을 통해 즉각적인 렌더링이 수행되도록 보장하거나, 필요시 직접 렌더링 함수를 호출합니다.

## 검증 계획

### 자동/수동 테스트
- [ ] **대소문자 무시**: `FRAMEWORK`, `framework`, `FrameWork` 검색 시 동일하게 해당 세그먼트가 하이라이트되는지 확인.
- [ ] **백스페이스 삭제**: 검색창에 ` ` (공백) 입력 후 백스페이스를 눌렀을 때 마지막 태그가 삭제되는지 확인.
- [ ] **즉시 업데이트**: 키워드를 추가(Enter)하거나 삭제(X 버튼 클릭)했을 때 마우스를 움직이지 않아도 차트 색상이 즉시 바뀌는지 확인.

---
형님, 이 계획대로 진행해도 될까요? 승인해주시면 바로 쿨하게 작업 들어갑니다! 🐧🫡⚡
