# Analyze-Diff CLI 정렬 및 데이터 흐름 개선 🐧🚀

## 진행 상황
- [x] analyze-diff CLI 결과값 빈 데이터 문제 분석 (JSON 구조 불일치)
- [x] extractAnalysisMetrics - SplitAnalysis 데이터 필드명 불일치 수정
- [x] extractAnalysisMetrics 레거시 응답 및 로깅 수정 (추가 작업) 🐧🔍
- [x] CLI 환경에서 최신 코드 미반영 이슈 (Vite/Bundle) 대응 (빌드 안내)
- [x] CLI Unit Tests 추가
    - [x] handleAnalyzeDiff 정렬 로직 및 워커 흐름 테스트
    - [x] handleJsonTool, handlePostTool 테스트
    - [x] handleLogExtractor 테스트 및 안정화
    - [x] CliApp 라우팅 테스트
- [ ] **Feature**: 결과값 정렬 로직 추가 (사용자 요청) 🐧⚖️
    - [ ] regressions, improvements, stable: `deltaDiff` 절대값 기준 내림차순
    - [ ] newLogs: `count` 기준 내림차순
- [ ] **Bug Fix**: CLI에서 `Missing sequence data` 에러 발생 원인 심층 분석 및 해결 (필터링 완료 시점 확인)
- [ ] 최종 결과물 검증 (실제 로그 데이터 활용)
- [ ] APP_MAP.md 및 문서 업데이트 (전체 점검)
```
