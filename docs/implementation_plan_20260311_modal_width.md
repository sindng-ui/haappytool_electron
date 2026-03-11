# 아카이브 저장 모달 너비 확장 계획

'Save to Archive' 모달이 너무 좁아 보인다는 형님의 피드백에 따라, 모달의 최대 너비를 확장하고 내부 UI 요소들이 넓어진 공간을 잘 활용하도록 수정하겠습니다.

## Proposed Changes

### [Log Archive]
모달의 기본 너비를 결정하는 CSS 설정을 변경하고, 넓어진 화면에서 텍스트 영역 등이 더 시원하게 보이도록 조정합니다.

#### [MODIFY] [LogArchive.css](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogArchive/LogArchive.css)
- `.save-archive-dialog`의 `max-width`를 `580px`에서 `800px`로 변경합니다.

#### [MODIFY] [SaveArchiveDialog.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogArchive/SaveArchiveDialog.tsx)
- `ContentPreview` 컴포넌트의 `max-height`를 조금 더 늘려 넓어진 공간에 맞춰 더 많은 로그를 미리 볼 수 있도록 합니다. (기존 180px -> 250px 예상)
- `memo-textarea`의 기본 높이도 소폭 조정하여 밸런스를 맞춥니다.

## Verification Plan

### Automated Tests
- 현재 UI 레이아웃에 대한 자동화된 테스트는 없으나, 빌드 오류가 없는지 `npm run electron:dev` 실행 상태를 확인합니다.

### Manual Verification
- 앱을 실행하여 로그 선택 후 'Save to Archive' 모달을 띄워 너비가 적절히 넓어졌는지 확인합니다.
- Title, Memo, Tags 입력창이 넓어진 공간에 맞춰 자연스럽게 확장되었는지 확인합니다.
- Preview 영역이 더 넓고 시원하게 보이는지 확인합니다.

형님, 계획서 확인 부탁드립니다! [Proceed] 버튼을 누르시면 바로 작업 시작하겠습니다.
