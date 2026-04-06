# [NetTraffic Analyzer] 네트워크 트래픽 분석기 구현 계획서

대용량 네트워크 트래픽 로그를 분석하고, 다양한 조건으로 필터링하며, 동일 트래픽 그룹핑 및 다중 로그 비교 분석까지 수행할 수 있는 신규 플러그인입니다. 기존 Log Extractor의 Happy Combo 방식처럼 직관적인 다중 패턴 검색과 정규식 기반 변수(UUID, IP 등) 추출 기능을 제공합니다.

## User Review Required

형님, 기획하신 내용 기반으로 구조를 잡았습니다! 확인 부탁드립니다. 🐧

- **UI/UX 흐름**: 단일 파일 분석 모드와 2개 파일 비교 분석 모드(Split Mode)를 탭으로 분리하여 제공할 계획입니다.
- **트래픽 패턴 및 그룹화**: 
  - 유저가 "검색어 체인(예: `user-agent` + `http://`)"을 입력하면, 이를 하나의 `그룹(Segment)`으로 명명하고 취합할 수 있는 UI 폼을 제공하겠습니다.
  - 변수 기준 카운팅(locationID, deviceId 등)은 정규식 그룹 캡처 `( )` 를 활용하여 동적으로 추출하고 묶어주는 방식을 사용하겠습니다.
- **처리 성능 (Performance Standards 준수)**: 대용량 로그 처리를 위해 메인 스레드 락을 방지하는 전용 Web Worker(`NetTraffic.worker.ts`)를 신설하여 1GB 로그도 부드럽게 병합/카운팅 되도록 설계하겠습니다.

> **작업을 바로 시작해도 될까요? 승인해주시면 (Proceed) 즉시 코딩에 돌입하겠습니다!** 🚀

---

## Proposed Changes

### [Plugin UI & Foundation]
#### [NEW] `components/NetTrafficAnalyzer/NetTrafficAnalyzerPlugin.tsx`
- 메인 플러그인 컨테이너 컴포넌트입니다. `BigBrainContext`에서 전역 상태를 구독하고, 탭(Single / Compare) 라우팅을 담당합니다.
#### [NEW] `components/NetTrafficAnalyzer/NetTrafficAnalyzerView.tsx`
- 실제 분석 UI (로그 파일 Drag & Drop, 검색 패턴/그룹 지정 폼 및 데이터 그리드 렌더링). 가상 스크롤 혹은 페이징을 적용해 분석 결과가 수만 건이라도 60fps를 방어합니다.

### [Plugin Registration]
#### [MODIFY] `plugins/types.ts`
- `ToolId` 열거형에 `plugin-net-traffic` 식별자 추가
#### [MODIFY] `plugins/core/wrappers.ts`
- `NetTrafficAnalyzerWrapper` 정의 및 시스템 아이콘 배정 (ex: `Activity` 또는 `Network`)
#### [MODIFY] `plugins/registry.ts`
- `ALL_PLUGINS` 배열에 래퍼 등록하여 사이드바 메뉴에 즉시 표출

### [Analysis Engine (Worker & Logic)]
#### [NEW] `workers/NetTraffic.worker.ts`
- 로그 텍스트를 라인 바이 라인으로 순회하며 패턴 매치 카운팅, 변수 추출 및 Split Diff 연산(Left vs Right 로그 비교)을 수행하는 비동기 워커.
#### [NEW] `hooks/useNetTrafficLogic.ts`
- 워커와 통신하고 진행률(`progress`)과 최종 매핑 결과(Map 데이터)를 React 상태로 바인딩하는 커스텀 훅.

### [Documentation & Meta]
#### [MODIFY] `important/APP_MAP.md`
- "8. Major Plugins" 또는 "Lab Plugins" 섹션에 `NetTraffic Analyzer` 구조 및 아키텍처 매핑 명세 추가.

---

## Verification Plan

### Automated Tests
- TypeScript 타입 에러 점검: `npx tsc --noEmit` 실행하여 누락된 인터페이스나 오타 감지.

### Manual Verification
1. **단일 로그 테스트**
   - 개발 서버 실행 후 NetTraffic Analyzer 진입.
   - 100MB 이상 Dummy 로그 업로드 후, 특정 패턴(예: `GET /api` + `200 OK`)과 변수 정규식(`deviceId=(.*?)`) 지정.
   - "분석" 버튼 클릭 후, Device ID 별 트래픽 누적 카운트가 `Top K` 순으로 빠른 시간(1~2초 내)에 정렬 렌더링되는지 확인.
2. **비교(Split Diff) 테스트**
   - 탭을 '비교 모드'로 전환 후 2개의 로그 파일(v1, v2) 로드.
   - 동일 패턴으로 분석 실행 시, v1 대비 v2에서의 카운트 증감률(예: +150%, -20%) 데시보드 표출 확인.
3. **메모리 누수 검증**
   - 분석 완료 후 다른 플러그인 이동 시 워커 정상 종료 및 힙 메모리 500MB 미만 회수되는지 브라우저 Task Manager로 확인.
