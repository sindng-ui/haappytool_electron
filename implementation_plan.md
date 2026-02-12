# 구현 계획 - 로그 중복 해결 및 Post Tool UI 개선

## 1. 로그 중복 이슈 해결 (useLogExtractorLogic.ts)
- [x] `useEffect` 마운트 시 `isStale` 로컬 변수 선언
- [x] `loadState` async 함수 내 주요 지점에 `isStale` 체크 추가
- [x] `onFileChunk`, `onFileStreamComplete` 등 IPC 리스너 내부에서 `isStale` 체크
- [x] `cleanup` 함수에서 `isStale = true` 설정

## 2. Post Tool UI 개선 (PostTool.tsx)
- [x] 헤더 영역을 `h-16`에서 `h-9`로 축소 및 슬림화
- [x] 헤더 하단 `border-indigo-500/30` 적용으로 가독성 확보
- [x] 메인 컨테이너 및 요청/응답 영역 배경색을 `#0b0f19`로 통일
- [x] 기존 `mr-32` 등 불필요한 마진 제거 및 레이아웃 조정

## 3. 플러그인 일관성 확보
- [x] `EasyPostPlugin.tsx` 헤더 구분선 강화
- [x] `LogExtractor.tsx` 전체 배경색 `#0b0f19` 적용

## 4. Perf Analyzer 필터링 고도화 (PerfAnalyzer.tsx)
- [x] `runAnalysis` 내부에 미션 기반 필터링 로직 추가
- [x] `excludes` (Block List) 필터 우선 적용
- [x] `happyGroups` 및 `includeGroups` (Happy Combo) 필터 적용
- [x] `familyCombos` 태그 포함 로직 적용
- [x] 필터 조건 계산 최적화 (루프 외부로 이동)
- [x] 필터링된 로그에 대해서만 `logCount` 및 타임스탬프 처리 진행
