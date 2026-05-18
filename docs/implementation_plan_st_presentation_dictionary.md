# 🗺️ SmartThings Device Presentation 사전 구축 구현 계획서 (Implementation Plan) 펭귄-ST 🐧⚡

형님! IoT 개발 및 연동 현업에서 머리 아프게 흩어져 있는 **삼성 SmartThings 자체 기기 및 외부 파트너사 기기들의 다양한 Device Presentation JSON** 데이터를 깔끔하게 수집하고, 무제한으로 초고속 검색/분류할 수 있는 **스마트싱스 프리젠테이션 사전 플러그인** 설계안을 들고 왔습니다! 

이 계획서는 대용량 JSON 처리에 최적화된 **고성능 파일 시스템 기반 로컬 DB 설계**, **비동기 멀티 키워드 검색 엔진**, 그리고 보는 순간 감탄이 절로 나오는 **SmartThings 모바일 앱 UI 프리뷰 시뮬레이터**까지 완벽하게 정의되어 있습니다.

---

## 🏗️ 1. 아키텍처 개요 (System Architecture)

대용량 및 무제한 데이터를 다루면서도 HappyTool UI가 프레임 드랍 없이 60fps로 매끄럽게 동작하게 만들기 위해 **"메타데이터 캐시 + 지연 파일 로딩 + 백그라운드 비동기 IPC 검색"** 패턴을 적용합니다.

```mermaid
graph TD
    subgraph UI Renderer (React)
        A[ST Presentation View] -->|IPC Request| B(Electron IPC Bridge)
        A -->|Clipboard Monitor| C[Clipboard Daemon]
        A -->|UI Simulation| D[ST Mobile App Mock Preview]
    end

    subgraph Electron Main Process (NodeJS/CJS)
        B -->|st-presentation:list| E[stPresentationService]
        B -->|st-presentation:search| E
        B -->|st-presentation:save| E
        E -->|Read/Write Index| F[(metadata_index.json)]
        E -->|Lazy Read/Write Presentation JSON| G[(/userData/st_presentations/*.json)]
    end
```

### 1) 💾 초고속 무제한 로컬 파일 DB 설계
- **개별 JSON 분리 저장**: 기기당 1개의 JSON 파일을 `userData/st_presentations/<manufacturerName>__<presentationId>.json` 경로에 분리하여 저장합니다. 이를 통해 수백 메가바이트의 데이터가 쌓여도 전체 데이터를 메모리에 올리지 않고 필요 시에만 비동기로 로드(Lazy Load)합니다.
- **메타데이터 캐시 인덱스 (`metadata_index.json`)**: 
  - 검색 및 카테고리 분류 속도를 0.001초 대로 만들기 위해 가벼운 인덱스 파일 하나만 상시 유지합니다.
  - 인덱스 레코드 스키마:
    ```typescript
    interface STPresentationMeta {
      presentationId: string;
      manufacturerName: string;
      customName: string;      // 형님이 지정하는 별칭
      categories: string[];     // 카테고리 태그 (예: 삼성 TV, 카메라 등)
      capabilities: string[];   // 포함된 smartthings capabilities
      components: string[];     // 컴포넌트 목록 (예: main)
      createdAt: string;
      filePath: string;         // 실제 JSON 파일 상대 경로
    }
    ```
- **카테고리 메타데이터 (`categories.json`)**:
  - 유저 커스텀 카테고리를 저장하고 관리하는 가벼운 설정 파일.

### 2) 🔍 2단계 성능 우선 검색 엔진 (Performance Guard Search)
- **이름/카테고리 검색**: `metadata_index.json` 메모리 배열에서 즉각적으로 필터링하여 반응성 100% 보장.
- **내용 검색 (단어 여러 개 동시 포함)**:
  - 사용자가 입력한 여러 키워드(예: `tv display audio`)가 JSON 본문 안에 모두 포함되어 있는지 확인하는 연산은 무거울 수 있습니다.
  - 이를 위해 **Electron 메인 프로세스의 비동기 파일 스캔 오케스트레이션**을 수행합니다. `fs.promises.readFile`을 사용해 백그라운드 스레드 풀에서 파일을 스트리밍 형식으로 읽으며 다중 키워드를 검사하여 렌더러 UI의 차단(Stall)을 원천 봉쇄합니다! 

---

## 🛠️ 2. 핵심 구현 단계 (Phase & Components)

### Phase 1: Electron IPC 및 파일 기반 DB 인프라 구축
- `server/services/stPresentationService.cjs` 생성.
- `userData/st_presentations` 디렉터리 자동 생성 및 I/O 헬퍼 구현.
- IPC 채널 등록:
  - `st-presentation:list`: 저장된 메타데이터 목록과 전체 카테고리 목록 반환.
  - `st-presentation:save`: 클립보드 또는 파일 업로드를 통해 들어온 JSON 검증 후 인덱스 업데이트 및 파일 저장.
  - `st-presentation:delete`: 특정 프리젠테이션 JSON 및 인덱스 삭제.
  - `st-presentation:search`: 다중 쿼리 및 태그 기반 고성능 검색 결과 반환.
  - `st-presentation:update-category`: 특정 기기의 카테고리 일괄 업데이트.
  - `st-presentation:update-categories-list`: 카테고리 전체 목록 편집 및 저장.

