# App Hub Labs 섹션 기본 접힘 상태 변경 계획서

형님, App Hub의 Labs 섹션이 기본적으로 접혀 있도록 수정하고, 형님의 선택은 소중하니까 로컬 스토리지에 잘 저장해서 유지되도록 하겠습니다! 🐧

## 1. 수정 대상 파일
- `components/AppLibraryModal.tsx`

## 2. 상세 수정 내용

### 2.1 Labs 섹션 초기 상태 로직 변경
현재는 로컬 스토리지에 값이 없으면 `false`(펼침)가 기본값이 되는데, 이를 `true`(접힘)가 기본이 되도록 변경합니다.

**기존 코드:**
```tsx
const [isLabsCollapsed, setIsLabsCollapsed] = React.useState(() => {
  return localStorage.getItem('happy_app_hub_labs_collapsed') === 'true';
});
```

**변경 코드:**
```tsx
const [isLabsCollapsed, setIsLabsCollapsed] = React.useState(() => {
  const saved = localStorage.getItem('happy_app_hub_labs_collapsed');
  // 저장된 값이 없으면(null) 기본적으로 접힘(true) 상태로 시작합니다.
  return saved === null ? true : saved === 'true';
});
```

## 3. 검증 계획
1. **기본 동작 확인**: 브라우저 로컬 스토리지를 비운 후 App Hub를 열었을 때 Labs 섹션이 접혀 있는지 확인합니다.
2. **상태 변경 확인**: Labs 섹션을 펼친 후, 페이지를 새로고침해도 펼쳐진 상태가 유지되는지 확인합니다.
3. **상태 복구 확인**: 다시 접은 후, 새로고침해도 접힌 상태가 유지되는지 확인합니다.

형님, 이대로 진행할까요? proceed 버튼 눌러주시면 바로 신나게 작업 들어가겠습니다! 🐧
