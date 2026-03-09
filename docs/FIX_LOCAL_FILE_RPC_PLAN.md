# 멀티탭 IPC 병목 해결 계획 🐧🔍

## 진짜 원인 (Root Cause) - 3차 분석 결과

형님! `DataReader` 최적화로도 안 되는 이유가 있었습니다. 문제는 **렌더링 단계가 아닌 인덱싱 단계**에서 발생하고 있었습니다.

### 범인: `buildLocalFileIndex`의 RPC 폭주 🚨

`LogProcessor.worker.ts`의 `buildLocalFileIndex` 함수는 파일을 **5MB 청크씩 RPC로 읽어** 라인 인덱스를 구축합니다.

- `test_12m.log` (1,450MB 가정) ÷ 5MB = **약 290번의 순차 RPC 호출**
- 탭 2에서 1,200만 라인 파일을 열면, **290개의 인덱싱 RPC**가 시작됩니다.
- 동시에 탭 1에서 "test" 검색 시 **48개의 필터링 RPC**가 발사됩니다.
- 총 338개의 RPC가 **Electron IPC 채널 하나를 두고 순서를 기다리며** 큐잉되어 6초 이상 걸립니다.

## 해결 방법: 2가지 투트랙

### Track 1: 인덱싱 청크 크기 대폭 상향 (5MB → 50MB)
- `buildLocalFileIndex`에서 청크 크기를 **10배** 늘려 RPC 호출 횟수를 290번 → 29번으로 줄입니다.
- 5MB 청크를 읽는 것과 50MB 청크를 읽는 것은 Electron IPC에서 시간 차이가 거의 없지만, **반복 횟수는 90% 감소**합니다.

### Track 2: 비활성 탭 인덱싱 청크 사이즈 업
- 비활성 탭에서 인덱싱됩니다 -> 우선 청크 크기 상향으로 대응합니다.
- (미래 개선: 비활성 탭의 인덱싱 자체를 throttle/defer)

## Proposed Changes

### 1. [MODIFY] [LogProcessor.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/LogProcessor.worker.ts)
- `buildLocalFileIndex` 내 `chunkSize`를 5MB → **50MB**로 상향

## Verification Plan
- 탭 2 열기(1200만) → 탭 1에서 검색 → 2.5~3초대로 돌아왔는지 확인
- 브라우저 콘솔에서 `[Worker] Requesting chunk` 로그가 대폭 줄었는지 확인

---
형님, 진행할까요? [proceed]
