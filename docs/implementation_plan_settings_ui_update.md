# CLI 설정 UI 업데이트 계획 🐧🖥️⚡

설정(Settings) 페이지 내의 CLI 예제와 가이드를 최신 기능인 `analyze-diff` 명령어로 업데이트합니다.

## 제안된 변경 사항

### [설정 모달] (file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/SettingsModal.tsx)

#### [MODIFY] [SettingsModal.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/SettingsModal.tsx)

- **Headless CLI 탭 (Quick Commands)**:
    - 기존 `JSON Tools` 카드를 제거하고 `Analyze Diff` 카드를 추가합니다.
    - 예제 명령어: `.\BigBrain.exe cli analyze-diff -f "Mission" -l "left.log" -r "right.log" -o "diff.json"`
- **User Guide 탭 (기능 목록)**:
    - `JSON Tools` 항목을 `Analyze Diff`로 변경하여 일관성을 유지합니다.

---

## 검증 계획

### 수동 검증
1.  **UI 확인**: 설정 모달 > Headless CLI 탭에서 `Analyze Diff` 예제가 스크린샷과 동일한 스타일로 표시되는지 확인합니다.
2.  **복사 기능**: 복사 버튼 클릭 시 클립보드에 정확한 `analyze-diff` 명령어가 복사되는지 확인합니다.
3.  **가이드 탭**: User Guide 탭에서도 `Analyze Diff` 설명이 잘 나오는지 확인합니다.
