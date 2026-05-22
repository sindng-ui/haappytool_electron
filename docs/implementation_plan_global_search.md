# 📋 글로벌 미션 기반 '열린 파일 모두 검색(Search All)' 구현 계획서 🐧⚡

형님! 안녕하십니까. 열린 모든 로그 파일에서 글로벌 미션을 기준으로 다중 키워드를 초고속 검색하여 Notepad++ 스타일의 트리뷰로 예쁘고 프리미엄하게 뿌려주는 최강의 '열린 파일 모두 검색(Search All)' 기능 구현 계획을 수립했습니다.

이 기능은 여러 로그 탭을 오가며 분석할 때, 특정 이슈나 핵심 트랙(글로벌 미션)을 열린 모든 파일에 걸쳐 한 번에 싹 다 뒤져서 일치하는 흐름을 한눈에 보고, 클릭 시 해당 파일/라인으로 하이퍼 점프를 시켜주는 획기적인 기능입니다.

성능 중심 설계와 500줄 초과 방지 룰, 그리고 UI 렌더링 시 무거운 `blur` 효과 배제 등의 신성한 룰을 100% 준수하여 깔끔하게 설계했으니 검토해 주십쇼! 🥊

---

## 1. 핵심 설계 및 파이프라인 (Data & Search Flow)

### 1-1. 워커 파일 경로 전역 트래킹 (`LogWorkerRegistry.ts`)
- 현재 `LogWorkerRegistry` 싱글톤에서 각 탭의 워커 쌍(left, right)을 보관하고 있으나, 각 워커의 로컬 파일 경로 `path`가 로딩 성공 시점에 등록되는 로직이 누락되어 있습니다.
- **해결 방안**: 
  - `useLogFileOperations.ts`에서 파일 로드 및 초기화 성공 시점에 `workerRegistry.updateState(tabId, pane, { path: filePath })`를 명시적으로 호출해 경로 상태를 레지스트리에 최신화합니다.
  - `LogWorkerRegistry`에 `getAllWorkers(): Map<string, WorkerPair>` 퍼블릭 메서드를 추가하여 모든 탭의 워커 인스턴스 정보와 로드된 파일 경로를 메인 스레드에서 즉시 탐색할 수 있게 합니다.

### 1-2. 초고속 비동기 병렬 검색 API 설계 (`LogProcessor.worker.ts`)
- 대용량 파일에서 메인 스레드를 통해 일괄 검색을 돌리면 OOM(Memory Out of Memory) 및 메인 스레드 프리징이 100% 발생합니다.
- **해결 방안**:
  - 각 탭의 백그라운드 `Worker`에서 직접 로드한 파일 메모리/SAB 버퍼를 병렬 검색하게 만듭니다.
  - 워커 내부에 `SEARCH_GLOBAL_MISSION` 메시지 핸들러를 추가합니다.
  - 이 핸들러는 전달받은 글로벌 미션(`LogRule` 형태)에 들어 있는 해피콤보(OR of ANDs)와 블록 리스트를 기준으로, 현재 워커에 할당된 파일의 전체 라인을 훑어 매칭된 결과 리스트(`{ lineNum: number, content: string }[]`)를 추출해 반환합니다.
  - 매칭 결과가 너무 많을 경우의 성능 및 메모리 과부하를 방지하기 위해 **최대 3,000개**의 매칭 상한선(Limit) 가드를 장착합니다.

### 1-3. Notepad++ 스타일 결과 뷰어 컴포넌트 신규 개발 (`GlobalSearchResultView.tsx`)
- `LogViewerPane.tsx`가 이미 큰 편이고, 500줄 룰을 철저히 지키기 위해 이 뷰어는 신규 독립 컴포넌트인 [GlobalSearchResultView.tsx](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/GlobalSearchResultView.tsx)로 완벽히 격리 렌더링합니다.
- UI 디자인은 프리미엄 다크 글래스모피즘 아우라를 적용하며, 성능에 지장을 주는 CSS `blur` 또는 `backdrop-blur` 연산 대신 **고해상도 radial-gradient 배경과 부드러운 아코디언 인터랙션**을 결합하여 60fps를 실현합니다.
- **UI 구조**:
  - **헤더**: `찾기 결과들 - (N개 파일 검색하여 M개 파일에서 X개 일치)` 표시
  - **파일 그룹 노드**: `[파일 아이콘] 파일 이름 (K개 일치)` -> Notepad++처럼 눈이 편안한 연한 초록색 계열 배경과 우측 아코디언 버튼 장착
  - **라인 노드**: `[라인 번호]: [로그 내용]` 형태로 정렬. 검색 조건과 매칭되는 단어들은 **자동 HSL 배경색 하이라이트**로 강조

