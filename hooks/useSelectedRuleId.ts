import { useState, useEffect, useRef } from 'react';
import { getStoredValue, setStoredValue } from '../utils/db';
import { LogRule } from '../types';

/**
 * 선택된 Rule ID(프리셋)를 탭별로 저장/복원하는 훅.
 * - 탭별 키(`lastSelectedRuleId_<tabId>`)를 우선 사용하고, 없으면 전역 키를 폴백으로 사용합니다.
 */
export function useSelectedRuleId(rules: LogRule[], tabId: string) {
    const [selectedRuleId, setSelectedRuleId] = useState<string>(() =>
        rules.length > 0 ? rules[0].id : ''
    );
    const hasRestoredFromDb = useRef(false);

    // 마운트 시 저장된 Rule ID 복원
    useEffect(() => {
        if (rules.length === 0) return;

        if (!hasRestoredFromDb.current) {
            hasRestoredFromDb.current = true;
            const tabKey = `lastSelectedRuleId_${tabId}`;

            Promise.all([
                getStoredValue(tabKey),
                getStoredValue('lastSelectedRuleId')
            ]).then(([tabSaved, globalSaved]) => {
                const saved = tabSaved || globalSaved;
                const target = saved && rules.find(r => r.id === saved) ? saved : (rules[0]?.id || '');
                if (target) setSelectedRuleId(target);
            });
        } else {
            // 현재 선택된 Rule이 삭제된 경우 첫 번째 Rule로 폴백
            if (!rules.find(r => r.id === selectedRuleId)) {
                setSelectedRuleId(rules.length > 0 ? rules[0].id : '');
            }
        }
    }, [rules, selectedRuleId, tabId]);

    // selectedRuleId가 변경될 때마다 탭별/전역 키에 저장
    useEffect(() => {
        if (selectedRuleId) {
            setStoredValue(`lastSelectedRuleId_${tabId}`, selectedRuleId);
            setStoredValue('lastSelectedRuleId', selectedRuleId);
        }
    }, [selectedRuleId, tabId]);

    return { selectedRuleId, setSelectedRuleId };
}
