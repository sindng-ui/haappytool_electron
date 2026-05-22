# 📋 글로벌 미션 기반 '열린 파일 모두 검색' 및 하이퍼 점프 구현 계획서 🐧⚡

형님! 대용량 로그 검색 시 UI 프리징을 완벽히 차단하고, 기존 탭 구조에 **0.0001%의 Regression(회귀 장애)도 없는 격리된 하이퍼 점프 시스템**을 구축하기 위한 초정밀 구현 계획서입니다.

---

## 🛡️ 안전 제어 및 회귀 장애(Regression-Free) 방지 대책
1. **Event Bus 기반의 완전 디커플링(Decoupled) 설계**:
   - 탭 스위칭(`setActiveTabId`)과 라인 점프(`jumpToGlobalLine`) 간의 props 지옥을 해소하기 위해 브라우저 네이티브 `CustomEvent` 버스를 전면 도입합니다.
   - 탭 간 의존성을 0%로 만들어 기존 실시간 로깅, 북마크, 로컬 필터링의 안전성을 100% 보장합니다.
2. **500줄 초과 방지 룰 엄격 수호**:
   - 이미 500줄을 아득히 초과한 `useLogExtractorLogic.tsx`(1301줄) 및 `LogSession.tsx`(1670줄)에 추가적인 비동기 통신 코드를 덧대지 않습니다.
   - 검색 전용 고성능 훅인 `hooks/useGlobalSearch.ts`를 신규 생성하여 모든 비동기 통신과 수집 연산을 깔끔하게 격리합니다.
3. **네이티브 메시지 인터셉트 방지**:
   - 기존 React lifecycle에 바인딩된 `onmessage` 리스너를 건드리지 않도록, `Worker` 인스턴스에 고유 `requestId`를 매칭하여 `addEventListener`와 `removeEventListener`로 임시 Promise를 생성하고 검색 직후 말끔히 청소(Cleanup)합니다.
   - 10초 타임아웃 레이스를 결합하여 저사양 PC에서도 특정 탭이 얼었을 때 전체 검색이 멈추지 않도록 안전망을 가동합니다.

---

## 🛠️ 제안하는 상세 구현 계획

### 1. [NEW] [`hooks/useGlobalSearch.ts`](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useGlobalSearch.ts) 생성 🏭
- `searchResults: TabSearchResult[]`, `isSearchingAll: boolean` 전역 검색 상태 관리.
- `searchAllOpenFiles(globalRule: LogRule)` 비동기 병렬 검색 함수:
  - `workerRegistry.getAllWorkers()`를 순회하여 준비된 워커 쌍을 수집.
  - `requestId` 매핑 기반 임시 이벤트 리스너를 통한 `Promise.all` 병렬 스캔.
  - 매칭 결과 취합 후 `searchResults` 상태 갱신.
- `handleJumpToTabLine(tabId: string, pane: 'left' | 'right', lineNum: number)` 점프 핸들러:
  - `global-search-switch-tab` 이벤트를 발행하여 활성 탭 전환 유도.
  - 120ms 미세 지연 후 `global-search-jump-line` 이벤트를 발행하여 타겟 라인으로의 스크롤 점프 트리거.

### 2. [MODIFY] [`components/LogExtractor.tsx`](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogExtractor.tsx) 🖇
- `useGlobalSearch` 훅을 마운트하여 전역 검색 상태 인스턴스화.
- `'global-search-switch-tab'` 커스텀 이벤트를 리스닝하여 `setActiveTabId(e.detail.tabId)` 호출 연동.
- `SessionWrapper` 및 `LogSession`에 검색 상태와 이벤트 핸들러 props 주입.

### 3. [MODIFY] [`hooks/useLogExtractorLogic.tsx`](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.tsx) 🖇
- `'global-search-jump-line'` 커스텀 이벤트를 감지하는 리스너 추가.
- `e.detail.tabId`가 자신의 `tabId`와 일치할 경우에만, 탭 내부에 탑재된 초강력 페이징 지원 점프 함수인 `jumpToGlobalLine(lineNum, pane, 'center')`을 기동하여 즉시 하이퍼 점프 및 포커싱 수행.

### 4. [MODIFY] [`components/LogSession.tsx`](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx) 🎨
- `LogExtractor`로부터 주입받은 `searchResults`, `isSearchingAll`, `onSearchAllOpenFiles`, `onJumpToTabLine`을 그대로 탭 뷰어의 `LogViewerPane`에 완벽하게 브릿지 주입.

---

## 🔬 검증 계획 (Verification Plan)
- **정적 빌드 검증**:
  - `npx tsc --noEmit`을 실행하여 컴파일 오류가 0개인지 철저하게 검증합니다.
- **기존 기능 무결성 검증**:
  - 검색 결과 트리에서 라인 클릭 시, 타겟 탭이 즉시 스위칭되고 해당 로그 영역으로 스크롤과 포커싱이 미려하게 이루어지는지 확인합니다.
  - 실시간 SDB 로깅, 로컬 필터링, 북마크 등의 기존 코어 기능들이 100% 정상 작동함을 크로스 체크합니다.

---

## 📢 형님! 확인 및 코딩 진행 동의 요청 (Proceed Button)

본 초정밀 계획서를 면밀히 검토해 주시고, 아래 버튼을 통해 작업을 기분 좋게 시작해 주십시오!

<button
    id="proceed-button"
    style="
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border: none;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: bold;
        border-radius: 12px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        transition: all 0.2s ease;
    "
    onclick="alert('형님! 신나게 코딩을 시작해 보겠습니다. 잠시만 기다려 주십ショ!')"
>
    🐧⚡ Proceed & Start Coding
</button>
