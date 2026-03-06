# CLI 가이드 열기 기능 수정 계획 🐧🛠️

형님, 가이드 버튼이 안 눌리는 이유는 패키징 시에 가이드 파일(`cli_user_guide.md`)이 포함되지 않았고, 경로 처리 로직이 패키징된 환경을 완벽하게 고려하지 못했기 때문입니다.

## 1. 개요
- **목표**: 설정창의 'Open Full Guide' 버튼이 패키징된 배포판에서도 가이드 파일을 정상적으로 열 수 있도록 수정.
- **주요 변경 사항**:
    - `package.json`: `extraResources`에 `important/cli_user_guide.md` 추가.
    - `SettingsModal.tsx`: 파일 경로 조합 로직 최적화.

## 2. 세부 구현 계획

### 📦 빌드 설정 수정 (`package.json`)
- `extraResources` 섹션에 `important/cli_user_guide.md`를 명시적으로 추가하여 패키징 시 `resources` 폴더 아래에 복사되도록 설정합니다.
- 이렇게 하면 `app.asar` 외부로 추출되므로 외부 뷰어(메모장, 마크다운 뷰어 등)에서 열 수 있습니다.

### 🛠 로직 수정 (`SettingsModal.tsx`)
- 현재 경로 조합 로직을 점검하고, 패키징된 환경(`resourcesPath`)에서도 정확한 파일 경로를 가리키도록 수정합니다.
- `window.electronAPI.openExternal` 호출 시 유효한 `file://` URL 또는 파일 시스템 경로를 전달합니다.

## 3. 검증 계획
- 개발 환경(`npm run electron:dev`)에서 버튼 동작 확인.
- (필요 시) `win-unpacked` 환경에서 파일 존재 여부 수동 확인 안내.

형님, 이대로 진행해도 될까요? 승인해 주시면 바로 수정 들어갑니다! 🐧🔥 [proceed]
