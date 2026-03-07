# 분석 버튼 및 성능 최적화 🐧⚡

- [x] **Analyze Diff 버튼 UI 안정화** 
    - [x] 버튼 위치 이동 및 고정 너비 적용
- [x] **분석 진행률 시각화**
    - [x] useSplitAnalysis.ts 진행률 합산 로직 구현
    - [x] SplitAnalyzerPanel.tsx 로딩 UI 강화
- [x] **분석 성능 최적화 (메인 스레드 프리징 해결)**
    - [x] 워커에서 직접 데이터 요약(Aggregating on-the-fly) 구현
    - [x] 요약된 Metrics 전송으로 메인 스레드 부하 제로화
- [x] **최종 보고**
