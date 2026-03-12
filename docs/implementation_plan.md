# 해피 콤보 마스터 체크박스 연동 구현 계획

해피 콤보 전체를 활성화/비활성화하는 마스터 체크박스의 상태를 하위 항목들과 동기화하도록 개선합니다.

## 제안된 변경 사항

### Log Viewer Component

#### [MODIFY] [HappyComboSection.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/ConfigSections/HappyComboSection.tsx)

- 마스터 체크박스(`Happy Combos` 제목 옆)의 `onChange` 이벤트 핸들러를 수정합니다.
- 체크박스가 **해제(unchecked, false)**될 때, 현재 규칙의 `happyGroups` 배열에 있는 모든 항목의 `enabled` 상태를 `false`로 변경하여 `updateCurrentRule`을 호출합니다.
- 이를 통해 마스터 스위치를 끌 때 모든 상세 콤보 규칙들이 시각적/기능적으로 함께 꺼지도록 보장합니다.

```tsx
// 예상 변경 코드 (HappyComboSection.tsx)
onChange={(e) => {
    const enabled = e.target.checked;
    const updates: Partial<LogRule> = { happyCombosEnabled: enabled };
    
    // 마스터 체크박스 해제 시 모든 하위 그룹도 비활성화
    if (!enabled && currentConfig.happyGroups) {
        updates.happyGroups = currentConfig.happyGroups.map(g => ({ ...g, enabled: false }));
    }
    
    updateCurrentRule(updates);
}}
```

## 검증 계획

### 수동 검증
1. **해피 콤보 섹션 진입**: 로그 익스트렉터의 설정 패널에서 `Happy Combos` 섹션으로 이동합니다.
2. **하위 항목 활성화 확인**: 일부 해피 콤보 루트 항목들이 체크(활성화)되어 있는지 확인합니다.
3. **마스터 체크박스 해제**: 상단의 `Happy Combos` 마스터 체크박스를 클릭하여 해제합니다.
4. **결과 확인**: 모든 하위 루트 항목들의 체크박스가 함께 해제되는지 확인합니다.
5. **마스터 체크박스 재설정**: `Happy Combos`를 다시 체크했을 때, 하위 항목들이 이전 상태를 유지하거나(혹은 방금 해제된 상태 그대로) 정상 동작하는지 확인합니다. (이번 요청은 해제 시의 연동에 집중합니다.)

---

형님, 위 계획대로 진행해도 될까요? OK 하시면 바로 코드 수정 들어가겠습니다! 🐧🚀

[PROCEED]
