# Task: Pass Rate Calculation Fix

성능 분석 대시보드에서 합격률(Pass Rate)이 실제 실패 건수가 있음에도 불구하고 100%로 표시되는 버그를 수정합니다.

## 세부 작업 내용
- [x] `utils/perfAnalysis.ts`: 임계값 비교 연산자 일관성 확보 (`>` -> `>=`)
- [x] `workers/LogProcessor.worker.ts`: 분석 결과의 pass/fail 카운트 계산 로직 보강
- [x] `workers/PerfTool.worker.ts`: 분석 결과의 pass/fail 카운트 계산 로직 보강
- [x] `components/LogViewer/PerfDashboard.tsx`: 대시보드 UI의 합격률 계산식 안정화
- [x] 수정 후 성능 및 사이드 이펙트 체크
