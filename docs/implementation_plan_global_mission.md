# 📋 글로벌 미션 & 단축키 마우스 인터랙션 구현 및 리팩토링 계획서

형님! 요청하신 **Log Extractor 글로벌 미션 추가, 삭제 차단 가드**, **Ctrl+Shift+Alt 단축 마우스 인터랙션**, 그리고 핵심 피드백인 **"글로벌 미션에 해피콤보 단어가 추가될 때 즉각적인 단어 색칠(하이라이트) 자동 연동"** 및 이를 최종 구현하기 위한 **Pane & Session 중간 연동** 설계도까지 완벽하게 보강하여 준비했습니다! 🐧⚡

또한 `useLogExtractorLogic.tsx` 파일이 **500줄을 초과(현재 1,280줄)**하고 있어 이에 대한 명확한 분리 및 리팩토링 전략도 함께 유지하여 제출합니다. 

---

## 1. 개요 및 요구사항 정의

### 🎯 구현 목표
1. **글로벌 미션 (Global Mission) 도입 및 무결성 보장**:
   - **ID**: `global-mission`
   - **Name**: `Global Mission`
   - **규칙**: **절대 삭제 불가**. 초기 로드, Import, 데이터 손상 등 어떠한 시점에서도 누락될 경우 **자동으로 맨 위에 복구**되어야 합니다.
   - **삭제 차단**: 설정 패널 및 툴바에서 삭제 버튼 노출을 막고, API 호출로 강제 삭제 시도 시 차단 및 Toast 경고를 띄웁니다.
2. **Ctrl + Shift + Alt 단축 마우스 인터랙션**:
   - **`Ctrl + Shift + Alt + 마우스 왼쪽 더블클릭`**: 더블클릭하여 지정된 단어를 추출한 뒤, `Global Mission`의 Happy Combo(`happyGroups`) 목록에 즉시 추가합니다. (중복 검사 후 방지 로직 탑재)
   - **`Ctrl + Shift + Alt + 마우스 우클릭`**: 브라우저 기본 컨텍스트 메뉴를 완전히 차단하고, 글로벌 미션을 비울 것인지 묻는 팝업을 띄워 `Yes` 선택 시 `happyGroups`를 완전히 비웁니다.
   - **UI 문구 규격**: 사용자 팝업 및 Toast 등 모든 UI 문구는 **영어(English)**로만 출력합니다.
3. **✨ 해피콤보 단어 추가 시 하이라이트(색칠) 자동 연동 (핵심 추가!)**:
   - 단어가 글로벌 미션의 Happy Combo에 주입될 때, 화면에 색칠이 즉시 되도록 **동일 단어를 `highlights` 리스트에도 즉시 주입**하도록 `addWordToGlobalMission` API를 완벽하게 설계했습니다. (이미 logic 단에 구현되어 있으나, 이를 중간 래퍼인 `LogSession.tsx`와 `LogViewerPane.tsx`에 연동해 최종 마우스 더블클릭/우클릭과 완벽하게 엮어줍니다!)
   - HSL/bg-class(bg-yellow-200, bg-indigo-200 등 6종 테마 컬러 중 랜덤 순환 바인딩)를 자동 매핑하여, 단어가 추가되자마자 즉시 로그 화면에 형형색색의 프리미엄 하이라이트가 즉각 색칠됩니다.

---

## 2. 500줄 초과 파일 분석 및 리팩토링 계획 (500 Lines Rule)

현재 `useLogExtractorLogic.tsx`는 로그 뷰어의 코어 오케스트레이터로서 너무 많은 책임을 혼자 지고 있어 리팩토링이 필요합니다. 이번 기능 구현 및 검증을 완료한 후, 안정적인 흐름 속에서 서브 훅으로 쪼개서 `useLogExtractorLogic.tsx`를 400줄 미만의 초경량 조율사로 다이어트시킬 예정입니다.

### 🛠️ 단계별 리팩토링 로드맵
1. **`useLogRuleLifecycle.ts` [NEW]**: 룰의 CRUD와 이번에 추가할 글로벌 미션 영속성 로직을 가져갑니다.
2. **`useLogFileStream.ts` [NEW]**: 파일 로딩, 워커 오케스트레이션, SharedArrayBuffer 관리 등 고성능 데이터 스트림 영역을 격리합니다.
3. **`useLogActionExporter.ts` [NEW]**: 파일 다운로드, Confluence 복사 등 UI 외부 출력 액션을 전담합니다.

---

## 3. 세부 구현 계획 및 파일 연동 상세

### 📁 Component 1: `App.tsx` (영속성 및 Import 복원 가드) - *완료*
- **로딩 및 Import 시점 복원 가드**: `localStorage` 및 `handleImportSettings` API 실행 시 `global-mission` ID를 가진 룰이 없거나 손상되었다면 자동으로 맨 앞에 복구시켜 무결성을 보장합니다.

