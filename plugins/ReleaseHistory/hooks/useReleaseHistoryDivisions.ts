import { useState, useMemo, useEffect } from 'react';
import { ReleaseItem, YearConfig, DivisionData, ReleaseHistoryData } from '../types';

const STORAGE_KEY = 'happytool_release_history';

export const useReleaseHistoryDivisions = (
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void
) => {
    const [divisions, setDivisions] = useState<Record<string, DivisionData>>({
        'Default': { items: [], yearConfigs: {} }
    });
    const [activeDivision, setActiveDivision] = useState<string>('Default');

    // Load and Migrate data
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);

                // 1. If multiple divisions structure already exists
                if (parsed && parsed.divisions && parsed.activeDivision) {
                    setDivisions(parsed.divisions);
                    setActiveDivision(parsed.activeDivision);
                    return;
                }

                // 2. Fallback to legacy single set structure and migrate
                let loadedItems: any[] = [];
                let loadedConfigs: Record<number, YearConfig> = {};

                if (Array.isArray(parsed)) {
                    loadedItems = parsed;
                } else if (parsed && parsed.items) {
                    loadedItems = parsed.items;
                    loadedConfigs = parsed.yearConfigs || {};
                }

                const migratedItems: ReleaseItem[] = loadedItems.map((item: any) => {
                    const releaseName = item.releaseName || item.appName || 'Unknown';
                    let years = item.years;
                    if (!years) {
                        // Migration from productName
                        if (item.productName && /^\d{4}$/.test(item.productName)) {
                            years = [parseInt(item.productName)];
                        } else {
                            // Fallback to year of releaseDate
                            years = [new Date(item.releaseDate).getFullYear()];
                        }
                    }
                    return { ...item, releaseName, years };
                });

                const initialDivisions: Record<string, DivisionData> = {
                    'Default': {
                        items: migratedItems,
                        yearConfigs: loadedConfigs
                    }
                };

                setDivisions(initialDivisions);
                setActiveDivision('Default');
            } catch (e) {
                console.error('Failed to parse stored release history', e);
            }
        }
    }, []);

    // Save to local storage whenever divisions or activeDivision change
    useEffect(() => {
        if (Object.keys(divisions).length > 0) {
            const data: ReleaseHistoryData = { divisions, activeDivision };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
    }, [divisions, activeDivision]);

    // Active division dataset
    const activeDivisionData = useMemo(() => {
        return divisions[activeDivision] || { items: [], yearConfigs: {} };
    }, [divisions, activeDivision]);

    const items = activeDivisionData.items;
    const yearConfigs = activeDivisionData.yearConfigs;

    const updateActiveDivisionItems = (
        newItemsOrFn: ReleaseItem[] | ((prev: ReleaseItem[]) => ReleaseItem[])
    ) => {
        setDivisions((prev) => {
            const currentData = prev[activeDivision] || { items: [], yearConfigs: {} };
            const updatedItems =
                typeof newItemsOrFn === 'function' ? newItemsOrFn(currentData.items) : newItemsOrFn;
            return {
                ...prev,
                [activeDivision]: {
                    ...currentData,
                    items: updatedItems
                }
            };
        });
    };

    const updateActiveDivisionYearConfigs = (
        newConfigsOrFn: Record<number, YearConfig> | ((prev: Record<number, YearConfig>) => Record<number, YearConfig>)
    ) => {
        setDivisions((prev) => {
            const currentData = prev[activeDivision] || { items: [], yearConfigs: {} };
            const updatedConfigs =
                typeof newConfigsOrFn === 'function'
                    ? newConfigsOrFn(currentData.yearConfigs)
                    : newConfigsOrFn;
            return {
                ...prev,
                [activeDivision]: {
                    ...currentData,
                    yearConfigs: updatedConfigs
                }
            };
        });
    };

    const handleAddDivision = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        if (divisions[trimmed]) {
            showToast('Division name already exists.', 'error');
            return;
        }
        setDivisions((prev) => ({
            ...prev,
            [trimmed]: { items: [], yearConfigs: {} }
        }));
        setActiveDivision(trimmed);
        showToast(`Division "${trimmed}" added.`, 'success');
    };

    const handleDeleteDivision = (divToDelete: string) => {
        if (divToDelete === 'Default') return;

        setDivisions((prev) => {
            const copy = { ...prev };
            delete copy[divToDelete];
            return copy;
        });

        if (activeDivision === divToDelete) {
            setActiveDivision('Default');
        }

        showToast(`Division "${divToDelete}" deleted.`, 'success');
    };

    return {
        divisions,
        activeDivision,
        items,
        yearConfigs,
        setActiveDivision,
        updateActiveDivisionItems,
        updateActiveDivisionYearConfigs,
        handleAddDivision,
        handleDeleteDivision
    };
};
