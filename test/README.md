# HappyTool 테스트 가이드

## 📋 테스트 개요

HappyTool은 다음과 같은 테스트 계층을 가지고 있습니다:

### 1. Unit Tests (기능 테스트)
- **목적**: 개별 기능의 정확성 검증
- **위치**: `test/*.test.ts`
- **실행**: `npm run test:[module-name]`

### 2. Performance Tests (성능 벤치마크)
- **목적**: 성능 저하 조기 감지 및 최적화 검증
- **위치**: `test/performance/*.perf.test.ts`
- **실행**: `npm run test:performance`

## 🎯 사용 가능한 테스트 스크립트

### 전체 테스트
```bash
# 모든 테스트 실행
npm run test

# 모든 테스트 실행 (동일)
npm run test:all
```

### Unit Tests
```bash
# Log Archive 기능 테스트
npm run test:log-archive

# SDB 연결 테스트
npm run test:sdb

# Frontend 훅 테스트
npm run test:frontend

# Backend 소켓 테스트
npm run test:backend
```

### Performance Benchmarks
```bash
# 전체 성능 테스트
npm run test:performance

# Log Archive 성능 테스트
npm run test:perf:log-archive

# JSON Tools 성능 테스트
npm run test:perf:json

# Log Extractor 성능 테스트
npm run test:perf:log-extractor

# Post Tool 성능 테스트
npm run test:perf:post
```

## ⚠️ 중요 사항

### Log Archive 테스트 (IndexedDB 의존성) ✅ 해결됨

Log Archive 관련 테스트(`test:log-archive`, `test:perf:log-archive`)는 **IndexedDB가 필요**합니다:

- **IndexedDB**: Dexie.js가 IndexedDB를 사용
- **해결책**: ✅ `fake-indexeddb` 패키지 설치 완료
- **현재 상태**: 테스트 환경에서 정상 작동

#### 테스트 실행 가능
```bash
# Log Archive Unit Test (모두 정상 작동)
npm run test:log-archive

# Log Archive Performance Test (모두 정상 작동)
npm run test:perf:log-archive
```

추가 벤치마크는 브라우저 콘솔에서도 실행 가능:
```javascript
// 개발자 도구 콘솔에서:
runLargeScaleBenchmark(10000);  // 10,000개 테스트
runLargeScaleBenchmark(50000);  // 50,000개 스트레스 테스트
```

### ⚠️ fake-indexeddb 사용 시 주의사항

**fake-indexeddb는 언제 신뢰할 수 있나요?**

✅ **신뢰 가능 (기능 테스트)**:
- CRUD 연산 정확성
- 검색 로직 검증
- 트랜잭션 동작
- 쿼리 결과 정확성

⚠️ **주의 필요 (성능 테스트)**:
- **절대적인 성능 수치**는 실제 브라우저와 다를 수 있음
- 메모리 기반 구현으로 I/O 특성이 다름
- **상대적인 성능 비교**는 유효 (최적화 전후 비교)

**권장 테스트 전략 (하이브리드 접근)**:

1. **자동화 테스트** (fake-indexeddb): 기능 정확성 + 성능 회귀 감지
2. **수동 검증** (실제 브라우저): 절대 성능 + 메모리 측정
3. **실사용 테스트** (Electron): 대용량 데이터 + 장기 안정성

```bash
# 1단계: 자동화 (CI/CD)
npm run test:log-archive        # 기능 테스트
npm run test:performance        # 성능 회귀 감지

# 2단계: 브라우저 검증 (개발자 도구 콘솔)
runLargeScaleBenchmark(50000)   # 실제 성능 측정

# 3단계: Electron 실사용
# 앱 실행 후 실제 사용 시나리오 테스트
```

### SDB 테스트 (장치 연결 필요)

SDB 테스트는 **실제 Tizen 장치**가 연결되어 있어야 합니다:

```bash
# 사전 조건 확인
sdb devices

# SDB 테스트 실행
npm run test:sdb
```

자세한 내용은 `test/SDB_TEST_GUIDE.md` 참조

