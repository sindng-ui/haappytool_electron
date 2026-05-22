# 📋 글로벌 검색 타입 에러 종결 및 최종 연동 구현 계획서 🐧⚡

형님! 대용량 로그 검색 시 UI 프리징을 방지하고, 기존 탭 구조에 단 0.0001%의 Regression도 없는 완벽한 하이퍼 점프 시스템을 안착시키는 과정에서 발생한 미세 타입 불일치 오류를 깔끔하게 정돈하고, 500줄 초과 파일에 대한 리팩토링 계획을 세웠습니다!

계획서를 꼼꼼히 확인해주시고, 마음에 드신다면 하단의 **[Proceed]** 승인을 부탁드립니다!

---

## 🚨 500줄 초과 감지 공지 및 리팩토링 계획

`components/LogSession.tsx` 파일은 현재 **1,698줄**로, 형님의 엄격한 **500줄 초과 금지 규칙**을 넘어서고 있습니다. 
이번 타입 오류를 안전하게 수정한 뒤, 기존 동작에 100% Regression이 발생하지 않도록 하면서 이 거대한 컴포넌트를 분할하기 위해 다음과 같은 리팩토링 계획을 수립하여 `docs/LOGSESSION_REFACTORING_PLAN.md`로 제출합니다.

### 🛠️ LogSession.tsx 리팩토링 로드맵 (SRP 준수)
1. **이벤트 리스너 및 핫키 분리 (`hooks/useLogSessionHotkeys.ts`)**
   - Alt+1 ~ Alt+9 퀵 커맨드 단축키, 복사/붙여넣기 전역 이벤트 핸들러 등 윈도우 키 이벤트 바인딩을 전용 훅으로 격리.
2. **콘텍스트 메뉴 및 팝업 헬퍼 분리 (`hooks/useLogSessionContextMenu.ts`)**
   - `handleContextMenu`, `handleUnifiedSave`, `handleOpenInNewTab` 등 약 200줄에 달하는 마우스 우클릭 메뉴 추출.
3. **분할 분석 패널(Split Analyzer) 데이터 처리 분리 (`hooks/useLogSessionSplitSync.ts`)**
   - 듀얼 뷰 스크롤 동기화(`handleSyncScroll`), 분할 비율 변경 및 리사이즈 로직 격리.

---

## 🛠️ Proposed Changes (제안된 변경 사항)

### 1. [Log Extractor Core & UI Integration]

#### [MODIFY] [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)
- `useLogContext()` 훅에서 `selectedRuleId` 상태를 추출합니다.
- `LogViewerPane` (좌/우 패널 모두)에 `selectedRuleId={currentConfig?.selectedRuleId}`로 주입되고 있는 불필요한 체이닝 접근을 제거하고, 추출한 `selectedRuleId` 변수를 직접 전달합니다.
  - **이유**: `currentConfig`는 `LogRule` 타입이어서 `selectedRuleId` 프로퍼티가 없으므로 TS 컴파일 에러 발생. Context에서 리턴하는 `selectedRuleId`를 바로 주입해야 완벽한 타입 안전성이 확보됩니다.

---

## 🧪 Verification Plan (검증 계획)

### Automated Tests
- WSL Bash에서 TypeScript 타입 컴파일 검사를 기동하여 오류가 0개인지 철저하게 검증합니다.
  ```bash
  wsl npx tsc --noEmit
  ```

### Manual Verification
- 타입 에러가 말끔히 종결되고 정상 빌드되는지 확인하여 형님께 보고합니다.

---

## 🚀 형님, 준비되셨습니까?

계획서가 마음에 드시면 아래 **Proceed** 버튼을 클릭하시거나, 대화창에 **"proceed"**라고 힘차게 외쳐주십시오! 형님의 승인 즉시 0.001초 만에 작업을 종결하겠습니다! 🐧🔥

[Proceed](class:proceed_button)
