# NetTraffic CLI 개선 및 GUI 설정 동기화 계획

형님, NetTraffic CLI 기능을 GUI(SingleView, CompareView)와 완벽하게 동기화하기 위한 작업 계획을 세웠습니다. 현재 CLI가 독자적인 기본값을 사용하거나 설정 동기화가 미흡한 부분을 해결하고, 형님이 말씀하신 "Detection keywords, Extraction Template, Traffic Rule"이 CLI에서도 정확히 적용되도록 하겠습니다.

## User Review Required

> [!IMPORTANT]
> - 기존에 `localStorage`에만 저장되던 NetTraffic 설정(UA 패턴, 트래픽 규칙)을 통합 설정 파일(`AppSettings`)로 관리하도록 변경하여 CLI와 공유합니다.
> - 이로 인해 GUI와 CLI 간의 설정이 실시간으로 공유되지만, 기존 `localStorage`에만 있던 설정은 최초 1회 마이그레이션이 필요합니다.

## Proposed Changes

### 1. 전역 설정 엔진 및 타입 업데이트
NetTraffic 전용 설정을 전체 앱 설정 구조에 포함시켜 CLI가 이를 인식할 수 있게 합니다.

#### [MODIFY] [types.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/types.ts)
- `NetTrafficSettings` 인터페이스 추가.
- `AppSettings`에 `netTrafficSettings` 필드 추가.

#### [MODIFY] [App.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/App.tsx)
- `netTrafficSettings` 상태 관리 추가.
- `localStorage`의 레거시 데이터 마이그레이션 로직 추가.
- `HappyToolContext`를 통해 설정을 하위 컴포넌트에 공급.

### 2. GUI 컴포넌트 연동 수정
GUI에서 설정 변경 시 전역 설정이 업데이트되도록 수정합니다.

#### [MODIFY] [NetTrafficAnalyzerView.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/NetTrafficAnalyzer/NetTrafficAnalyzerView.tsx)
- 로컬 `state`와 `localStorage` 직접 접근 코드를 제거하고, `useHappyTool` 컨텍스트의 설정을 사용하도록 변경.

### 3. CLI 핸들러 고도화
형님이 요청하신 대로 GUI와 동일한 규칙으로 필터링 및 분석이 수행되도록 합니다.

#### [MODIFY] [useCliHandlers.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useCliHandlers.ts)
- `handleNetTraffic` 함수에서 전역 설정(`netTrafficSettings`)을 우선적으로 로드.
- `Detection keywords`, `Extraction Template`, `Traffic Rule`이 워커에 정확히 전달되도록 수정.
- 분석 완료 후 터미널에 주요 지표(총 히트 수, 감지된 엔드포인트 수 등)를 요약 출력하여 GUI와 동일한 정보를 제공.

### 4. 분석 워커 로직 확인 (필요 시)
#### [MODIFY] [NetTraffic.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/NetTraffic.worker.ts)
- 현재 `URI_REGEX` 등으로 자동 판단하는 로직 외에, 사용자가 지정한 `extractRegex`가 있을 경우 이를 우선시하도록 로직이 이미 구현되어 있는지 재검증 및 보완.

## Open Questions

- **결과물 포맷**: 현재 CLI는 상세 데이터를 JSON으로 저장합니다. 혹시 텍스트(txt) 형태의 필터링된 결과물도 필요하신가요? (마치 Log Extractor처럼)
- **추가 필터링**: "SingleView에서 필터링해서 보여주는 것과 같이"라고 말씀하셨는데, 이는 단순히 규칙에 맞는 라인만 출력하는 것을 의미하시나요, 아니면 분석된 통계 결과를 의미하시나요? 일단 둘 다 포함하는 방향으로 준비하겠습니다.

## Verification Plan

### Automated Tests
- `npm run cli nettraffic -i sample.log` 명령을 실행하여 설정된 규칙대로 분석되는지 확인.
- `npm run cli nettraffic -l left.log -r right.log` 명령으로 Compare View 로직 작동 확인.

### Manual Verification
1. GUI에서 특정 `Traffic Rule` (예: "MyRule", 키워드 "API_CALL")을 추가하고 저장.
2. CLI를 실행하여 해당 "MyRule"이 결과 JSON에 포함되는지 확인.
3. UA 추출 템플릿 변경 후 CLI 결과물에서 변수 추출이 정상적으로 되는지 확인.

### Proceed
형님, 계획을 확인하시고 [Proceed]를 눌러주시면 바로 신나게 코딩 시작하겠습니다! 🐧🚀
