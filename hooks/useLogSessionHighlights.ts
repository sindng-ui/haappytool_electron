import React from 'react';
import { stringToColor } from '../utils/colorUtils';

export const useLogSessionHighlights = (currentConfig: any) => {
    // Prepare Effective Highlights (Explicit + Auto-generated Highlighting for Happy Combos)
    return React.useMemo(() => {
        const baseHighlights = currentConfig?.highlights || [];

        // Determine case sensitivity for deduplication
        // 형님, 어느 한 쪽이라도 켜져 있으면 중복 체크할 때 대소문자를 구분합니다.
        const isCaseSensitive = !!currentConfig?.happyCombosCaseSensitive || !!currentConfig?.colorHighlightsCaseSensitive;

        // Only classify highlights with ACTUAL color as "existing/colliding"
        // Deduplicate based on case sensitivity setting
        const validExistingKeywords = new Set(
            baseHighlights
                .filter((h: any) => h.color && h.color.trim().length > 0)
                .map((h: any) => isCaseSensitive ? h.keyword : h.keyword.toLowerCase())
        );

        const autoHighlights: any[] = [];
        const termsToHighlight = new Set<string>();

        // Collect terms from Happy Groups
        if (currentConfig?.happyGroups) {
            currentConfig.happyGroups.forEach((group: any) => {
                // Check if group is enabled (default true if undefined)
                if (group.enabled !== false) {
                    group.tags.forEach((tag: string) => {
                        if (tag && tag.trim()) termsToHighlight.add(tag.trim());
                    });
                }
            });
        }

        // Legacy Support
        if (currentConfig?.includeGroups) {
            currentConfig.includeGroups.forEach((group: any) => {
                group.forEach((tag: string) => {
                    if (tag && tag.trim()) termsToHighlight.add(tag.trim());
                });
            });
        }

        termsToHighlight.forEach(term => {
            const checkTerm = isCaseSensitive ? term : term.toLowerCase();
            // Only add auto-highlight if NO manual highlight exists for this term
            if (!validExistingKeywords.has(checkTerm)) {
                const color = stringToColor(term);
                autoHighlights.push({
                    id: `auto-${term}`,
                    keyword: term,
                    color: color,
                    lineEffect: false,
                    enabled: true // EXPLICITLY ENABLE
                });
            }
        });

        // Precedence: Manual Updates > Auto Generated
        // We put baseHighlights FIRST so find() returns manual highlight if both exist 
        // (though we try to filter duplicates, partial matches might still occur)
        return [...baseHighlights, ...autoHighlights];
    }, [currentConfig?.highlights, currentConfig?.happyGroups, currentConfig?.includeGroups, currentConfig?.colorHighlightsCaseSensitive, currentConfig?.happyCombosCaseSensitive]);
};