## 📊 성능 테스트 해석

성능 벤치마크 테스트는 각 작업에 대한 성능 기준(threshold)을 가지고 있습니다:

```
✓ should insert 1,000 items within performance threshold
  📊 Insert 1K: 1247.32ms, Memory: +23.45MB  ← 실제 측정값
  기준: < 2000ms, < 50MB                      ← 통과 기준
```

### 테스트 실패 예시
```
❌ should search and return 50 results efficiently
  Expected: < 500ms
  Received: 756ms  ← 성능 저하 감지!
```

이 경우 다음을 확인하세요:
1. 최근 코드 변경사항
2. 알고리즘 효율성
3. 불필요한 연산
4. DB 쿼리 최적화

## 🛠️ 테스트 환경 설정

### Vitest 설정
테스트 프레임워크는 Vitest를 사용하며, `vite.config.ts`에 설정되어 있습니다:

```typescript
test: {
  globals: true,
  environment: 'jsdom',      // 브라우저 DOM 에뮬레이션
  setupFiles: './test/setup.ts',
  css: true,
}
```

### 메모리 측정
메모리 사용량 측정은 Chrome/Electron 환경에서만 가능:
```typescript
const memoryUsage = (performance as any).memory?.usedJSHeapSize;
```

Node.js 환경에서는 `0`을 반환하므로 메모리 테스트는 건너뜁니다.

## 📈 테스트 커버리지

현재 테스트 커버리지:

| 모듈 | Unit Test | Performance Test |
|------|-----------|------------------|
| **Log Archive** | ✅ (브라우저 필요) | ✅ |
| **Log Extractor** | ⚠️ (부분적) | ✅ |
| **JSON Tools** | ❌ | ✅ |
| **Post Tool** | ❌ | ✅ |
| **Easy Post** | ❌ | ❌ |
| **SDB Connector** | ✅ | ❌ |

## 🔄 CI/CD 통합

CI 환경에서 테스트 실행 시 주의사항:

1. **IndexedDB 테스트**: `fake-indexeddb` 설치 필요
2. **SDB 테스트**: CI 환경에서는 skip
3. **성능 기준**: CI 환경이 느리므로 threshold 조정 고려

## 🤝 새 테스트 추가하기

### Unit Test 추가
```typescript
// test/my-feature.test.ts
import { describe, it, expect } from 'vitest';

describe('My Feature', () => {
    it('should work correctly', () => {
        expect(true).toBe(true);
    });
});
```

### Performance Test 추가
```typescript
// test/performance/my-feature.perf.test.ts
import { describe, it, expect } from 'vitest';

const THRESHOLD = 1000; // 1초

describe('Performance - My Feature', () => {
    it('should complete within threshold', () => {
        const start = performance.now();
        
        // ... 테스트 대상 코드 ...
        
        const duration = performance.now() - start;
        console.log(`  📊 Duration: ${duration.toFixed(2)}ms`);
        
        expect(duration).toBeLessThan(THRESHOLD);
    });
});
```

## 📚 관련 문서

- [성능 벤치마크 README](./performance/README.md) - 성능 테스트 상세 가이드
- [PERFORMANCE_OPTIMIZATION_REPORT.md](../PERFORMANCE_OPTIMIZATION_REPORT.md) - 성능 최적화 보고서
- [SDB_TEST_GUIDE.md](./SDB_TEST_GUIDE.md) - SDB 테스트 가이드

## 🐛 트러블슈팅

### "Cannot find module" 에러
```bash
# node_modules 재설치
npm install
```

### IndexedDB 테스트 실패
```bash
# fake-indexeddb 설치 (향후)
npm install --save-dev fake-indexeddb
```

### 타임아웃 에러
- 대규모 테스트는 타임아웃이 길게 설정되어 있습니다 (10-30초)
- 필요시 `vitest.config.ts`에서 `testTimeout` 조정

### 인코딩 문제 (Windows)
```powershell
# PowerShell에서 UTF-8 출력
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
npm run test
```
