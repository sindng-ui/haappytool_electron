# 북마크 모달 필터링 상태 표시 버그 수정 계획 🐧🛠️

형님, 로그 필터링 상태에서 북마크를 지정했을 때 북마크 모달에 내용이 표시되지 않는 문제를 해결하기 위한 계획입니다.

## 원인 분석
`LogSession.tsx`에서 북마크 모달에 전달되는 `requestLeftBookmarkedLines`와 `requestRightBookmarkedLines` 함수가 워커에 데이터를 요청할 때 `isAbsolute` 플래그를 `true`로 설정하고 있습니다. 하지만 UI에서 관리되는 북마크 인덱스는 **시각적 인덱스(Visual Index)**이므로, 워커의 `getLinesByIndices`에서 절대 인덱스로 오인하여 데이터를 찾지 못하는 현상이 발생했습니다.

## Proposed Changes

### [Log Extractor UI]

#### [MODIFY] [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)
- `requestLeftBookmarkedLines`와 `requestRightBookmarkedLines` 호출 시 `isAbsolute` 인자를 `false`로 변경합니다.

```typescript
// AS-IS
const requestLeftBookmarkedLines = React.useCallback((indices: number[]) => requestBookmarkedLines(indices, 'left', true), [requestBookmarkedLines]);
const requestRightBookmarkedLines = React.useCallback((indices: number[]) => requestBookmarkedLines(indices, 'right', true), [requestBookmarkedLines]);

// TO-BE
const requestLeftBookmarkedLines = React.useCallback((indices: number[]) => requestBookmarkedLines(indices, 'left', false), [requestBookmarkedLines]);
const requestRightBookmarkedLines = React.useCallback((indices: number[]) => requestBookmarkedLines(indices, 'right', false), [requestBookmarkedLines]);
```

## Verification Plan

### Manual Verification
1. 로그 파일을 엽니다.
2. 특정 키워드로 필터링을 적용합니다.
3. 필터링된 결과 중 일부 라인에 북마크를 추가합니다 (Space 키).
4. 북마크 모달을 엽니다 (Ctrl + B).
5. 북마크된 라인들이 모달에 정상적으로 표시되는지 확인합니다.
6. 북마크를 클릭하여 해당 위치로 이동하는지 확인합니다.
7. 필터가 없는 상태에서도 북마크 모달이 정상 동작하는지 다시 한 번 확인합니다.

<button id="proceed_button">Proceed</button>