### 📁 Component 2: `hooks/useLogExtractorLogic.tsx` (삭제 차단 및 하이라이트 자동 연동 API) - *완료*
- **`addWordToGlobalMission`**: Happy Group에 단어를 넣음과 동시에 `newHighlights` 리스트에도 HSL 순환 무작위 배경색을 입혀서 주입하고 룰 상태를 영구 저장합니다.
- **`clearGlobalMission`**: 다이얼로그 확인창에서 `Yes` 선택 시 `happyGroups`와 `highlights`를 일괄 삭제하여 깔끔하게 비웁니다.

### 📁 Component 3: [MODIFY] `components/LogViewer/LogViewerPane.tsx` (중간 다리 Prop 추가)
- `LogViewerPaneProps` 인터페이스에 다음 props를 추가합니다:
  ```typescript
  onAddWordToGlobalMission?: (word: string) => void;
  onClearGlobalMission?: () => void;
  ```
- 구조분해할당으로 두 props를 받아 `<HyperLogRenderer>`에 그대로 공급해 줍니다:
  ```typescript
  onAddWordToGlobalMission={onAddWordToGlobalMission}
  onClearGlobalMission={onClearGlobalMission}
  ```

### 📁 Component 4: [MODIFY] `components/LogSession.tsx` (Logic - Pane 최종 연동)
- `useLogContext()`의 구조분해할당 리스트에서 logic 훅이 반환하는 `addWordToGlobalMission` 및 `clearGlobalMission`을 꺼내옵니다:
  ```typescript
  const {
      // ... 기존 구조분해
      addWordToGlobalMission,
      clearGlobalMission,
  } = useLogContext();
  ```
- Left / Right 두 `<LogViewerPane>` 컴포넌트 렌더링 영역에 props를 완벽히 연동하여 꽂아줍니다:
  ```typescript
  onAddWordToGlobalMission={addWordToGlobalMission}
  onClearGlobalMission={clearGlobalMission}
  ```

### 📁 Component 5: `components/LogViewer/HyperLogRenderer.tsx` (마우스 단축 인터랙션) - *완료*
- `Ctrl+Shift+Alt+더블클릭` 시 선택 영역의 단어를 획득하여 `onAddWordToGlobalMission`으로 비동기 추가.
- `Ctrl+Shift+Alt+우클릭` 시 기본 브라우저 컨텍스트 메뉴를 틀어막고 `onClearGlobalMission`을 실행하여 확인 모달 오픈.

---

## 4. 검증 계획

### 🧪 자동화 검증
- `npx tsc --noEmit`을 실행하여 전체 Electron 프로젝트의 TypeScript 타입 검사에서 에러가 없는지 꼼꼼히 확인합니다.
- ESLint 검사를 통과하도록 작성합니다.

### 👁️ 수동 검증 시나리오
1. **단어 더블클릭 추가 및 실시간 하이라이트 색칠 검증**:
   - 로그의 임의의 단어를 `Ctrl + Shift + Alt + 더블클릭`했을 때, 즉시 `Global Mission`의 Happy Combo 목록에 추가되고, HSL 색상 테마가 적용되어 화면 상의 동일 단어들에 즉시 아름답게 하이라이트가 색칠되는가?
   - 영어 Toast 알림이 튀어나오며, 동일 단어 중복 추가 시 무시되는가?
2. **글로벌 미션 비우기 검증**:
   - 로그 화면에 `Ctrl + Shift + Alt + 우클릭` 시 영어 다이얼로그 팝업이 뜨고, `Yes`를 클릭하면 모든 Happy Combo 단어와 하이라이트 색칠이 즉각적으로 사라지고 비워지는가?
3. **글로벌 미션 삭제 방지 검증**:
   - 설정 패널 및 상단 툴바에서 `Global Mission`을 선택했을 때 쓰레기통 버튼이 완벽하게 감추어지는가?

---

## 5. 승인 요청 및 진행 방법

형님! 글로벌 미션에 단어가 추가될 때의 하이라이트 실시간 연동 및 중간 래퍼 바인딩까지 고려한 이 계획이 마음에 드신다면, 아래 **Proceed** 버튼을 눌러 승인해 주십쇼! 

승인이 떨어지는 즉시 WSL Bash를 통해 광속으로 작업을 처리하고 완벽한 품질로 연동 및 타입 검사까지 끝내서 보고하겠습니다! 🐧🥊🔥

***

### 🚀 [Proceed] 유저 형님의 승인을 대기 중입니다...
*(형님, 이 계획서대로 작업을 시작하려면 채팅창에 **proceed**라고 입력하시거나 승인한다고 말씀해 주시면 됩니다!)*
