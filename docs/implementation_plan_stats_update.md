# Pass Rate 지표를 Slow Ops 개수로 변경 🐧⚡

사용자 피드백에 따라 성능 분석에서 큰 의미가 없는 "Pass Rate (%)" 지표를 제거하고, 성능 임계치를 초과한 **"Slow Ops (개수)"**를 주요 지표로 전면 배치합니다.

## 제안 사항 🐧

- **PerfTopBar**:
  - "Pass Rate" 스코어카드를 "Slow Ops"로 변경.
  - 메인 값을 `%` 비율이 아닌 `result.failCount` (개수)로 표시.
  - 아이콘을 체크 표시(`CheckCircle2`)에서 경고 표시(`AlertTriangle` 등)로 변경하여 가독성 강화.
  - 색상을 초록색(`emerald`)에서 경고색(`amber` 또는 `rose`)으로 변경.
- **PerfDashboardSummary**:
  - 사이드바에서도 "Pass Rate" 섹션을 "Failure Rate" 또는 다른 유용한 정보로 대체하거나 "Slow Ops"를 더 강조하도록 수정.

## 변경 예정 파일 🛠️

### [MODIFY] PerfTopBar.tsx
- `Scorecard` 구성 요소의 속성 수정 (Pass Rate -> Slow Ops).

### [MODIFY] PerfDashboardSummary.tsx
- 상단 Quick Stats 영역의 지표 수정.

## 검증 계획 ✅

- 대시보드 상단 바에서 "Slow Ops" 개수가 정확히 표시되는지 확인.
- 성능 임계치(Threshold) 변경 시 Slow Ops 개수가 실시간으로 업데이트되는지 확인.
- 사이드바의 지표도 일관성 있게 변경되었는지 확인.

형님! 계획서 확인 부탁드립니다! 🐧✨⚡
