# 유닛 테스트 실패 해결 🚀

## 할 일 목록
- [x] `PerfDashboard.test.tsx` 실패 해결 (ToastProvider 추가 및 Lucide 아이콘 mock 보완)
- [x] `connector_integration.test.js` 실패 해결 (SDB stdin.write 검증으로 변경)
- [x] `sdb_connection.test.js` 실패 해결 (SDB 태그 치환 검증 방식 변경)
- [x] 모든 테스트 통과 확인 (`all pass`)
- [x] Timeline UI 고도화 및 Split Raw View 연동
    - [x] 구현 계획서(docs/implementation_plan_timeline_v3.md) 작성 및 승인
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
