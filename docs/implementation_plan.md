# 분석 엔진 복구 및 정밀 구간 매칭 계획 🐧🛠️

형님! 이전의 단순 매칭 방식은 멀티스레드 환경에서 로그가 섞일 때 인터벌을 놓치는 문제가 있었습니다. 형님이 예시로 들어주신 `hwservice.cpp:hwfunc(123)` -> `SmartThings.cs:OnCreate(123)` 구간을 정확히 찾아내기 위해 엔진을 전면 개정하겠습니다!

## Proposed Changes

### 1. `utils/perfAnalysis.ts` - 파서 정밀도 개선
- **유연한 라인 번호 추출**: `FunctionName(123)` 뒤에 다른 텍스트(로그 메시지 등)가 붙어 있어도 라인 번호를 낚아챌 수 있도록 정규식 수정.
- **파일명 탐색 범위 확장**: 타임스탬프 바로 뒤에 공백 없이 파일명이 붙는 케이스(Android/Tizen 하이브리드 형식) 등에 대응.

# Timeline 네비게이션 및 UI 정밀 개선 계획

형님, Timeline 탭에서 네비게이션 시 리스트 포커스가 이동하지 않는 문제와 연결선 UI의 시각적 어설픔을 해결하기 위한 정밀 개선 계획입니다.

## 주요 개선 사항

### 1. Timeline 리스트 자동 스크롤 (Focus)
- `handleItemClick` 함수 내에 Timeline 리스트 컨테이너 내에서의 자동 스크롤 로직을 추가합니다.
- `prev` / `next` 버튼 클릭 시 또는 항목 클릭 시, 해당 항목이 리스트 중앙에 오도록 `scrollIntoView`를 적용합니다.

### 2. 연결선(Visual Connector) UI 리뉴얼
- `FROM` 박스와 `TO` 박스 사이의 연결선을 더욱 세련되게 수정합니다.
- 현재의 어설픈 화살표와 겹치는 선을 제거하고, 하나의 연속된 그라디언트 라인과 깔끔한 화살표 촉을 결합한 일체형 디자인으로 변경합니다.
- 상태(Error, Regression 등)에 따른 테마 컬러가 연결선에도 자연스럽게 녹아들도록 개선합니다.

## Proposed Changes

### Split Analyzer Panel

#### [MODIFY] [SplitAnalyzerPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/SplitAnalyzerPanel.tsx)
- `handleItemClick` 함수에 `document.getElementById`와 `scrollIntoView`를 활용한 리스트 내부 스크롤 로직 추가.
- Timeline 항목 내의 'Connector Area'를 SVG 또는 개선된 CSS 구조로 리팩토링하여 시각적 완성도 향상.

### 2. `workers/SplitAnalysisUtils.ts` - 디버깅 로그 및 로직 강화
- **전략**: 각 로그를 처리할 때, 현재 로그가 '의미 있는 로그'라면 이전 100줄(Gap Window) 내 소스 매칭 시도 내역을 로그로 남깁니다.
- **가시성**: 분석 시작(Total Lines), 첫 매칭 성공 케이스, 샘플링된 시그니처 형식을 콘솔에 출력하여 형님이 직접 확인할 수 있게 합니다.

### 3. `workers/workerAnalysisHandlers.ts` - 상태 보존 및 통계 요약
- 배칭 처리 시 `aggState`가 세션 동안 안정적으로 유지되는지 확인하고, 최종적으로 생성된 `metrics`의 총 개수를 요약 보고합니다.

---
형님, 이 디버깅 도구가 포함된 계획대로 진행해도 될까요? 승인해주시면 바로 결과가 나오도록 수술 시작하겠습니다! 🐧🚀

[PROCEED](command:antigravity.proceed)

## Verification Plan

### Manual Verification
1. 왼쪽 로그에서 특정 구간(`fileA:funcA(N)` -> `fileB:funcB(M)`) 확인.
2. 오른쪽 로그에서도 동일한 소스 위치의 로그들이 존재하는지 확인.
3. 분석 리포트에서 해당 인터벌이 잡히는지, 그리고 시간차(Delta)가 계산되는지 검증.

### Automated Tests
- `prev` / `next` 버튼 클릭 시 `selectedKey`가 변경되고 리스트가 해당 항목으로 스크롤되는지 육안 확인.
- 다양한 상태(Error, Regression, Improvement)에서 연결선의 색상과 모양이 일체감 있게 표시되는지 확인.

---
형님, 이 계획대로 진행해도 될까요? 승인해주시면 바로 코딩 들어가겠습니다! 🐧🚀
