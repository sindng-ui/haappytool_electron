# 🐧 대용량 로그 분석 메모리 최적화 계획 (Split Mode)

## 1. 문제 분석
- **증상**: 1GB급 로그 2개 동시 분석 시 렌더러/워커 프로세스 크래시 (OOM).
- **원인**: 
    - `AggregateMetrics` 객체가 수백만 개의 유니크 시퀀스를 추적하며 비대해짐.
    - 각 메트릭 항목이 `preview`, `fileName`, `functionName` 등 긴 문자열을 중복 소유.
    - `postMessage`로 대형 객체 전송 시 메모리 스파이크 발생.

## 2. 최적화 전략 (Memory Diet)

### 2.1 문자열 인덱싱 (Signature Registry)
- 모든 `signature`와 관련 메타데이터(`fileName`, `functionName`, `preview`)를 단일 레지스트리(Map)에서 관리.
- 메트릭 데이터(`AggregateMetrics`)에는 문자열 대신 숫자 ID(`sigId`) 혹은 짧은 키만 저장.
- **기대 효과**: 메모리 사용량 80% 이상 절감.

### 2.2 메트릭 데이터 경량화
- `AggregateMetrics`에서 `preview`, `fileName`, `functionName` 등 중복된 필드를 모두 제거.
- 필요 시 레지스트리에서 룩업하여 UI에 표시.

### 2.3 컬렉션 임계치 제한 (OOM 방지)
- 유니크한 시퀀스 개수가 100,000개를 넘어가면 빈도가 현저히 낮거나 성능 차이가 없는 항목은 수집을 중단하여 메모리 보호.

## 3. 상세 단계

### Phase 1: SplitAnalysisUtils.ts 개편
- `SignatureRegistry` 도입 및 인덱싱 로직 추가.
- `AggregateMetrics` 구조에서 중복 문자열 제거하여 경량화.

### Phase 2: workerAnalysisHandlers.ts 수정
- `aggState`에 `registry` 상태 추가.
- 데이터 수집 시 인덱싱 로직 적용.

### Phase 3: SplitAnalysis.worker.ts 수정
- ID 기반 비교 로직으로 변경.
- 최종 결과 생성 시에만 레지스트리 참조하여 문자열 복원 및 전송.

## 4. 진행 여부 확인
- [ ] Phase 1 적용
- [ ] Phase 2 적용
- [ ] Phase 3 적용
- [ ] 대용량 테스트 (1GB+)

형님, 위 계획대로 진행할까요? 🐧⚡️

[Proceed](command:antigravity.proceed)