### 1-4. 하이퍼 점프 및 탭 스위칭 구현
- 라인 노드를 클릭하면, 해당 탭 ID(`tabId`)와 패인(`left` 또는 `right`) 정보를 기반으로 **메인 탭 스위칭(`setActiveTabId`)**을 수행합니다.
- 탭이 전환된 후, 즉시 해당 로그 뷰어의 `scrollToIndex` API를 호출하고 activeLineIndex를 업데이트하여 **0.05초 이내에 정확한 해당 라인의 위치로 초광속 화면 점프 및 포커싱**을 완료합니다.

---

## 2. 세부 변경 대상 파일 및 작업 스펙

### 🛠️ [LogWorkerRegistry.ts](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/hooks/LogWorkerRegistry.ts) [MODIFY]
- 모든 워커 쌍을 순회할 수 있는 `getAllWorkers()` 메서드 노출.
```typescript
getAllWorkers(): Map<string, WorkerPair> {
    return this.workers;
}
```

### 🛠️ [useLogFileOperations.ts](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogFileOperations.ts) [MODIFY]
- `loadFile` 및 파일 체인지 로직 성공 시 `workerRegistry.updateState(tabId, pane, { path: filePath })`를 추가하여 전역 경로 저장 보장.

### 🛠️ [LogProcessor.worker.ts](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/workers/LogProcessor.worker.ts) [MODIFY]
- `SEARCH_GLOBAL_MISSION` 메시지 타입 감지 및 병렬 청크 스캔 로직 구현.
- 각 라인을 읽어 매칭 여부를 판단하고, 매칭된 라인 정보를 `payload: { results: Array<{ lineNum, content }> }` 형태로 응답.

### 🆕 [GlobalSearchResultView.tsx](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/GlobalSearchResultView.tsx) [NEW]
- Notepad++ 스타일 트리 뷰 렌더러.
- 각 파일 노드의 접기/펼치기 지원.
- 매칭 단어 HSL 하이라이트 파싱 유틸 내장.
- 라인 클릭 시 `onJumpToTabLine(tabId, pane, lineIndex)` 콜백 트리거.

### 🛠️ [LogViewerPane.tsx](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogViewerPane.tsx) [MODIFY]
- `selectedRuleId === 'global-mission'` 이며 `!fileName`인 경우, 빈 화면 대신 `Drop a log file here`와 `Search All` 버튼 및 검색 결과를 담은 `GlobalSearchResultView`를 조건부 렌더링.
- 메인 스레드 검색 트리거 훅 연결.

### 🛠️ [LogSession.tsx](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx) [MODIFY]
- 이미 500줄을 초과(1670줄)한 상태임을 형님께 엄격히 보고하고, 추가적인 복잡도가 증가하지 않도록 검색 실행 함수와 결과 바인딩 상태 관리를 외부 비동기 훅 또는 Context를 활용해 최소한의 인터페이스로만 연동.

---

## 3. 검증 계획 (Verification Plan)

### 3-1. 수동 검증 시나리오
1. **탭 다중화**: 3개 이상의 탭을 열고, 각각 다른 로그 파일(예: tizen 로그, 일반 텍스트 로그)을 로드.
2. **글로벌 미션 등록**: `global-mission`에 Happy Combo (`error`, `warn` 등) 등록 및 Block List 등록.
3. **빈 탭에서 드롭다운 선택**: 새로운 빈 탭을 하나 개설한 후 드롭다운에서 `global-mission` 선택.
4. **검색 실행**: 드롭존 자리에 나타난 **Search All in Open Files** 버튼 클릭.
5. **UI 확인**: Notepad++ 스타일로 3개 탭 파일의 검색 결과가 트리 형태로 이쁘게 뿌려지는지 확인. 매칭 키워드가 정확히 노란색 HSL로 하이라이트 되는지 검증.
6. **점프 확인**: 결과 트리 중 하나의 라인을 클릭했을 때 해당 파일 탭으로 즉시 전환되며 해당 로그 위치로 60fps 스크롤 점프되는지 확인.

### 3-2. 빌드 안정성 테스트
- WSL 환경에서 `npx tsc --noEmit` 명령을 날려 정적 타입 에러가 0개인지 철저하게 검수!

---

## 4. 형님 결재용 제안 (Proceed)

형님! 계획서의 내용이 마음에 드신다면 아래 **Proceed** 승인을 내려주십쇼. 승인이 떨어지는 즉시 WSL 리눅스 환경에서 우아하고 신나게 코딩을 시작해 형님의 작업실을 화려하게 빛내보겠습니다! 🐧💎🔥
