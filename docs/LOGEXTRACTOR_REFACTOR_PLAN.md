# 👮 Log Extractor 핵심 파일 500줄 초과 극복을 위한 리팩토링 계획서 🐧🛡️

형님! "한 파일이 500줄을 넘어가는 순간 리팩토링 계획을 세워서 제출하고, 작은 파일들로 역할을 쪼개어 추가해 나가야 한다"는 형님의 엄격하고 숭고한 룰에 따라, 현재 아득히 비대해져 있는 핵심 파일 2종에 대한 리팩토링 계획을 엄격하게 세워 보고드립니다!

---

## 🚨 비대화 대상 파일 현황 및 진단
1. **[useLogExtractorLogic.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.tsx)**: **1,301줄**
   - **문제점**: 파일 초기화, 인덱싱 스캔, 버퍼 데이터 관리, SDB/Serial 연결 소켓 수립, 실시간 스트림 파싱, 북마크 토글, 필터 및 하이라이트 누적 병합 연동 등 **너무나 많은 책임**이 단 하나의 훅 안에 엉켜 있습니다.
2. **[LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)**: **1,670줄**
   - **문제점**: 탭 레이아웃 뷰 렌더링, 핫키 리스너 바인딩, Tizen 모달 및 북마크 모달 상태 관리, 성능 분석 차트 연동, Spam 분석 컨트롤 등 복잡한 UI들이 혼재되어 있어 유지보수 시 한 화면에 잡히지 않습니다.

---

## 🏗️ 쪼개기(Decoupling) 및 컴포넌트 분할 전략

### 1단계: `useLogExtractorLogic` 훅의 다이어트 및 분리 (4개 훅으로 분리)

- **[NEW] `hooks/useLogSocketStream.ts` (약 250줄)**
  - **책임**: SDB/Serial/Simulate 등 소켓 통신 연결 관리, 실시간 로깅 스트림 시작/중단/버퍼 클리어 및 Burst 처리.
- **[NEW] `hooks/useLogIndexing.ts` (약 200줄)**
  - **책임**: 로컬 파일 초기 인덱싱, 세그멘테이션 페이지 관리 (`MAX_SEGMENT_SIZE`), 워커 아이디 생성 및 수명 관리.
- **[NEW] `hooks/useLogBookmarkActions.ts` (약 150줄)**
  - **책임**: 북마크 세트 관리, 북마크 단일 토글 및 전체 지우기, F3/F4 북마크 간 점프 및 익스포트용 직렬화.
- **[MODIFY] `hooks/useLogExtractorLogic.ts` (500줄 이하로 대폭 축소)**
  - **책임**: 위의 세분화된 하위 훅들을 묶어 컨트롤하며, 최종 UI에 전달할 컨텍스트 바인딩 및 코어 필터링 요청 연동만 담당.

---

### 2단계: `LogSession.tsx` 컴포넌트의 대수술 (3개 전용 컴포넌트로 분리)

- **[NEW] `components/LogViewer/SessionStatusBar.tsx` (약 100줄)**
  - **책임**: 세그먼트 네비게이션(이전/다음 페이지 버튼), 타임 차트 표시 및 셀렉션 시간차 결과 시각화, 워커 상태 표시줄.
- **[NEW] `components/LogViewer/SessionHotkeyController.tsx` (약 150줄)**
  - **책임**: Alt+1~9 퀵 커맨드 핫키 리스너, Ctrl+F, Ctrl+B, 스플릿 뷰 스마트 조절 등 키보드 바인딩 이벤트 총괄 제어.
- **[MODIFY] `components/LogSession.tsx` (500줄 이하로 대폭 축소)**
  - **책임**: 좌우 `<LogViewerPane>`에 Props를 분배하고, 상단 `<TopBar>`와 컴포넌트 오케스트레이션만을 수행하는 순수한 전송 레이어로 경량화.

---

## 🛡️ 안정성 및 성능 보장 방안
- **메모이제이션(useMemo, useCallback)의 철저한 유지**: 훅과 컴포넌트를 분리할 때, 자식 컴포넌트들의 불필요한 리렌더링을 차단하도록 프롭 캐싱을 더욱 강화하여 동작 부하를 최소화합니다.
- **점진적 이전**: 한 번에 모든 것을 바꾸는 것이 아니라, 1단계(훅 분리)를 적용하여 컴파일을 통과시키고, 그 뒤 2단계(컴포넌트 분리)를 수행하여 **동작 무결성을 100% 검증하면서 완수**합니다.

---

## 📢 형님! 승인 요청

본 리팩토링 계획서는 본 글로벌 검색 태스크가 완벽하게 빌드 및 정상 작동하는지 타입 검증을 모두 마치는 즉시 제출하여, 다음 작업 단계를 위한 준비물로 삼겠습니다! 🐧🛡️⚡
