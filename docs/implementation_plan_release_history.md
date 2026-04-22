# 릴리즈 히스토리 플러그인 구현 계획 (Release History Plugin)

형님, 요청하신 **앱 릴리즈 히스토리 관리 플러그인**에 대한 구현 계획을 최신 요구사항을 반영하여 정리했습니다.

## ⚠️ User Review Required

내용을 확인하시고 `Proceed` 버튼이나 "진행해"라고 말씀해 주시면 바로 코딩을 시작합니다!
> [!IMPORTANT]
> **Proceed 버튼 (여기를 눌러주시면 진행합니다!)** 

## 💡 주요 구현 기능
1. **듀얼 뷰 모드 지원 (핵심)**:
   - **List 모드**: 얌전하고 깔끔하게 요약/카테고리화된 리스트 형태. 제품별/앱별 그룹화 지원.
   - **Timeline/Graph 모드**: 가로축(시간) x 세로축(제품) 기반의 그래프 뷰. 
     - *추가 요구사항 반영*: 히스토리가 길어질 것에 대비해 마우스 휠을 통한 줌 인/줌 아웃(축소/확대) 및 가로 스크롤 완벽 지원.
2. **아이템 정보 및 검색**: 앱 이름, 버전, 날짜, 세부 내용을 포함하며, 해당 조건들로 빠른 검색 제공 (`useMemo`로 렌더링 최적화).
3. **Import/Export 완벽 지원**: JSON(드래그 앤 드롭 포함), 마크다운 테이블, 그리고 PNG 이미지 캡처 기능.
4. **AI 성능 최적화 및 추가 아이디어**: 제품별 자동 컬러 코딩 및 간단한 통계 요약 등 사용자 친화적 요소 반영.

---

## 🛠 Proposed Changes

### [Plugin Core Architecture]
플러그인 기본 골격 및 등록을 담당합니다.

#### [MODIFY] [types.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/types.ts)
- `ToolId` enum에 `RELEASE_HISTORY = 'RELEASE_HISTORY'` 추가.

#### [MODIFY] [config.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/config.ts)
- `PLUGIN_CONFIG`에 `SHOW_RELEASE_HISTORY: true` 추가.

#### [MODIFY] [wrappers.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/core/wrappers.ts)
- `ReleaseHistoryPlugin` Lazy Loading 및 Wrapper 객체 추가 (`icon: History` 사용 예정).
- `ALL_PLUGINS_MAP`에 추가.

#### [MODIFY] [registry.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/registry.ts)
- `RAW_PLUGINS` 배열에 `ReleaseHistoryPlugin` 등록.
- `visibilityMap`에 해당 플러그인 노출 여부 매핑.

#### [MODIFY] [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/APP_MAP.md)
- 신규 플러그인 `Release History` 정보와 인터페이스 구조 업데이트.

---

### [Release History Component]
실제 화면을 구성하는 컴포넌트 코드들입니다. 파일이 너무 커지지 않도록 분리합니다.

#### [NEW] [ReleaseHistoryPlugin.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/ReleaseHistoryPlugin.tsx)
- 메인 컴포넌트. 상단 툴바(뷰 모드 토글, 검색, Export 등) 제공.
- 상태 관리 (아이템 목록, 검색 쿼리, 현재 뷰 모드).

#### [NEW] [ListView.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/components/ListView.tsx)
- 첫 번째 뷰 모드. 깔끔하게 요약되고 카테고리화된 리스트 UI 렌더링. 아코디언 형태로 제품별 접기/펴기 제공.

#### [NEW] [TimelineGraphView.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/components/TimelineGraphView.tsx)
- 두 번째 뷰 모드. 가로(시간) x 세로(제품) 축.
- 휠 스크롤 및 드래그를 이용한 화면 이동(가로 스크롤)과 줌 인/아웃(확대/축소) 로직 구현. (CSS transform 또는 캔버스 기반 렌더링 중 적절한 방식 선택)

#### [NEW] [ReleaseItem.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/components/ReleaseItem.tsx)
- 공통 렌더링 아이템 컴포넌트.
- hover 시 툴팁(간단 정보) 제공, 클릭 시 상세 모달 오픈.

#### [NEW] [ReleaseDetailModal.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/components/ReleaseDetailModal.tsx)
- 아이템 클릭 시 노출될 상세 내용 뷰. Markdown 형식의 Note 지원.

#### [NEW] [AddReleaseModal.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/components/AddReleaseModal.tsx)
- 새로운 릴리즈 기록을 추가/수정하는 모달 컴포넌트.

#### [NEW] [ExportImportUtils.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/utils/ExportImportUtils.ts)
- JSON Import/Export 처리 로직.
- `html-to-image` 패키지를 이용한 TimelineGraphView의 PNG 캡처 로직.
- Markdown Table 형태의 텍스트 변환 로직.

## 🧪 Verification Plan
1. 플러그인이 정상 구동되며 리스트 모드와 그래프 모드 간의 뷰 스위칭이 자연스러운지 확인.
2. 타임라인(그래프) 뷰에서 히스토리 데이터가 많을 때 축소/확대 및 가로 스크롤이 버벅임 없이 동작하는지 확인.
3. Import/Export 기능 테스트.
