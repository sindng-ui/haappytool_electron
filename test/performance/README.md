# Performance Benchmark Tests

## 📋 개요

HappyTool의 핵심 기능들에 대한 성능 벤치마크 테스트입니다. 성능 저하를 조기에 발견하고 최적화 효과를 검증하기 위해 작성되었습니다.

## 🎯 테스트 범위

### 1. Log Archive (`log-archive.perf.test.ts`)
- ✅ 1,000개 항목 삽입 성능 (< 2초)
- ✅ 전체 태그/폴더 조회 (< 0.1초)
- ✅ 검색 성능 (50개 결과, < 0.5초)
- ✅ 통계 처리 성능 (< 1초)
- ✅ 메모리 사용량 (1,000개 삽입 시 < 50MB)
- ✅ 대규모 테스트 (10,000개 항목)

### 2. JSON Tools (`json-tools.perf.test.ts`)
- ✅ 1MB JSON 파싱 (< 0.2초)
- ✅ 10MB JSON 파싱 (< 2초, 스트레스 테스트)
- ✅ JSON 직렬화 (< 0.3초)
- ✅ 깊은 중첩 JSON (10 레벨, < 0.5초)
- ✅ 대규모 배열 (10,000개 항목)
- ✅ JSON Diff 연산

### 3. Log Extractor (`log-extractor.perf.test.ts`)
- ✅ 10,000줄 로그 파싱 (< 0.5초)
- ✅ 100,000줄 로그 파싱 (< 5초)
- ✅ 키워드 필터링 (< 0.2초)
- ✅ RegEx 필터링 (< 0.5초)
- ✅ 하이라이트 처리 (< 0.3초)
- ✅ 대용량 파일 청크 처리 (2GB 시뮬레이션)
- ✅ 빠른 로그 스트리밍 (100 logs/sec)
- ✅ 메모리 누수 검증

### 4. Post Tool (`post-tool.perf.test.ts`)
- ✅ 1MB API 응답 처리 (< 0.3초)
- ✅ 10MB API 응답 처리 (< 3초, 스트레스 테스트)
- ✅ JSON 포맷팅 (< 0.5초)
- ✅ 대규모 배열 응답 (10,000개 항목)
- ✅ 응답 헤더 처리
- ✅ 검색 기능 (< 0.2초)
- ✅ 뷰 모드 전환
- ✅ 메모리 관리

## 🚀 실행 방법

### 전체 성능 테스트 실행
```bash
npm run test:performance
```

### 개별 테스트 실행
```bash
# Log Archive 성능 테스트
npm run test:perf:log-archive

# JSON Tools 성능 테스트
npm run test:perf:json

# Log Extractor 성능 테스트
npm run test:perf:log-extractor

# Post Tool 성능 테스트
npm run test:perf:post
```

### 일반 테스트와 함께 실행
```bash
npm run test:all
```

## 📊 성능 기준

각 테스트에는 명확한 성능 기준(threshold)이 설정되어 있습니다:

| 카테고리 | 작업 | 기준 시간 | 기준 메모리 |
|---------|------|----------|------------|
| **Log Archive** | 1,000개 삽입 | 2초 이내 | +50MB 이내 |
| | 검색 (50개) | 0.5초 이내 | - |
| | 태그/폴더 조회 | 0.1초 이내 | - |
| | 통계 처리 | 1초 이내 | +20MB 이내 |
| **JSON Tools** | 1MB 파싱 | 0.2초 이내 | - |
| | 10MB 파싱 | 2초 이내 | - |
| | 직렬화 | 0.3초 이내 | - |
| **Log Extractor** | 10,000줄 파싱 | 0.5초 이내 | - |
| | 100,000줄 파싱 | 5초 이내 | - |
| | 필터링 | 0.2초 이내 | - |
| **Post Tool** | 1MB 응답 | 0.3초 이내 | - |
| | 10MB 응답 | 3초 이내 | - |
| | 검색 | 0.2초 이내 | - |

## 🔍 테스트 출력 예시

```
✓ test/performance/log-archive.perf.test.ts (8 tests)
  📊 Insert 1K: 1247.32ms, Memory: +23.45MB
  📊 Get Tags: 12.45ms, Found: 3
  📊 Search (50): 156.78ms, Found: 50
  📊 Tag Stats: 234.56ms, Memory: +5.12MB

✓ test/performance/json-tools.perf.test.ts (6 tests)
  📊 Parse 1.04MB JSON: 98.23ms
  📊 Stringify 1.02MB JSON: 156.34ms
  📊 Deep Nested (10 levels): Stringify 34.56ms, Parse 45.67ms

✓ test/performance/log-extractor.perf.test.ts (8 tests)
  📊 Parse 10K lines: 234.56ms
  📊 Filter 10K lines: 123.45ms, Found: 2000
  📊 Handle 100 rapid logs: 45.67ms

✓ test/performance/post-tool.perf.test.ts (8 tests)
  📊 1MB Response - Size: 1.02MB, Parse: 123.45ms
  📊 Format response: 234.56ms
  📊 Search in 1MB response: 78.90ms, Found: 1234
```

## ⚠️ 주의사항

1. **환경 의존성**: 성능은 하드웨어와 시스템 상태에 따라 다릅니다.
2. **메모리 측정**: Chrome/Electron 환경에서만 정확한 메모리 측정이 가능합니다.
3. **타임아웃**: 대규모 테스트는 타임아웃이 길게 설정되어 있습니다 (10-30초).
4. **CI/CD**: CI 환경에서는 성능이 로컬보다 느릴 수 있습니다.

## 🎯 성능 회귀 감지

테스트가 실패하면 성능 저하가 발생한 것입니다:

```
❌ should insert 1,000 items within performance threshold
  Expected: < 2000ms
  Received: 3456ms
```

이 경우 다음을 확인하세요:
1. 최근 코드 변경사항
2. 알고리즘 효율성
3. 불필요한 연산이나 메모리 할당
4. DB 쿼리 최적화

## 📈 벤치마크 히스토리

성능 개선 내역:
- **2026-02-09**: Log Archive 통계 메서드 최적화 (`toArray()` → `each()`)
  - 메모리 사용량: 500MB → 5MB (99% ↓)
  - 처리 시간: 1,500ms → 500ms (67% ↑)

## 🔗 관련 문서

- [PERFORMANCE_OPTIMIZATION_REPORT.md](../PERFORMANCE_OPTIMIZATION_REPORT.md) - 성능 최적화 상세 보고서
- [benchmark_log_archive.ts](../benchmark_log_archive.ts) - 대규모 벤치마크 스크립트

## 🤝 기여

새로운 성능 테스트를 추가할 때:
1. 명확한 성능 기준(threshold) 설정
2. 콘솔 출력으로 실제 측정값 표시
3. 메모리 측정 (가능한 경우)
4. 스트레스 테스트 포함 (대용량 데이터)
