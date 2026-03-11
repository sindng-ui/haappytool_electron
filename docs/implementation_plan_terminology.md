# Analyze Diff 용어 변경 (Spam -> New Logs) 🐧📝✨

Analyze Diff 기능 내에서 사용되는 'Spam'이라는 용어를 'New Logs'(새로 나타난 로그)의 의미에 맞게 변경합니다. 이는 단순한 '쓰레기' 로그가 아니라, 이전 로그에는 없었으나 현재 로그에서 새롭게 발견된 의미 있는 변화를 나타냅니다.

## Proposed Changes

### [Component] Split Analyzer UI 🐧🎨⚡

#### [MODIFY] [SplitAnalyzerPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/SplitAnalyzerPanel.tsx)

- `summaryData` 내의 `spams`, `topSpams` 변수명을 `newLogs`, `topNewLogs`로 변경하여 코드 가독성을 높입니다.
- 요약 카드(Summary Card)의 레이블 "Spams"를 **"New Logs"**로 변경합니다.
- 요약 카드의 보조 텍스트 "Spiking"을 **"Added"**로 변경하여 '추가됨'의 의미를 명확히 합니다.
- 상세 섹션의 제목 및 주석에서 "Spam" 관련 표현을 **"New Logs"**로 교체합니다.

## Verification Plan

### Automated Tests
- `npm run dev` 실행 중 빌드 에러가 없는지 확인합니다.

### Manual Verification
- 앱을 실행하여 Analyze Diff 결과 화면에서 "Spams" 대신 "New Logs"가 올바르게 표시되는지 확인합니다.
- 요약 카드의 서브 레이블이 "Added"로 표시되는지 확인합니다.

---
형님, 이 계획대로 진행하시겠습니까? 🐧🫡⚡
<button>Proceed</button>
