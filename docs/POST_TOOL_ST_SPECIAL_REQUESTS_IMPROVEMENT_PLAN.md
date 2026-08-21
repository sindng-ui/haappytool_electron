# PostTool SmartThings Special Requests 편집/저장 및 UI 개선 계획서

## 1. 개요
PostTool 좌측 상단의 SmartThings 3가지 Special Request (`Locations`, `Rooms`, `Devices`)에 대하여:
1. **양방향 편집 및 영속 저장**: 우측 RequestEditor에서 URL, Headers, Body, Auth 등을 수정하면 일반 Request 아이템처럼 실시간/디바운스로 즉시 반영 및 영속 저장(localStorage, AppSettings, Electron 설정 파일)
2. **사이드바 UI 간소화**: 2줄 카드 형태(긴 URL 노출 및 연필 인라인 편집창) 대신 일반 아이템과 동일한 깔끔한 1줄 행(`[GET 배지]` + `[아이콘]` + `[이름]` + `[⚡ 번개 뱃지]`)으로 변경하고, URL은 우측 에디터에서 자유롭게 확인 및 수정
3. **기본 접힘 및 상태 보존**: SmartThings 아코디언 섹션을 기본 접힘(`collapsed: true`) 상태로 설정하고, 유저가 접거나 펼친 상태를 localStorage에 영속 저장하여 유지

---

## 2. 상세 작업 항목

### A. 타입 및 데이터 모델 확장 (`types.ts`, `utils/stDefaults.ts`)
- `STSpecialRequest` 인터페이스를 `SavedRequest`와 100% 호환되도록 확장 (`headers`, `body`, `auth`, `tests`, `extractors` 등 포함).
- `DEFAULT_ST_SPECIAL_REQUESTS`에 기본 headers (`[{ key: 'Accept', value: 'application/json' }, { key: 'Authorization', value: 'Bearer {{bearerToken}}' }, { key: '', value: '' }]` 등) 설정.
- `resolveSTSpecialRequests`에서 유저가 수정한 헤더/인증/바디 정보가 누락 없이 안전하게 병합 및 기본값 fallback 되도록 보장.

### B. 전역 상태 및 영속성 동기화 (`contexts/HappyToolContext.tsx`, `App.tsx`)
- `HappyToolContext`에 `stSpecialRequests`, `setStSpecialRequests` 추가.
- `App.tsx`의 `AppSettings` 로드/저장/Export/Import 파이프라인에 `stSpecialRequests`를 정식 연결하여 앱 재부팅 후에도 수정사항 완벽 유지.

### C. PostTool 편집 & 디바운스 저장 연동 (`components/PostTool.tsx`)
- Special Request 클릭 시 `activeRequestId`를 해당 Special Request의 ID (`locations`, `rooms`, `devices`)로 설정.
- `currentRequest`가 변경될 때:
  - `activeRequestId`가 Special Request ID인 경우 `stSpecialRequests`의 해당 아이템을 디바운스(500ms)로 업데이트.
  - `activeRequestId`가 일반 Request ID인 경우 기존 `savedRequests`를 디바운스 업데이트.
- `SmartThingsExplorerDrawer`의 `onLoadRequest`에서도 동일하게 동작하도록 연동.

### D. UI 디자인 개편 (`components/PostTool/SpecialRequestCard.tsx`, `SmartThingsSection.tsx`)
- `SpecialRequestCard`:
  - 1줄 컴팩트 레이아웃 적용 (일반 Collection Request 아이템과 높이 및 폰트 크기 일치).
  - `[GET 배지] [아이콘] [이름] [⚡ 뱃지]`
  - 불필요한 URL 텍스트 노출 및 연필 편집 모드 제거.
  - 현재 활성 상태(`activeRequestId === req.id`)일 때의 세련된 하이라이트 스타일 적용.
- `SmartThingsSection`:
  - `isCollapsed` 기본값을 `true`(접힘)로 변경.
  - `localStorage.getItem('happytool_st_section_collapsed')` 연동으로 접힘/펼침 상태를 브라우저에 영속 저장.

---

## 3. 파일 라인 수(500줄 초과) 현황 및 리팩토링 계획
- **현재 라인 수 알림**:
  - `App.tsx` (841줄), `components/PostTool.tsx` (618줄), `components/PostTool/RequestSidebar.tsx` (582줄)
- **이번 작업 시 조치**:
  - 기존 파일의 비대화를 방지하고, UI 및 로직 변경을 최소한의 변경으로 정밀 적용.
- **향후 리팩토링 제안**:
  - `PostTool.tsx`: Resize 로직 및 Context 바인딩, Modals 컨테이너를 별도 서브 컴포넌트로 분리하여 400줄 이하로 분할.
  - `RequestSidebar.tsx`: DnD 핸들러 및 Group 렌더러 분리.

---

## 4. 검증 계획
- Vitest 단위/통합 테스트 업데이트 및 실행:
  - `test/components/SpecialRequestCard.test.tsx` (1줄 UI 및 클릭 동작 검증)
  - `test/components/SmartThingsSection.test.tsx` (기본 접힘 및 상태 저장 검증)
  - `test/components/PostToolSTIntegration.test.tsx` (Special Request 로드 및 편집/저장 연동 검증)
  - `test/utils/st-types.test.ts` (타입 및 기본값 병합 검증)
- 전체 빌드 및 TypeScript 타입 체크 무결성 확인.
- `APP_MAP.md` 및 `docs/maps/UI_COMPONENTS.md` 최신화.
