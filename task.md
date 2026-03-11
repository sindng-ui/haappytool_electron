# 유닛 테스트 실패 해결 🚀

## 할 일 목록
- [x] `PerfDashboard.test.tsx` 실패 해결 (ToastProvider 추가 및 Lucide 아이콘 mock 보완)
- [x] `connector_integration.test.js` 실패 해결 (SDB stdin.write 검증으로 변경)
- [x] `sdb_connection.test.js` 실패 해결 (SDB 태그 치환 검증 방식 변경)
- [x] 탭 상태 유지 및 자동 복원 구현 (Split 모드 지원)
    - [x] `useLogFileOperations.ts` 영속화 로직 추가
    - [x] `LogProcessor.worker.ts` 초기화 로직 연동
    - [x] **버그 수정**: 로그 닫기(X) 시 영속화 데이터 초기화되지 않는 문제 해결 🐧✅
    - [x] **버그 수정**: Single 모드 자동 로딩 누락 및 레이스 컨디션 해결 🐧🚀
- [x] **테스트 보강**: 영속화(Single/Split) 및 Analyze Diff(Global/Dedupe) UT 구현 🐧🧪
- [x] **성능 최적화**: Analyze Diff 보수적 최적화 (Tag pre-processing, Sort weighting) 🐧⚡
- [x] **기능 복구**: Global Alias Batch 누락 현상 해결 및 UI 강조 (Violet Theme) 🐧🛠️🚀
- [x] **용어 변경**: Analyze Diff 내 'Spam' -> 'New Logs'로 명칭 변경 🐧📝✨
    - [x] `SplitAnalyzerPanel.tsx` UI 레이블 및 변수명 수정
    - [x] `APP_MAP.md` 및 `walkthrough.md` 업데이트
- [x] APP_MAP.md 업데이트 및 문서 정리
    - [x] TIMELINE 카드 내 'FROM', 'TO' 레이블 제거
    - [x] 카드 더블 클릭 시 원본 로그 분할 보기(Split Raw View) 구현
    - [x] Split Raw View ESC 키 종료 기능 및 하이라이트 오류 수정
    - [x] Timeline/Summary 내비게이션 보강 및 더블 클릭 연동
    - [x] Timeline/Summary 리스트 컴팩트 UI 적용 (여백 최적화)
    - [x] 기존 Raw View와 동일한 룩앤필 적용 및 레이아웃 검증
    - [x] Summary 탭 UI 세부 튜닝 (화살표 공간 확보 및 지표 가로 배치)
    - [x] Summary 요약 카드 순서 변경 (New Errors를 우측 끝으로)

## 현황
- 모든 테스트 통과 완료 (199 passed, 5 skipped)
- SDB 연결 검증 로직 최신화 완료 (stdin.write 기반)
- PerfDashboard 테스트 환경 안정화 완료

## 🐧 1줄 알리아스 분석 지원 (NEW)
- [x] 해피콤보 알리아스 매칭 시 1줄만 있어도 세그먼트로 인식 (시작=끝)
- [x] 파일명/함수명 규칙과 무관하게 알리아스 단독 세그먼트 생성 가능
- [x] 여러 줄 매칭 시 기존처럼 하나의 거대 세그먼트로 유지되는 원칙 고수
