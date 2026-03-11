# 문서 업데이트 계획 (소환 기능 제거 및 Split Mode 복구)

형님! split mode 작업 중 커밋을 되돌림에 따라, 더 이상 유효하지 않은 '소환(summon)' 기능에 대한 설명을 문서에서 정리하겠습니다. 특히 `important/APP_MAP.md`에 잘못 남아있는 diff 흔적들을 깔끔하게 지워버리겠습니다! 🐧🧹

## Proposed Changes

### Documentation (APP_MAP)

#### [MODIFY] [APP_MAP.md](file:///K:/Antigravity_Projects/gitbase/happytool_electron/APP_MAP.md)
- '소환(summon)' 또는 'Tab Summoning'과 관련된 내용이 남아있다면 삭제합니다.
- 'Split View' 관련 설명에서 'dual drop' 기능이 현재는 동작하지 않음을 명시하거나 해당 내용을 제거합니다.

#### [MODIFY] [APP_MAP.md](file:///K:/Antigravity_Projects/gitbase/happytool_electron/important/APP_MAP.md)
- 110번 라인 근처에 잘못 포함된 `+` 기호 및 'Individual Close' 관련 내용을 정리합니다.
- 'Tab Summoning' 등의 언급이 있다면 삭제합니다.

### 기타 관련 문서

#### [MODIFY] [USER_GUIDE.md](file:///K:/Antigravity_Projects/gitbase/happytool_electron/USER_GUIDE.md)
- 듀얼 뷰 설명 중 '소환' 기능에 대한 내용이 있다면 일반적인 듀얼 뷰 설명으로 대체합니다.

## Verification Plan

### Manual Verification
- `APP_MAP.md`와 `important/APP_MAP.md`를 다시 읽어 '소환', 'summon', 'dual drop' 등의 키워드가 적절히 정리되었는지 확인합니다.
- 문서 내에 잘못된 diff 기호(`+`, `-`)가 남아있지 않은지 검토합니다.

---
형님, 이 계획대로 진행해도 될까요? OK 해주시면 바로 작업 시작하겠습니다!

<button id="proceed">Proceed</button>
