# Log Extractor 단축키 추가 (Ctrl + L) 🐧⌨️⚡

로그 뷰어에서 라인 넘버 표시 여부를 즉시 토글할 수 있는 단축키(`Ctrl + L`)를 추가합니다.

## 제안된 변경 사항

### [Log Extractor] (file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)

#### [MODIFY] [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)

- `handleGlobalKeyDown` 함수 내에 `Ctrl + L` 및 `Ctrl + ㅣ`(한국어 레이아웃) 키 조합 처리 로직을 추가합니다.
- `updateLogViewPreferences`를 호출하여 `showLineNumbers` 상태를 반전시킵니다.
- 토글 시 `addToast`를 통해 변경된 상태(Shown/Hidden)를 사용자에게 알립니다.

### [가이드 및 지도 업데이트]

#### [MODIFY] [USER_GUIDE.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/USER_GUIDE.md)
- 키보드 단축키 섹션에 `Ctrl + L: 라인 넘버 표시 토글` 내용을 추가합니다.

#### [MODIFY] [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/APP_MAP.md)
- `Log Viewer`의 단축키 목록에 `Ctrl + L`을 추가합니다.

---

## 검증 계획

### 수동 검증
1. **단축키 동작 확인**: 로그 뷰어 활성 상태에서 `Ctrl + L`을 눌러 라인 넘버(Gutter)가 사라졌다가 다시 나타나는지 확인합니다.
2. **한국어 레이아웃 확인**: 한글 입력 상태(`Ctrl + ㅣ`)에서도 동일하게 동작하는지 확인합니다.
3. **토스트 알림 확인**: 상태 변경 시 우측 하단에 알림이 정상적으로 뜨는지 확인합니다.
4. **설정 영속화 확인**: 단축키로 변경 후 앱을 재시작하거나 탭을 옮겼을 때 설정이 유지되는지 확인합니다.
