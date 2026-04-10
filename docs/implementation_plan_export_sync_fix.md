# [Log Extractor] Ctrl+C 선택 복사 동기화 버그 수정 계획

형님, 로그 추출 도구에서 3줄만 선택하고 `Ctrl+C`를 눌렀을 때 35줄(전체)이 복사되던 범인을 찾았습니다. `LogSession.tsx`에 있는 전역 키보드 이벤트 핸들러가 인자 없이 `handleCopyLogs`를 호출하면서, 기본값인 `ignoreSelection: true`가 적용되어 전체 복사가 수행되고 있었습니다.

## User Review Required

> [!IMPORTANT]
> `LogSession.tsx`의 전역 단축키 핸들러(`handleGlobalKeyDown`)에서 복사 로직을 수정합니다. 기존에 인자 없이 호출되던 부분을 `false`(선택 영역 존중)로 명시하여 호출하도록 변경합니다.

## Proposed Changes

### [Component] [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)

#### [MODIFY] [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)
- `handleGlobalKeyDown` 내부의 `Ctrl+C` 처리 로직에서 `handleCopyLogs(targetPane)` 호출 시 두 번째 인자로 `false`를 명시합니다.
- (선택 사항) `onCopyLeft`, `onCopyRight` 등 래퍼 함수를 일관성 있게 사용하도록 정리할 수도 있지만, 우선 버그 수정에 집중합니다.

```typescript
// AS-IS
handleCopyLogs(targetPane as 'left' | 'right');

// TO-BE
handleCopyLogs(targetPane as 'left' | 'right', false);
```

## Verification Plan

### Automated Tests
- 이미 작성한 `test/hooks/useLogExportActions.test.tsx`가 로직의 정당성을 증명했습니다.
- 추가로 `LogSession`의 전역 이벤트 핸들링을 시뮬레이션하는 통합 테스트 작성을 고려할 수 있으나, 현재 WSL 환경 제약상 수동 검증이 더 효율적일 수 있습니다.

### Manual Verification
1. 로그 3줄 선택.
2. `Ctrl+C` 입력.
2. 토스트 메시지에 "Copied 3 selected lines!"가 뜨는지 확인.
3. 상단 툴바의 "Copy Filtered Logs" 버튼 클릭 시에는 전체 로그가 복사되는지 확인 (ignoreSelection: true 유지).

<button id="proceed">변경 사항 적용하기</button>
