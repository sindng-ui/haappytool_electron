# CLI 가이드 열기 버튼 버그 수정 워크쓰루 🐧✅

형님, 설정창에서 'Open Full Guide' 버튼을 눌러도 반응이 없던 문제를 해결했습니다! 

## 🛠 변경 사항

### 1. 빌드 설정 업데이트 (`package.json`)
패키징 시 `important/cli_user_guide.md` 파일이 `resources` 폴더에 포함되도록 `extraResources` 설정을 추가했습니다. 이제 배포판에서도 파일이 누락되지 않습니다.

### 2. 경로 처리 로직 개선 (`SettingsModal.tsx`)
개발 환경과 패키징된 환경(`resourcesPath`)을 모두 고려하여 가이드 파일의 절대 경로를 정확히 계산하도록 로직을 수정했습니다. `file://` 프로토콜 대신 시스템 경로를 직접 사용하여 호환성을 높였습니다.

### 3. 검증 완료
- **유닛 테스트**: `CliApp.test.tsx`를 포함한 **271개 전체 테스트 통과** 확인.
- **개발 환경**: `npm run electron:dev` 환경에서 버튼 동작 확인.

## 💡 형님을 위한 팁
이 수정 사항은 **다음 빌드 시** 배포판에 반영됩니다. 현재 `win-unpacked` 환경에서 바로 확인하시려면 `important/cli_user_guide.md` 파일을 `dist_electron/win-unpacked/resources/important/` 폴더 내에 수동으로 복사해주시면 바로 작동할 겁니다!

형님, 이제 CLI 가이드를 마음껏 열어보실 수 있습니다! 🐧🚀💎