### Phase 2: React UI & ST Mobile App 시뮬레이터 개발
- **Bento Grid & Glassmorphism 대시보드** 구현 (성능 저하를 막기 위해 CSS `backdrop-blur` 대신 투명도 그라데이션과 부드러운 아우라 효과 적용).
- **Import Dialog**: JSON 파일 드래그 앤 드롭 및 클립보드 복사-붙여넣기 폼 제공.
- **Schema-Aware Detail View**:
  - 좌측: 기기 메타데이터 및 분석 정보 (Capabilities 목록, Automation 조건/동작 추출).
  - 우측: **스마트싱스 모바일 앱 Mock Preview**! 
    - 실제 ST 모바일 앱 화면처럼 대시보드 카드(스위치 토글, 상태 텍스트)와 상세 보기 화면(다양한 Capability의 UI 카드 목록)을 반응형 CSS로 흉내 내어 렌더링.
    - JSON 내부의 `dashboard.states`, `detailView` 구조를 분석하여 동적으로 모바일 UI 컴포넌트를 렌더링하는 시뮬레이션 엔진.

### Phase 3: 클립보드 백그라운드 스니퍼 (Clipboard Sniffer)
- React 컴포넌트 내에서 1.5초 주기로 클립보드를 안전하게 폴링.
- JSON 파싱을 시도하여 `"presentationId"`와 `"manufacturerName"`이 둘 다 존재할 경우, "클립보드에 SmartThings Presentation JSON이 감지되었습니다! 가져올까요?" 배너 노출.
- 배너 클릭 시 즉시 가져오기 팝업이 활성화되어 원클릭 임포트 가능.

---

## 📄 3. JSON 스키마 분석 (Schema Analysis)
`https://developer.smartthings.com/docs/api/public/#tag/Presentations/operation/getDevicePresentation` 명세에 따른 핵심 파싱 대상 데이터:
1. `presentationId`: 프리젠테이션 고유 식별자.
2. `manufacturerName`: 제조사 정보 (삼성전자, 파트너사 등).
3. `dashboard`:
   - `states`: 대시보드 카드에 노출될 상태 속성 정보.
   - `actions`: 대시보드 카드에서 원클릭 제어할 액션 정보.
4. `detailView`:
   - 디바이스 상세 화면에 정렬될 Capability 리스트. 각 Capability는 `component`, `capability`, `version` 정보를 가짐.
5. `automation`:
   - `conditions`: 자동화 루틴 '조건(IF)'으로 사용 가능한 스키마.
   - `actions`: 자동화 루틴 '동작(THEN)'으로 사용 가능한 스키마.

---

## 📂 4. 생성 및 수정될 파일 구조 (Files to Create & Modify)

### 1) 백엔드 및 서비스 (Backend)
- 🆕 `server/services/stPresentationService.cjs`: 로컬 디스크 파일 DB 및 IPC 핸들러 서비스.
- ✏️ `server/index.cjs`: `stPresentationService.cjs` 초기화 및 IPC 리스너 바인딩.

### 2) 프론트엔드 플러그인 (Frontend Plugin)
- 🆕 `plugins/STPresentationDictionary/index.tsx`: 플러그인 메인 뷰 (Search & Layout).
- 🆕 `plugins/STPresentationDictionary/components/CategoryFilter.tsx`: 카테고리 트래킹/관리 바.
- 🆕 `plugins/STPresentationDictionary/components/ImportDialog.tsx`: 클립보드/파일 임포트 모달.
- 🆕 `plugins/STPresentationDictionary/components/STAppPreview.tsx`: 기기 모바일 UI 프리뷰 시뮬레이터.
- 🆕 `plugins/STPresentationDictionary/components/PresentationDetail.tsx`: JSON 뷰어 및 스키마 정보 요약 뷰.
- ✏️ `plugins/registry.ts`: 신규 플러그인 등록.
- ✏️ `plugins/config.ts`: 실험실 플러그인 활성화 플래그 추가.
- ✏️ `important/APP_MAP.md`: 인터페이스 맵 업데이트.

---

## ⚙️ 5. 성능 및 예외 처리 가드 (Performance & Exception Guard)
- **WASM/Worker Zero-Blocking**: 대형 JSON 파일을 파싱하거나 필터링할 때 UI가 버벅이지 않도록 비동기 스트림 및 타임아웃 200ms를 두어 검색 작업을 데코레이션합니다.
- **안전한 클립보드 폴링**: 클립보드에 기가바이트 크기의 텍스트가 있을 경우 복사 감지 시 렉이 걸릴 수 있으므로, 텍스트 길이 제한(최대 10MB) 및 비동기 JSON 정규식 매칭을 거친 후 파싱을 시도하는 2중 안전 장치 탑재.
- **유효성 검사 (JSON Schema Validation)**: 프리젠테이션 JSON이 비어 있거나 스키마가 일치하지 않는 손상된 데이터일 경우 우아한 예외 경고 표시.

---

## 🐧 형님! 계획서 검토 부탁드립니다!

본 구현 계획이 마음에 드신다면 아래 **[PROCEED]** 버튼과 함께 피드백을 주십쇼! 

리눅스 개발자 펭귄 동생이 즉시 WSL Bash 환경에서 우렁차게 날갯짓하며 완벽한 코드를 작성하고 지도를 최신화하겠습니다! 🚀🥊

```markdown
<!-- proceed-button -->
[PROCEED_TO_DEVELOPMENT]
```
