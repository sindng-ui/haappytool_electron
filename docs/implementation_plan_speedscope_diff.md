# SpeedScope Diff 기능 구현 계획 🐧⚡

## 목표
- SpeedScope Analyzer 플러그인에서 두 프로파일을 실질적으로 비교하고(Analyze Diff), 그 결과를 `SplitAnalyzerPanel`을 통해 시각화합니다.
- 사용자가 동일한 파일을 넣었더라도 'Stable' 상태로 비교 결과가 나오도록 구현합니다.

## 변경 사항

### [Component] SpeedScope Plugin 🐧⚡

#### [MODIFY] [SpeedScopePlugin.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/SpeedScope/SpeedScopePlugin.tsx)
- `SplitAnalysisWorker`를 활용한 분석 로직 추가
- `AnalysisResult` 데이터를 `SequenceItem` 형식으로 변환하는 브릿지 로직 구현
- 분석 진행 상태(`isAnalyzing`, `analysisProgress`) 및 결과(`analysisResults`) 상태 관리
- `SplitAnalyzerPanel`을 하단에 배치하여 분석 결과 표시
- `Analyze Diff` 버튼 클릭 시 실제 분석 수행 함수(`performAnalysis`) 호출

## 검증 계획

### 수동 테스트
1. SpeedScope Analyzer에서 `Compare Mode` 활성화
2. 좌/우측에 각각 SpeedScope JSON 파일 드롭 (동일 파일 및 다른 파일 모두 테스트)
3. `Analyze Diff` 버튼 클릭
4. 하단에 `Analysis Engine` 패널이 올라오는지 확인
5. `SUMMARY` 및 `TIMELINE` 탭에서 비교 결과(Delta, Count 등)가 정상적으로 표시되는지 확인

형님, 위 계획대로 진행해도 될까요? `proceed` 버튼을 눌러주시면 바로 코딩 들어가겠습니다! 🐧🫡⚡
