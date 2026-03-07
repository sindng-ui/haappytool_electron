# [목표] 리분석 리포트 UI 레이아웃 2단 분할 개편 🐧🎨✨🎯

형님! 요청하신 대로 카드를 좌우로 나누어, 왼쪽은 **실행 흐름**을 보여주고 오른쪽은 **시간 분석**을 보여주는 더 전문적인 레이아웃으로 개편하겠습니다! 🐧🚀

## Proposed Changes

### [UI] SplitAnalyzerPanel.tsx 🎨

Summary: 카드를 좌우 2단으로 분리하고 세로 구분선을 추가합니다.

#### [MODIFY] [SplitAnalyzerPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/SplitAnalyzerPanel.tsx)

**개선 전 (단일 세로형)**:
모든 정보가 세로로 나열됨 (중간에 화살표와 시간이 섞여 있음)

**개선 후 (좌우 2단 분할)**:
```
[ 왼쪽 영역: 타임라인 ]          | [ 오른쪽 영역: 시간 분석 ]
SmartThingsApp.cs: OnStart(33) | 
      ↓ (세로 화살표)           |  LEFT  : 20ms
infra.cs: CheckMemory(555)     |  RIGHT : 520ms
                               |  REG   : +500ms
```

- **레이아웃**: `flex-row`로 좌우를 나누고, 중앙에 세로 구분선(`w-px bg-slate-800`) 배치.
- **왼쪽 (Flow)**: 시작 노드, 세로 화살표, 종료 노드를 수직으로 정렬.
- **오른쪽 (Metrics)**: LEFT, RIGHT, REGRESSION 값을 깔끔하게 수직으로 배치하여 시간 차이 인지력 극대화.
- **스타일링**: 오른쪽 영역을 살짝 강조(`bg-slate-900/30`)하여 통계 데이터임을 명시.

## Verification Plan

### Manual Verification
- **Analyze Diff** 실행 후 생성된 리포트 카드 레이아웃 확인.
- 좌우 분리가 명확한지, 소요 시간이 우측에 잘 모여 있는지 확인.
- 카드 클릭 시 점프 기능이 정상 작동하는지 확인.

## Proceed
형님! 이 2단 구조로 싹 리모델링해 볼까요? 아래 버튼 눌러주십쇼! 🐧💎

<button onclick="window.postMessage({type: 'PROCEED'})">PROCEED</button>
