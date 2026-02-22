# Perf Tool 상세 명세 (Antigravity 용)

이 문서는 HappyTool의 성능 분석 핵심 도구인 **Perf Tool**과 **Log Extractor의 성능 분석 기능**에 대한 기술적 로직, 명세 및 주의사항을 담고 있습니다.

---

## 🚀 1. Overview

HappyTool은 로그 데이터를 기반으로 시스템의 동작 시간과 병목 구간을 시각화하기 위해 두 가지 형태의 성능 분석 도구를 제공합니다.

1.  **Log Extractor - Analyze Performance**: 현재 열려있는 로그 뷰어의 필터링된 데이터를 실시간으로 차트화합니다.
2.  **Perf Tool**: 별도의 독립된 파일이나 대용량 로그 전체를 대상으로 PIDDiscovery(자동 PID 찾기) 및 심층 성능 분석을 수행합니다.

**v1.1.1 Upgrade**: 정밀 시간 계측을 위한 **Precision Ruler**, 다중 스레드 비교를 위한 **Crosshair Guide**, 그리고 결과 공유를 위한 **One-click Screenshot** 기능이 추가되었습니다.

---

## 🛠️ 2. 공통 아키텍처 및 로직 (`perfAnalysis.ts`)

모든 성능 분석의 핵심은 **`analyzePerfSegments`** 함수입니다.

### 2.1 분석 프로세스
1.  **Collection Phase**: 설정된 `LogRule`(또는 `HappyGroup`)에 매칭되는 모든 로그 라인을 타임스탬프와 함께 추출합니다.
2.  **Global Grouping (Step Segments)**: 동일한 `alias`를 가진 로그들 중 첫 번째와 마지막 로그를 연결하여 하나의 거대한 작업 단위(`type: 'step'`)를 생성합니다.
3.  **Interval Analysis (Combo Segments)**: 시간순으로 정렬된 매칭 로그들 사이의 간격(`A -> B`, `B -> C`)을 분석하여 단계별 전환 시간(`type: 'combo'`)을 생성합니다.
4.  **Lane Assignment (Flame Chart)**: 
    *   TID(Thread ID)별로 세그먼트를 그룹화합니다.
    *   동일 쓰레드 내에서 시간이 겹치는 세그먼트는 서로 다른 Lane(층)에 배치하여 시각적 간섭을 막습니다. (Greedy Packing Algorithm)
5.  **Interaction & Measurement**:
    *   **Vertical Crosshair Guide**: 마우스 커서를 따라다니는 점선 가이드를 통해 서로 다른 TID 간의 동시성(Concurrency)을 정밀하게 확인합니다.
    *   **Time Ruler**: 맵 상단에 줌 레벨에 연동되는 정밀 시간 축(Ruler)을 표시하여 구간의 절대 시간을 직관적으로 파악합니다.
    *   **Search Highlight (Subtle Border)**: 검색어 매칭 시 해당 세그먼트에 1px 흰색 테두리를 자동 생성하여 가독성을 높였습니다. (휘황찬란 방지 최적화)

### 2.2 공통 데이터 추출 기술
*   **PID/TID 추출**: `extractLogIds` 유틸리티를 사용하여 `[PID:TID]`, `(P 123, T 456)`, 혹은 Android 표준 포맷에서 식별자를 자동으로 추출합니다.
*   **Source Metadata 추출**: `extractSourceMetadata`를 사용하여 `FileName.cs: FunctionName> ` 형태의 로그에서 파일명과 함수명을 분리해 냅니다.

---

## 🎯 3. Perf Tool vs. Log Extractor 분석 차이점

