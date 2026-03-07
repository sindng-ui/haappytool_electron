# 분석 리포트 고도화 및 요약 기능 🐧📊

- [x] **Analyze Diff 버튼 UI 및 성능 최적화** 
- [x] **분석 리포트 탭 시스템 도입**
- [/] **구간 표시 및 로그 점프 기능 고도화**
    - [x] SplitAnalysisUtils.ts 라인 번호 추적 필드 추가
    - [ ] SplitAnalysis.worker.ts 결과 데이터에 라인 번호 포함
    - [ ] SplitAnalyzerPanel.tsx 'Top Regressions' 구간 표시 및 로그 점프 기능
    - [ ] 표시 개수 펭-맥스(100개)로 확장
- [/] **로그 렌더링 및 내부 라인 번호 개선** 🐧🔍⚡
    - [x] 로그 본문 내 `(라인번호)` 추출 로직 구현
    - [ ] 분석 데이터 파이프라인에 `codeLineNum` 전파
    - [ ] 왼쪽 스플릿 로그 렌더링 누락 이슈 해결 🐧🕵️‍♂️
- [ ] **최종 보고**
