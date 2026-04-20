# Nupkg Signer 다운로드 파일 확장자 및 스텝 표시기 수정 계획

형님, Nupkg Signer 플러그인에서 불편을 겪으셨던 두 가지 문제를 깔끔하게 해결해 드리겠습니다! 🐧✨

## 사용자 리뷰 필수 항목

> [!IMPORTANT]
> `electronAPI`에 `saveNupkgFile`을 새로 노출시킵니다. 이는 기존 Tizen 패키지용(`saveBinaryFile`)과 NuGet 패키지용을 분리하여 확장자 혼선을 방지하기 위함입니다.

## 제안된 변경 사항

### 1. Electron 메인 및 프리로드 레이어

#### [MODIFY] [main.cjs](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/electron/main.cjs)
`saveNupkgFile` 핸들러는 이미 구현되어 있으나, `saveBinaryFile`과의 명확한 구분을 위해 확인합니다.

#### [MODIFY] [preload.cjs](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/electron/preload.cjs)
렌더러 프로세스에서 `saveNupkgFile`을 호출할 수 있도록 `electronAPI`에 추가합니다.

---

### 2. Nupkg Signer 컴포넌트 레이어

#### [MODIFY] [Step5_FinalDownload.tsx](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/components/NupkgSigner/Step5_FinalDownload.tsx)
- `saveBinaryFile` 대신 `saveNupkgFile`을 호출하도록 수정합니다.
- 이를 통해 저장 다이얼로그에서 기본 확장자가 `.nupkg`로 올바르게 표시됩니다.

#### [MODIFY] [index.tsx](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/components/NupkgSigner/index.tsx)
- 마지막 4번 스텝(Step 5)에서 다운로드가 완료되어 `isFinalized`가 `true`가 되었을 때, `isActive` 상태를 해제하여 `isCompleted` 상태(녹색불)가 화면에 나타나도록 로직을 수정합니다.

## 검증 계획

### 수동 테스트
1. Nupkg 파일을 업로드하고 서명 프로세스를 진행합니다.
2. 마지막 4단계에서 다운로드 버튼을 클릭합니다.
3. 저장 다이얼로그에서 파일 확장자가 `.nupkg`로 나오는지 확인합니다.
4. 파일을 저장한 후, 상단 스텝 바의 4번 칸이 녹색으로 변하는지 확인합니다.

형님, 위 계획대로 진행해도 될까요? 승인해주시면 바로 작업 시작하겠습니다! 🐧🚀
