# 릴리즈 히스토리 플러그인 작업 내역

- [x] 1. 기본 설정 및 아키텍처 업데이트
  - [x] `types.ts` ToolId 업데이트
  - [x] `config.ts` 플러그인 노출 설정
  - [x] `wrappers.ts` 및 `registry.ts` 에 플러그인 등록
- [x] 2. 플러그인 기본 구조 생성
  - [x] `plugins/ReleaseHistory/types.ts` (데이터 모델)
  - [x] `plugins/ReleaseHistory/ReleaseHistoryPlugin.tsx` (메인 레이아웃 및 툴바)
- [x] 3. 뷰 컴포넌트 구현
  - [x] `ListView.tsx` (카테고리/아코디언 리스트)
  - [x] `TimelineGraphView.tsx` (가로 시간, 세로 제품, 줌/스크롤 지원)
  - [x] `ReleaseItem.tsx` / `ReleaseDetailModal.tsx`
- [x] 4. Export / Import 구현
  - [x] `ExportImportUtils.ts` (JSON, PNG, Markdown)
- [x] 5. APP_MAP.md 업데이트 및 확인
