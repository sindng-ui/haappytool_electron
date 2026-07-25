# [구현 계획] PostTool.tsx 500줄 초과 최소 영향 리팩토링 계획

`components/PostTool.tsx` (현재 760줄)의 500줄 초과 이슈를 해결하고, 기존 동작 및 성능에 사이드 이펙트가 전혀 없도록 최소 수정 방식으로 서브 컴포넌트를 분리하는 계획입니다.

## 🎯 목표
- 기존 UI 동작, 상태 관리, 이벤트 핸들링 및 IPC proxy통신에 **0% 영향**을 주는 무결성 최소 리팩토링.
- `PostTool.tsx` 라인 수를 **760줄 → 480줄 이하**로 축소하여 500줄 규칙 준수.

---

## 📐 분리 대상 컴포넌트 (Proposed Components)

### 1. `components/PostTool/CodeSnippetModal.tsx` [NEW]
- **역할**: cURL, JS Fetch, Python Requests, Node Axios 코드 생성 및 복사 팝업 모달.
- **감소 라인 수**: 약 110줄

### 2. `components/PostTool/EnvironmentDropdown.tsx` [NEW]
- **역할**: Environment Profile 전환 및 선택 드롭다운 UI.
- **감소 라인 수**: 약 60줄

---

## 🛠️ 변경 계획 (Proposed Changes)

#### [NEW] [CodeSnippetModal.tsx](file:///K:/Antigravity_Projects/gitbase/happytool_electron/components/PostTool/CodeSnippetModal.tsx)
- 코드 스니펫 생성 로직(`generateCode`) 및 모달 JSX 캡슐화.

#### [NEW] [EnvironmentDropdown.tsx](file:///K:/Antigravity_Projects/gitbase/happytool_electron/components/PostTool/EnvironmentDropdown.tsx)
- Active Profile 전환 드롭다운 JSX 및 외부 클릭 닫기 캡슐화.

#### [MODIFY] [PostTool.tsx](file:///K:/Antigravity_Projects/gitbase/happytool_electron/components/PostTool.tsx)
- 신규 작성된 2개 서브 컴포넌트 바인딩.
- 파일 라인 수 500줄 이하로 슬림화.

---

## 🔍 검증 계획 (Verification Plan)
- PostTool 상단 Environment 전환 드롭다운 정상 작동 확인.
- Code Snippet 모달 팝업 및 cURL/Fetch/Python/Node 코드 복사 기능 100% 정상 작동 확인.
- PostTool API 전송(Send) 및 Response Viewer 바인딩 100% 정상 작동 확인.
