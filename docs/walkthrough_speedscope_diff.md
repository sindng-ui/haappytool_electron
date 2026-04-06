# SpeedScope 통합 비교 모드 (Unified Diff) 구현 완료 🚀

형님, 요청하신 SpeedScope 플러그인의 '통합 비교 모드' 개발을 완료했습니다! 이제 두 프로파일의 차이를 찾기 위해 눈을 좌우로 굴리실 필요가 없습니다.

## 🌟 주요 구현 내용

### 1. Differential Flame Graph 시각화
- **Target 구조 기반**: 두 번째로 로드한 파일의 호출 트리를 기준으로 렌더링합니다.
- **색상별 성능 진단**:
  - <span style="color: #ef4444; font-weight: bold;">빨간색 (Regressed)</span>: 이전보다 실행 시간이 길어진 구간 (진할수록 차이가 큼)
  - <span style="color: #60a5fa; font-weight: bold;">파란색 (Improved)</span>: 최적화되어 시간이 단축된 구간
  - <span style="color: #10b981; font-weight: bold;">초록색 (Added)</span>: 기존에 없던 새로운 호출 구간
  - <span style="color: #475569; font-weight: bold;">회색 (Neutral)</span>: 유의미한 변화가 없는 구간

### 2. 스마트 매칭 엔진 (`utils/performanceDiff.ts`)
- 함수 이름과 호출 깊이(Lane)를 기반으로 두 프로파일 간의 대응 관계를 자동으로 찾아냅니다.
- 10% 이상의 변화나 5ms 이상의 차이가 있을 때만 색상 변화를 주어 노이즈를 최소화했습니다.

### 3. 기존 기능 유지 (싱글 뷰 보존)
- 형님께서 강조하신 대로 **싱글 뷰 기능은 전혀 건드리지 않았습니다.**
- 파일이 하나일 때는 기존과 동일하게 동작하며, 두 개를 로드했을 때만 `Unified Diff` 버튼이 활성화됩니다.
- 기존의 사이드-바이-사이드 비교 방식도 그대로 사용 가능합니다.

## 🛠️ 변경 파일 목록

- [performanceDiff.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/utils/performanceDiff.ts): [NEW] 비교 알고리즘 구현
- [PerfFlameDiff.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/SpeedScope/PerfFlameDiff.tsx): [NEW] 통합 비교 전용 FlameGraph 컴포넌트
- [PerfFlameDiffRenderer.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/SpeedScope/utils/PerfFlameDiffRenderer.ts): [NEW] 고성능 캔버스 렌더러
- [SpeedScopePlugin.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/SpeedScope/SpeedScopePlugin.tsx): [MODIFY] UI 통합 및 모드 전환 로직 추가
- [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/APP_MAP.md): [MODIFY] 신규 기능 명세 업데이트

## 🧪 검증 결과
- **컴파일 체크**: 모든 구문 오류 수정 완료 및 Lint 체크 통과.
- **로직 검증**: 베이스와 타겟의 시간 차이에 따른 색상 매핑 로직 확인.
- **싱글 뷰 테스트**: 단일 파일 로드 시 기존 `PerfDashboard` 정상 동작 유지 확인.

형님, 이제 성능 비교가 훨씬 더 즐거워지실 겁니다! 추가로 더 필요한 기능 있으면 말씀만 해주십쇼! 🐧
