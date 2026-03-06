# 테스크: CliApp Unit Test 수정

CliApp.test.tsx에서 `block-test` 명령 수행 시 `setTimeout`과 `vi.useFakeTimers()`의 상호작용 문제로 인해 발생하는 타임아웃 오류를 수정합니다.

## 할 일
- [x] 단위 테스트 수정 계획 수립
- [x] `test/components/CliApp.test.tsx` 파일 수정
    - [x] `vi.useFakeTimers()` 위치 조정 (렌더링 전으로 이동)
    - [x] 불필요한 중복 렌더링(`renderCliApp()`) 제거
    - [x] `act` 블록 내에서 타이머 가속 처리
    - [x] 테스트 완료 후 `vi.useRealTimers()` 보장
- [x] 테스트 실행 및 확인
- [x] `APP_MAP.md` 업데이트 (필요시)
