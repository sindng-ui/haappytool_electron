# SDB Connection Test Suite

## 개요

SDB 연결의 핵심 경로를 검증하여 다시는 연결 실패가 발생하지 않도록 보장하는 유닛 테스트입니다.

## 실행 방법

```bash
npm run test:sdb
```

## 테스트 커버리지

### 🔴 CRITICAL: 연결 성공 이벤트 발송

**문제**: SDB 프로세스가 성공적으로 시작되어도 클라이언트에 연결 성공 알림을 보내지 않아 12초 타임아웃 발생

**테스트**:
- ✅ 디바이스 검증 성공 후 `sdb_status: 'connected'` 이벤트 발송 확인
- ✅ 검증 실패 시 connected 이벤트가 발송되지 않음 확인
- ✅ auto-detect 모드에서도 정상 동작 확인

### 🟡 디바이스 검증 타임아웃 (5초)

**문제**: 디바이스가 응답하지 않을 때 무기한 대기

**테스트**:
- ✅ 5초 타임아웃 후 프로세스 종료 및 에러 발송
- ✅ 5초 이내 응답 시 정상 진행

### 🟡 커스텀 SDB 경로 처리

**문제**: 시스템 PATH에 sdb가 없어도 사용자 지정 경로로 동작해야 함

**테스트**:
- ✅ 사용자 지정 sdbPath 사용 확인
- ✅ 경로 미지정 시 시스템 sdb 사용 확인

### 🟢 로그 스트리밍

**테스트**:
- ✅ 연결 후 로그 데이터가 클라이언트로 전송되는지 확인

### 🟢 명령어 및 태그 치환

**테스트**:
- ✅ $(TAGS) 플레이스홀더가 실제 태그로 치환되는지 확인
- ✅ 빈 태그 배열도 정상 처리되는지 확인

### 🟢 프로세스 정리

**테스트**:
- ✅ disconnect_sdb 시 프로세스가 종료되는지 확인

## 디버깅

테스트 실패 시:

1. 상세 로그 확인:
   ```bash
   npm run test:sdb -- --reporter=verbose
   ```

2. 특정 테스트만 실행:
   ```bash
   npx vitest run test/sdb_connection.test.js -t "MUST emit sdb_status"
   ```

3. watch 모드로 실행:
   ```bash
   npx vitest test/sdb_connection.test.js
   ```

## CI/CD 통합

이 테스트는 빌드/배포 전에 자동으로 실행되어야 합니다:

```yaml
# GitHub Actions 예시
- name: Test SDB Connection
  run: npm run test:sdb
```

## 관련 파일

- **테스트**: `test/sdb_connection.test.js`
- **서버 로직**: `server/index.cjs` (connect_sdb 핸들러)
- **프론트엔드**: `components/TizenConnectionModal.tsx`

## 수정 히스토리

- 2026-01-28: 초기 테스트 스위트 생성
  - sdb_status:connected 이벤트 발송 검증 추가
  - 5초 타임아웃 검증 추가
  - 커스텀 SDB 경로 처리 검증 추가
