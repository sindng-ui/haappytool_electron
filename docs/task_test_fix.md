# Task: 테스트 실패 (20 failed) 해결 🚀

형님, 현재 프로젝트의 55개 테스트 파일 중 5개 파일에서 총 20개의 실패가 발생하고 있습니다. 이를 해결하기 위한 작업 목록입니다.

## 📋 작업 리스트

### 1. 백엔드 로직 수정 (`server/index.cjs`) 🛠️
- [ ] `handleSocketConnection` 내 `everythingService.initSocket(socket)` 호출 전 undefined 체크 가드 추가.
- [ ] 테스트 환경에서 백엔드 로직이 죽지 않도록 안정성 확보.

### 2. Release History 테스트 수정 (`test/ReleaseHistory.test.tsx`) 📅
- [ ] `should perform full CRUD operations` 테스트의 타이밍 이슈 해결.
- [ ] `act()`를 통한 상태 업데이트 보증.
- [ ] 삭제 후 UI 갱신 확인 로직 강화.

### 3. NupkgSigner 테스트 수정 (`test/components/NupkgSigner/NupkgSigner.test.tsx`) 📦
- [ ] `should navigate melalui all steps correctly` 테스트의 `vi.useFakeTimers()` 활용 방식 개선.
- [ ] 모의 워커(Mock Worker)의 응답 주기와 타이머 전진 로직 동기화.

### 4. 기타 연동 테스트 검증 🧪
- [ ] `test/connector_integration.test.js` 및 `test/sdb_connection.test.js` 정상 작동 확인.

## 🎯 목표
- 전체 테스트 통과율 100% 달성.
- 회귀 방지를 위한 안정적인 테스트 환경 구축.

형님, 이대로 진행할까요? 계획서도 바로 올리겠습니다! 🐧
