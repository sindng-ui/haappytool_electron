import React from 'react';
import { LogViewPreferences, LogLevelStyle, LogLevel } from '../../types';

interface ViewSettingsSectionProps {
    preferences: LogViewPreferences;
    onUpdate: (updates: Partial<LogViewPreferences>) => void;
}

export const ViewSettingsSection: React.FC<ViewSettingsSectionProps> = ({ preferences, onUpdate }) => {

    const handleLevelToggle = (level: LogLevel) => {
        const newStyles = preferences.levelStyles.map(s =>
            s.level === level ? { ...s, enabled: !s.enabled } : s
        );
        onUpdate({ levelStyles: newStyles });
    };

    const handleColorChange = (level: LogLevel, color: string) => {
        const newStyles = preferences.levelStyles.map(s =>
            s.level === level ? { ...s, color } : s
        );
        onUpdate({ levelStyles: newStyles });
    };

    const handleRowHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 10 && val <= 100) {
            onUpdate({ rowHeight: val });
        }
    };

    const levels: LogLevel[] = ['V', 'D', 'I', 'W', 'E'];

    return (
        <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">View Settings</h3>

            {/* Row Height Control */}
            <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300">Line Spacing (px)</label>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="16"
                        max="60"
                        value={preferences.rowHeight}
                        onChange={handleRowHeightChange}
                        className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-xs text-slate-400 font-mono w-6 text-right">{preferences.rowHeight}</span>
                </div>
            </div>

            {/* Log Level Colors */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-sm text-slate-300 block mb-2">Log Level Colors</label>
                <div className="space-y-1.5">
                    {levels.map(level => {
                        const style = preferences.levelStyles.find(s => s.level === level) || { level, color: '#000000', enabled: false };
                        return (
                            <div key={level} className="flex items-center justify-between bg-slate-800/50 p-1.5 rounded border border-slate-700/50 hover:bg-slate-800 transition-colors">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={style.enabled}
                                        onChange={() => handleLevelToggle(level)}
                                        className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-offset-slate-900 focus:ring-indigo-500/50"
                                    />
                                    <span className={`text-xs font-bold font-mono w-4 text-center ${style.enabled ? 'text-slate-200' : 'text-slate-500'}`}>
                                        {level}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={style.color}
                                        disabled={!style.enabled}
                                        onChange={(e) => handleColorChange(level, e.target.value)}
                                        className={`w-6 h-6 rounded cursor-pointer border-none bg-transparent p-0 transition-opacity ${style.enabled ? 'opacity-100' : 'opacity-30'}`}
                                        title={style.enabled ? 'Change Color' : 'Enable to change color'}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
