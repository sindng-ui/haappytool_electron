# Everything Search 플러그인 구현 계획서 📂✨

형님! 윈도우 최고의 파일 검색 도구인 **Everything**의 기능을 HappyTool에 녹여내기 위한 계획입니다. 
Everything의 압도적인 속도를 활용하여 HappyTool 내에서 즉시 파일을 찾고 활용할 수 있도록 구성하겠습니다.

## User Review Required

> [!IMPORTANT]
> **Everything 엔진 연동 방식 결정**
> 현재 Node.js 공식 라이브러리가 없으므로, 다음 두 가지 방식 중 하나를 선택해야 합니다:
> 1. **HTTP Server 방식 (권장)**: Everything 앱 설정에서 'HTTP 서버'를 활성화하여 JSON API로 통신 (가장 빠르고 안정적)
> 2. **CLI (es.exe) 방식**: Everything 전용 커맨드라인 도구를 실행하여 결과 파싱 (es.exe 설치 필요)
> 
> 일단 **HTTP Server 방식**을 우선적으로 구현하되, 설정에서 선택 가능하도록 설계하겠습니다.

> [!WARNING]
> **Server Refactoring 알림**
> 현재 `server/index.cjs` 파일이 **2839줄**로, 형님의 "500줄 규칙"을 크게 초과하고 있습니다. 👮
> 이번 플러그인 로직은 반드시 `server/services/everythingService.cjs`로 분리하여 작성하고, 추후 전체적인 서버 리팩토링 계획도 병행하겠습니다.

## Proposed Changes

### 1. Backend Service (Node.js)

#### [NEW] [everythingService.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/services/everythingService.cjs)
- Everything HTTP API 또는 CLI와 통신하는 핵심 로직 담당.
- Socket.io를 통해 프론트엔드와 실시간 검색 결과 공유.
- 성능 최적화를 위해 검색 결과 페이징(Chunking) 지원.

#### [MODIFY] [index.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/index.cjs)
- `everythingService`를 로드하고 Socket.io 이벤트를 바인딩.

### 2. Frontend Plugin (React)

#### [MODIFY] [types.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/types.ts)
- `ToolId`에 `everything-search` 추가.

#### [NEW] [EverythingSearch](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/EverythingSearch/index.tsx)
- **UI Design**: 
  - 고급스러운 글래스모피즘(Glassmorphism) 스타일의 검색 인터페이스.
  - 파일 타입별 아이콘 및 용량, 수정일자 표시.
  - 더블 클릭 시 탐색기에서 열기/파일 실행 기능.
- **Performance**:
  - `react-virtuoso`를 사용하여 수만 개의 검색 결과도 버벅임 없이 렌더링.
  - 입력 디바운싱(Debouncing) 적용으로 서버 부하 최소화.

#### [MODIFY] [wrappers.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/core/wrappers.ts)
- `EverythingSearchPlugin` 정의 추가 (아이콘: `Search` 또는 `FileSearch`).

#### [MODIFY] [registry.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/registry.ts)
- `ALL_PLUGINS`에 새 플러그인 등록.

### 3. Documentation & Mapping

#### [MODIFY] [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/important/APP_MAP.md)
- 새 플러그인 정보와 인터페이스 규격 업데이트.

## Open Questions

1. **형님, Everything 앱에서 HTTP 서버를 켜두실 수 있나요?** (도구 -> 설정 -> HTTP 서버) 이 방식이 성능과 데이터 구조 면에서 가장 깔끔합니다. 
2. **검색 결과에서 바로 파일을 열거나 편집하는 기능** 외에, 다른 플러그인(예: Log Analysis Agent)으로 파일을 즉시 전달하는 기능도 바로 넣을까요?

## Verification Plan

### Automated Tests
- `es.exe` 또는 HTTP Mock 서버를 이용한 검색 결과 파싱 유닛 테스트.

### Manual Verification
- 실제 Everything 검색 결과와 HappyTool UI 결과 일치 여부 확인.
- 대량 검색 결과(1,000개 이상) 시 스크롤 부드러움 확인.
- 파일 열기/폴더 열기 동작 확인.

---
형님, 계획이 마음에 드시면 **수락** 혹은 **진행해**라고 말씀해 주세요! 🐧🚀
