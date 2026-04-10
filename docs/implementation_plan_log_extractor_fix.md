# Log Extractor PID/TID 분석 기능 수정 계획서

형님, Log Extractor에서 PID/TID 분석이 안 되던 문제를 찾았습니다! 범인은 바로 `workerAnalysisHandlers.ts`에 숨어있던 엉터리 정규표현식이었슴다. 🐧⚡

## 사용자 리뷰 필요 사항

> [!IMPORTANT]
> - PID/TID를 더 정확하게 찝어내기 위해 정규표현식 로직을 깔끔하게 고칠 예정입니다. 
> - 우클릭 메뉴 레이블도 "Analyze Transaction: PID (1234)" 대신 "PID 분석: 1234"처럼 형님이 보시기 편하게 한국어로(표시만) 바꿀까 합니다. (코드 내 상수는 영어 유지)

## Proposed Changes

---

### [Worker 분석 핸들러]

#### [MODIFY] [workerAnalysisHandlers.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/workerAnalysisHandlers.ts)
- `analyzeTransaction` 함수 내의 PID/TID 검색용 정규표현식을 수정합니다.
- 기존의 공백이 섞인 `(?:^| [^ 0 - 9a - zA - Z])${regexVal} (?: $ | [^ 0 - 9a - zA - Z])` 로직을 제거하고, 정확한 워드 바운더리를 사용하는 로직으로 교체합니다.

### [UI 컴포넌트]

#### [MODIFY] [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)
- 컨텍스트 메뉴(`handleContextMenu`)에서 생성되는 분석 항목의 레이블을 "PID 분석", "TID 분석" 등으로 더 직관적으로 변경합니다.

---

## Verification Plan

### Automated Tests
- `scratch/repro_regex.js`를 돌려서 수정된 정규표현식이 다양한 로그 포맷(Android/Tizen 등)을 잘 잡아내는지 형님께 먼저 보여드리겠습니다.

### Manual Verification
- 실제 로그를 띄워놓고 "PID 분석"을 눌렀을 때, 아래쪽 Drawer에 해당 PID를 가진 로그들만 쫙 모이는지 확인하겠습니다.

## 진행을 위해 'Proceed' 버튼을 눌러주세요!
<button id="proceed_button">Proceed</button>
