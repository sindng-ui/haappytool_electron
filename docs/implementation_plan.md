# Speed Scope 분석 플러그인 구현 계획

형님! 요청하신 Speed Scope 분석 플러그인 구현 계획서입니다. 기존 Perf Tool의 강력한 시각화 엔진을 활용하면서도, Speed Scope 특유의 계층형 데이터를 완벽하게 지원하도록 설계했습니다.

## Proposed Changes

### 1. 전역 시스템 설정 및 플러그인 등록
- **[MODIFY] [types.ts](file:///c:/AntigravityWorkspace/happytool_electron/haappytool_electron/types.ts)**
  - `ToolId` 열거형에 `SPEED_SCOPE` 추가.
- **[MODIFY] [wrappers.ts](file:///c:/AntigravityWorkspace/happytool_electron/haappytool_electron/plugins/core/wrappers.ts)**
  - `SpeedScope` 컴포넌트 Lazy Load 설정 및 `SpeedScopePlugin` 래퍼 정의.
- **[MODIFY] [registry.ts](file:///c:/AntigravityWorkspace/happytool_electron/haappytool_electron/plugins/registry.ts)**
  - `ALL_PLUGINS` 리스트에 `SpeedScopePlugin` 등록.

---

### 2. Speed Scope 핵심 로직 (Engine)
- **[NEW] SpeedScopeParser.worker.ts** (in `workers/`)
  - `dotnet-trace` Speed Scope JSON 포맷 파싱.
  - **[IMPORTANT] 메인 스레드(Main Thread) 자동 식별 및 필터링**: 여러 스레드 데이터 중 메인 스레드 프로파일만 추출하여 분석 대상으로 삼습니다.
  - `profiles.events` 기반의 Call Stack Depth 계산 및 `AnalysisSegment` 변환.
  - 대용량 JSON 처리를 위한 스트리밍 파서(선택적) 또는 최적화된 루프 구현.
- **[NEW] useSpeedScopeState.ts** (in `components/SpeedScope/hooks/`)
  - 파일 로드, 파싱 상태 관리.
  - 다중 검색 키워드 로컬 저장소(`localStorage`) 연동 및 관리.
  - 비교 모드 시 두 파일의 데이터 동기화 관리.

---

### 3. UI 및 시각화 (Components)
- **[NEW] SpeedScopePlugin.tsx** (in `components/SpeedScope/`)
  - 플러그인 메인 레이아웃.
  - 파일 드롭존 (싱글/듀얼 지원).
  - 상단 컨트롤 바 (Fail 시간 입력, 다중 키워드 검색, 탐색 버튼).
- **[MODIFY] PerfDashboard.tsx** (재사용 및 확장)
  - `failThreshold` (ms) 프로퍼티 추가: 임계값보다 긴 세그먼트 하이라이트.
  - 다중 키워드 매칭 로직 강화 (OR 조건 검색).
  - 네비게이션 인덱싱 로직에 필터 조건 반영.

---

### 4. 주요 기능 상세 구현
- **Fail Only 탐색**:
  - `failThreshold`보다 큰 세그먼트들만 추출하여 `< >` 버튼으로 시간순/오래걸린순 탐색 제공.
- **다중 키워드 검색**:
  - 유저가 입력한 여러 단어 중 하나라도 포함된 세그먼트를 밝게 표시.
  - 검색 히스토리는 로컬 저장소에 보관하여 재사용 가능.
- **파일 비교 (Comparison Mode)**:
  - 두 파일을 로드했을 때 좌우 또는 상하 분할 뷰 제공.
  - 한쪽에서 줌/팬/필터링 시 다른 쪽도 연동되는 Sync 기능 제공 (옵션).

## Verification Plan

### Automated Tests
- `workers/SpeedScopeParser.test.ts`: 다양한 크기와 깊이의 Speed Scope JSON 파싱 정확도 검증.
- `utils/searchUtils.test.ts`: 다중 키워드 매칭 로직 유닛 테스트.

### Manual Verification
1. `dotnet-trace`로 추출한 실제 Speed Scope JSON 파일 로드 테스트.
2. Fail 시간(ms) 입력 후 Flame Map 상의 하이라이트 변화 확인.
3. 다중 키워드 입력 후 검색 결과 하이라이트 및 탐색 네비게이션 동작 확인.
4. 파일 2개 드롭 후 비교 모드 UI 및 필터 연동 확인.
5. 대용량 파일(100MB+) 로드 시 UI 프리징 여부 및 Worker 동작 확인.

---
형님, 위 계획대로 진행해도 될까요? 승인해주시면 바로 코딩 들어가겠습니다!

<button id="proceed_button">Proceed</button>
