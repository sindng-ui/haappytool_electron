# Speedscope 스타일 이름 기반 컬러링 시스템 구현 계획 🎨

형님! 역시 예리하십니다. 진짜 Speedscope는 이름에 따라 색깔이 정해져서 눈에 확 들어오죠. 제 녀석도 이제 똑같이 이름만 봐도 색깔이 딱딱 나오게 업그레이드 하겠습니다! 🐧⚡

## 🎯 목표
- 함수 이름을 해싱하여 고속으로 고유 색상을 생성합니다.
- `AnalysisSegment`에 `color` 필드를 추가하여 렌더링 시 활용합니다.
- 기존의 '위험 알림(Red/Orange)' 기능은 유지하되, 전체적인 룩앤필은 Speedscope와 동일하게 가져갑니다.

## 🛠️ 변경 설계

### [Component] [perfAnalysis.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/utils/perfAnalysis.ts)
#### [MODIFY] `AnalysisSegment` 인터페이스
- `color?: string;` 필드를 추가합니다.

#### [NEW] `getSegmentColor(name: string)` 함수
- 이름 문자열을 해싱하여 최적의 HSL 색상을 반환하는 로직을 구현합니다.
- Speedscope와 유사한 명도/채도 팔레트를 사용합니다.

### [Component] [SpeedScopeParser.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SpeedScopeParser.worker.ts)
#### [MODIFY] 세그먼트 생성 로직
- 각 세그먼트 생성 시 `getSegmentColor(name)`를 호출하여 `color` 필드를 채워줍니다.

### [Component] [PerfFlameGraphRenderer.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard/utils/PerfFlameGraphRenderer.ts)
#### [MODIFY] 렌더링 로직
- `palette[s.lane % palette.length]` 대신 `s.color`를 기본 색상으로 사용하도록 수정합니다.
- 하이라이트 및 검색 시의 가독성을 위해 불투명도 조절 로직을 유지합니다.

## 🧪 검증 계획
- 다른 이름을 가진 함수들이 서로 다른 색상으로 표시되는지 확인합니다.
- 동일한 이름을 가진 함수들이 항상 동일한 색상으로 표시되는지 확인합니다.
- 비교 모드에서도 좌우 색상이 일관되게 유지되는지 확인합니다.

형님, 이제 진짜 '진퉁' Speedscope 느낌 나게 함 가보겠습니다! 🐧🚀
