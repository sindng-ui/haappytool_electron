# 🚀 Log Analysis Agent UI 고도화 계획

형님! Log Extractor의 고급진 그라데이션 유리 효과를 Log Analysis Agent 플러그인에도 그대로 이식해드리겠습니다. 좌우로 은은하게 퍼지는 그라데이션과 함께 섹션들이 입체적으로 보이도록 리팩토링하겠습니다.

## 🛠️ 주요 변경 사항

### 1. `AgentConfigPanel.tsx` UI 구조 개선
- 모든 섹션(`Analysis Mode`, `Log Sources`, `Target Context`)을 `card-gradient` 래퍼로 감싸고, 내부에는 `from-white/10 via-transparent to-white/10` 형태의 좌우 그라데이션 오버레이를 추가합니다.
- 섹션 배경을 좀 더 투명하고 깊이감 있는 유리 스타일(Glassmorphism)로 변경합니다.

### 2. 버튼 및 입력 필드 스타일 업그레이드
- 분석 유형(Analysis Type) 선택 버튼들에 호버 효과와 선택 시 발광(Glow) 효과를 강화합니다.
- PID/TID/Hint 입력 필드에도 동일한 그라데이션 유리 효과를 적용하여 통일감을 줍니다.
- 'Execute Analysis' 버튼의 시각적 무게감을 유지하면서 주변 요소들과 조화롭게 배치합니다.

### 3. CSS 유틸리티 최적화
- `index.css`에 정의된 `glass`, `card-gradient` 등의 유틸리티를 적극 활용하고, 필요한 경우 인라인으로 미세한 투명도와 그라데이션 각도를 조절합니다.

## 📐 디자인 상세 (예정)
- **Border**: `border-white/5` 및 `border-slate-800/60` 조합.
- **Background**: `bg-slate-900/40` 기반의 블러 효과.
- **Overlay**: 좌우 측면에 `from-white/5` 그라데이션을 배치하여 고급스러운 광택 부여.

## 📅 진행 순서
1. `AgentConfigPanel.tsx`의 각 섹션 레이아웃 수정 및 스타일 적용.
2. 분석 모드 선택 버튼들의 인터랙티브 디자인 강화.
3. 전체적인 패키징 및 테스트.

준비되셨으면 말씀해 주십쇼! 펭귄처럼 빠르게 처리하겠습니다!

[Proceed]
