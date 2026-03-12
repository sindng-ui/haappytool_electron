# 해피 콤보 필터링 연동 구조 개선 계획 (2차)

형님! "전체 끄기 후 하나만 켜기"가 작동하지 않았던 근본 원인을 해결하고, 더 직관적인 UI/UX로 개선합니다.

## 문제 분석
- **원인**: `filterGroupUtils.ts`에서 마스터 스위치(`happyCombosEnabled`)가 `false`이면, 하위의 개별 콤보가 켜져 있어도 필터링 로직 자체가 중단됨.
- **현상**: 마스터 스위치가 개별 스위치보다 강력한 "차단기" 역할을 수행하여 연동을 방해함.

## 제안된 변경 사항

### 1. 필터 엔진 로직 수정
#### [MODIFY] [filterGroupUtils.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/utils/filterGroupUtils.ts)
- `assembleIncludeGroups` 함수에서 마스터 스위치(`happyCombosEnabled`) 체크 로직을 제거합니다.
- 이제 필터링 여부는 오직 개별 콤보들의 `enabled` 상태에만 의존합니다. (모두 꺼져있으면 자동으로 필터링 안됨)

### 2. UI 및 연동 로직 개선
#### [MODIFY] [HappyComboSection.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/ConfigSections/HappyComboSection.tsx)
- **마스터 체크박스 역할 변경**: "상태 차단기" -> "전체 토글(All Toggle) 마스터"
- **상태 동기화**:
    - 체크 상태 (`checked`): 하위 항목 중 **하나라도 켜져 있으면** 체크된 것으로 표시 (`isAnyEnabled`).
    - 클릭 동작 (`onChange`): 
        - **켜기** ( unchecked -> checked ): 현재 규칙의 모든 `happyGroups`를 `enabled: true`로 변경하여 **전체 활성화**. (형님의 '다시 다 켜져야 함' 요구사항 충족)
        - **끄기** ( checked -> unchecked ): 모든 `happyGroups`를 `enabled: false`로 변경하여 **전체 비활성화**. (형님의 '일단 다 끄고' 요구사항 충족)
- **시각적 피드백**: `Happy Combos` 섹션의 활성화 색상(노란색/인디고) 판정 기준을 `isAnyEnabled`로 변경하여, 마스터 스위치 상태가 아닌 **실제 필터 작동 여부**를 반영하게 합니다.

## 검증 계획

### 수동 검증
1. **전체 끄기**: 마스터 체크박스를 해제하여 모든 하위 콤보가 꺼지는지 확인합니다.
2. **개별 켜기**: 하위 콤보 중 하나만 켭니다. (이때 마스터 체크박스가 '켜짐' 상태로 자동 변경됩니다.)
3. **필터링 확인**: 마스터 영향 없이 켜진 콤보가 즉시 필터링에 반영되는지 확인합니다.
4. **전체 켜기**: 마스터가 이미 켜져 있더라도(일부만 켜진 경우), 혹은 꺼진 경우에 클릭하여 **모든** 콤보가 한 번에 활성화되는지 확인합니다.

---

형님! 이렇게 하면 "전체 다 끄고 보고 싶은 놈 하나만 딱 골라 보기"가 아주 시원하게 작동할 겁니다. 진행할까요? 🐧🚀

[PROCEED]
