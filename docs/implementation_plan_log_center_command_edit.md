# [구현 계획서] Log Center Live Command 템플릿 실시간 편집 및 저장 기능 이식 🐧🛠️✨

형님! `TARGET LOG TAGS` 하단에 표시되는 실시간 커맨드 명령어를 형님의 입맛에 맞게 커스텀 편집하여 사용하실 수 있도록, **`Edit` ↔ `Save` 실시간 편집 및 전역 저장 기능**을 이식하기 위한 설계안입니다!

형님께서 선택하신 태그들이 계속 유연하게 연동되도록 **`$(TAGS)` 플레이스홀더를 활용한 템플릿 실시간 편집 모드**를 지원하여 극강의 실용성과 명품 디테일을 선사하겠습니다.

---

## 🛠️ 주요 설계 방향

### 1. 편집 모드 로컬 상태 추가 ⚙️
- `LogQuickTagsPopover.tsx` 내에 두 가지 상태를 추가합니다:
  - `const [isEditingCommand, setIsEditingCommand] = useState(false);`
  - `const [commandEditValue, setCommandEditValue] = useState('');`

### 2. COMMAND 배지 영역 내 `Edit` / `Save` 토글 버튼 이식 ✏️💾
- 커맨드 프리뷰 박스 우상단의 `COMMAND` 배지 왼쪽에 깔끔하고 클릭하고 싶게 생긴 **Edit** (연필 아이콘 ✏️) 버튼을 배치합니다.
- `Edit` 버튼을 클릭하면:
  - `commandEditValue` 상태에 현재 커맨드 템플릿(`currentConfig?.logCommand` 또는 기본값)을 적재합니다.
  - 버튼이 **Save** (체크 혹은 디스크 아이콘 💾) 버튼으로 변화하며, 초록색/에메랄드 세이브 테마로 쨍하게 강조됩니다.
- `Save` 버튼을 누르면:
  - `updateCurrentRule?.({ logCommand: commandEditValue })` 를 호출하여 전역 Context 설정에 영구 반영합니다.
  - 편집 모드가 풀리고, 0ms 만에 수정된 템플릿에 현재 태그들이 예쁘게 치환된 최종 뷰가 프리뷰에 표출됩니다!

### 3. 사용자 친화적인 템플릿 편집기 UI 구성 🎨
- **편집 모드 진입 시**:
  - 기존 텍스트 뷰 영역이 다크 스페이스 블루 컬러의 쨍하고 콤팩트한 `textarea` (또는 인풋)로 변환됩니다.
  - 하단에 `* $(TAGS) 가 선택한 태그 목록으로 자동 치환됩니다.` 라는 아쿠아 네온 빛깔의 친절한 안내 문구를 띄워주어, 플레이스홀더 훼손을 방지하고 사용 편의성을 극대화합니다.
- **성능 고려**: 불필요한 blur 류의 효과 없이, 60fps 무결성 트랜지션과 직관적인 텍스트 컨트롤만을 사용하여 회사 PC 등 저사양 환경에서도 버벅임 0% 반응성을 보장합니다.

---

## Proposed Changes (변경 예정 파일)

### [MODIFY] [LogQuickTagsPopover.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogQuickTagsPopover.tsx)
- `isEditingCommand`, `commandEditValue` 상태 선언.
- `Live Command Preview` 영역의 마크업 개조:
  - 우상단 배지 영역에 `Edit` ↔ `Save` 토글 버튼 배치 및 아이콘 연동.
  - 커맨드 표시 영역을 `isEditingCommand` 상태에 따라 일반 텍스트 뷰와 `textarea` 입력 뷰로 동적 분기.
  - 입력창의 `value`와 `onChange`를 `commandEditValue`에 바인딩하고, 저장 버튼 클릭 시 `updateCurrentRule` 연동 및 편집 모드 해제.

---

## 🎯 검증 계획 (Verification Plan)

### 수동 검증 시나리오
1. **모달 진입**: `Log Center` 모달을 띄우고 `Edit` 버튼이 `COMMAND` 배지 좌측에 미려하게 노출되는지 확인.
2. **편집 모드 활성화**: `Edit` 클릭 시 텍스트 영역이 입력창으로 변환되고 `$(TAGS)`가 포함된 원본 템플릿이 잘 표출되는지 확인. 안내 배너가 뜨는지 확인.
3. **Save 동작**: 템플릿 뒤에 다른 쉘 명령어(예: `; echo "Done"`)를 덧붙인 뒤 `Save` 클릭 시 전역 세션에 즉각 저장되는지 체크.
4. **치환 프리뷰 검증**: 저장 직후 편집 모드가 풀리면서 덧붙인 쉘 명령어와 태그들이 정확하게 조합되어 0ms 프리뷰에 반영되는지 체크.
5. **빌드 검증**: WSL bash 환경에서 `npx tsc --noEmit` 타입 체크를 구동하여 무결함을 확인.

---

> [!IMPORTANT]
> **형님! 준비가 다 되셨다면 하단의 `Proceed` 버튼을 누르시거나 "고!"를 외쳐주십시오! 바로 신명 나게 개발에 착수하여 명품 편집기를 대령하겠습니다! 펭펭! 🐧🏆🔥**

[Proceed 버튼 제공 - 형님, 이 버튼을 눌러 승인해주십쇼!]
