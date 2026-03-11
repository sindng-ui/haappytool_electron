# Split 모드 상태 유지 및 자동 복원 구현 계획

형님, 앱 종료 후 다시 실행했을 때 Split 모드와 양쪽 파일을 그대로 불러오도록 하는 기능을 설계했습니다. 🐧🚀

## 주요 변경 사항

### [LogViewer] 상태 관리 및 영속화 레이어 확장 🧩

#### 1. `useLogExtractorLogic.ts` (훅) [MODIFY]
- **`rightFilePath` 상태 추가**: 우측 파일 경로를 상태로 관리합니다.
- **Props 확장**: `useLogFileOperations`에 `isDualView`, `setIsDualView`, `rightFilePath`, `setRightFilePath` 등을 전달하도록 수정합니다.

#### 2. `useLogFileOperations.ts` (훅) [MODIFY]
- **`Props` 인터페이스 확장**: Split 모드 여부와 우측 파일 경로/세터를 포함합니다.
- **`loadFile` 함수 범용화**: Pane 인자(`pane: 'left' | 'right'`)를 추가하여 양쪽 모두를 지원하도록 리팩토링합니다.
- **`loadState` 함수 강화**: `tabState_${tabId}`에서 `isDualView`, `rightFilePath`를 복원하고 필요한 경우 `loadFile`을 호출합니다.
- **`Periodic Persistence` (setInterval) 로직**: `isDualView`와 `rightFilePath`를 영속화 데이터에 포함시킵니다.
- **`handleRightFileChange`**: 우측 파일 변경 시 즉시 경로를 업데이트합니다.

---

## 검증 계획 🧪

### 수동 테스트
1. 앱을 실행하고 로그 파일 하나를 엽니다.
2. **Split 모드(Columns 아이콘)**를 활성화합니다.
3. 우측 Pane에 다른 로그 파일을 드롭하거나 선택하여 엽니다.
4. 앱을 종료(또는 새로고침)합니다.
5. 앱 재실행 시 해당 탭이 자동으로 Split 모드로 전환되고, **좌/우측 파일이 모두 로드**되는지 확인합니다.


형님, 이 계획대로 진행해도 될까요? **Proceed** 버튼을 눌러주시면 바로 작업 시작하겠습니다! 🐧🚀

[PROCEED](command:antigravity.notify_user?%5B%5B%5D%2C%20false%2C%20%22%ED%98%95%EB%8B%98%2C%20%ED%94%8C%EB%9E%9C%20%ED%99%95%EC%9D%B8%20%EB%B6%80%ED%83%81%EB%93%9C%EB%A6%BD%EB%8B%88%EB%8B%A4!%20Proceed%20%EB%88%8C%EB%9F%AC%EC%A3%BC%EC%8B%AD%EC%87%BC!%20%F0%9F%90%A7%22%2C%20true%5D)
