# 테스크

## [완료] CliApp Unit Test 수정
CliApp.test.tsx에서 `block-test` 명령 수행 시 `setTimeout`과 `vi.useFakeTimers()`의 상호작용 문제로 인해 발생하는 타임아웃 오류를 수정했습니다.

## [완료] 로그 분석 미션(규칙) 순서 조정 기능 추가 및 UI 정제
사용자가 로그 데이터 추출 규칙(Mission)의 표시 순서를 직접 조정할 수 있도록 하고, UI를 영문화 및 최적화했습니다.

### 할 일
- [x] 구현 계획 수립
- [x] `MissionManagerModal` 컴포넌트 개발 (`framer-motion` 활용)
- [x] `TopBar`에 관리 버튼 추가 및 모달 연동
- [x] 정렬 결과가 `HappyToolContext` 및 `localStorage`에 정상 반영되는지 확인
- [x] **UI 정제**: UUID 제거, 블러/애니메이션 최적화 및 전체 영문화 작업 완료
- [x] `APP_MAP.md` 업데이트