| 항목 | Log Extractor (Analyze Performance) | Perf Tool (Standalone) |
| :--- | :--- | :--- |
| **분석 대상** | 현재 탭에 **필터링되어 보이는 로그** | **원본 로그 파일 전체** 또는 대용량 데이터 |
| **트리거 시점** | 사용자가 번개 아이콘 클릭 시 | 사용자가 `Run Analysis` 버튼 클릭 시 |
| **PID Discovery** | 불필요 (이미 필터링된 데이터 사용) | **핵심 기능**. Tag로 검색하여 관련 PID 리스트를 제안함 |
| **데이터 범위** | 실시간 유입되는 윈도우 내 데이터 위주 | 파일 전체에 걸친 통계 및 장기 흐름 분석 |
| **UI 통합** | 로그 뷰어 하단/전체화면 대시보드 | 전용 분석 화면 및 대시보드 결합 |

---

## 📝 4. 구현 및 유지보수 시 주의사항 (Antigravity AI 필독)

### 4.1 인덱스 매핑 (Original vs. Filtered)
*   분석된 세그먼트에서 "원본 로그 보기" 기능을 수행할 때, `startLine`/`endLine`(분석 시점의 인덱스)과 `originalStartLine`(원본 파일의 실제 인덱스)을 철저히 구분해야 합니다.
*   Log Extractor는 필터링된 가상 인덱스를 다루므로 매핑 오류가 발생하기 쉽습니다.

### 4.2 성능 임계값 (Threshold) 관리
*   임계값(`perfThreshold`)을 초과한 세그먼트는 시각적으로 'Fail' 상태가 되며 `Bottlenecks` 리스트에 우선 노출됩니다.
*   `DangerThresholds` 설정을 통해 시간별로 정교한 색상 단계(Slow, Very Slow, Critical)를 지정할 수 있도록 구현되어야 합니다.

### 4.3 렌더링 최적화 및 안정성
*   **Culling & Merging**: 화면 밖 세그먼트는 그리지 않고, 1px 미만의 미세 세그먼트는 병합 처리하여 수만 개의 데이터도 60fps로 유지합니다.
*   **Inactive Loop Control**: 앱이 비활성화되거나 탭이 가려지면(`isActive: false`) 캔버스 렌더링 루프를 즉시 중단하여 시스템 자원(CPU/GPU)을 보호합니다.
*   **Regression Unit Tests**: `perf-tool.regression.test.ts`를 통해 줌 격리, 컬링 성능, 검색 매칭 로직 등 핵심 엔진의 변경 사항이 기존 기능을 파괴하지 않도록 감시합니다.

---

## 📸 5. 편의 기능 (Utilities)

1.  **One-click Screenshot**: 카메라 아이콘 클릭 시 현재 Flame Map 뷰를 PNG 이미지로 즉시 내보내 실무 보고 및 공유에 활용합니다. (배경색 고정 및 플래시 피드백 포함)
2.  **Zoom Isolation**: `Ctrl + Wheel` 줌 동작 시 마우스가 올라가 있는 패널(Left/Right/Dashboard)을 식별하여 해당 영역의 줌만 독립적으로 작동하도록 정밀 제어합니다.

1.  **타임스탬프 의존성**: 로그 라인에 타임스탬프가 없거나 `extractTimestamp`가 파싱하지 못하는 특이 포맷의 경우 분석에서 완전히 제외됩니다.
2.  **로그 유실 대응**: 실시간 로깅 중 로그 유실(Drop)이 발생하면 `A -> B` 간격이 비정상적으로 길게 측정될 수 있습니다. 이를 감지하는 로직(Gap Detection)이 필요합니다.
3.  **메모리 부하**: 100MB 이상의 거대한 로그를 분석할 때 브라우저 메인 스레드가 멈추는 것을 방지하기 위해, Perf Tool과 Log Extractor 모두 **Web Worker**(`PerfTool.worker.ts`, `LogProcessor.worker.ts`)에서 분석을 수행하도록 구현되어 있습니다. 이를 통해 대용량 데이터 처리 중에도 UI의 반응성을 유지합니다.

---

**작성일**: 2026-02-22  
**상태**: v1.1.1 정밀 계측 및 시각화 고도화 완료
