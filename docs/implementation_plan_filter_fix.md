# 필터링 성능 긴급 수리 계획: Zero-copy 병렬 필터링 도입 🚑🐧🚀

형님! 오늘 도입한 Phase 3(RAM Capping) 연동 과정에서, 메인 워커가 모든 로그 데이터를 문자열로 직접 변환해서 서브 워커에게 보내는 비효율적인 구간이 발견되었습니다. 10MB 로그가 느려진 원인은 바로 이 "직렬화 병목"입니다.

## 🛠️ Proposed Changes

### 1. [Worker] 서브 워커 공유 메모리 직접 참조 (Zero-copy Filtering) 💎
- **대상**: `LogProcessor.worker.ts`, `LogFilterSub.worker.ts`
- **내역**:
    - 서브 워커가 초기화 시점 혹은 필터링 요청 시점에 `logSharedBuffer`, `lineOffsets`, `lineLengths` 등 모든 SAB를 직접 전달받습니다.
    - 메인 워커에서 `decoder.decode()` 루프를 돌려 문자열 배열을 만드는 오버헤드를 완전히 제거합니다.

### 2. [SubWorker] `FILTER_SAB` 핸들러 구현 🦀
- **내역**:
    - `lines` 배열 대신 `startLine`, `endLine` 범위만 받습니다.
    - 루프 내에서 SAB를 직접 참조하여 데이터를 읽어옵니다.
    - **ActiveChunks 대응**: 만약 데이터가 SAB(현재 100MB 윈도우) 내에 있다면 즉시 읽고, 없는 구간(Capped)이라면 IndexedDB에서 가져와서 처리하도록 구현하여 데이터 누락을 방지합니다.

### 3. [Efficiency] 직렬화 비용 제로화 ⚡
- 문자열 배열을 메시지로 실어 보낼 때 발생하는 **Structured Clone** 오버헤드를 0으로 만듭니다.

## 📊 예상 성능 회복
- **10MB 로그**: 현재 (수초) -> **개선 후 (0.1~0.2초 내외)** 🚀
- **100MB 로그**: 현재 (먹통/극심한 지연) -> **개선 후 (0.5초 내외)** 🔥

---

## Verification Plan

### Automated Tests
- 10MB 로그를 로드하고 키워드 필터링을 수행했을 때 처리 시간이 0.5초 이하인지 로그로 확인.
- 전체 데이터(SAB에 있는 것 + DB로 간 것)가 모두 필터링 결과에 누락 없이 반영되는지 확인.

### Manual Verification
- 형님이 직접 10MB 로그에서 필터링을 변경해보시고 "쫀득한 속도"가 돌아왔는지 확인 부탁드립니다.

## Proceed
<button>proceed</button>
