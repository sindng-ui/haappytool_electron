import React, { useState } from 'react';
import { Plus, Trash2, Smartphone, Loader2 } from 'lucide-react';
import { SmartThingsService } from './services/smartThingsService';
import { STLocation } from './types';

interface VirtualDeviceManagerProps {
    service: SmartThingsService;
    locations: STLocation[];
    onRefresh: () => void;
}

export const VirtualDeviceManager: React.FC<VirtualDeviceManagerProps> = ({ service, locations, onRefresh }) => {
    const [name, setName] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!name || !selectedLocation) return;
        setCreating(true);
        setError(null);
        try {
            await service.createVirtualDevice({
                name,
                locationId: selectedLocation,
                ownerId: 'me' // API handles this usually or requires specific ID
            });
            setName('');
            onRefresh();
            alert('Virtual Device Created!');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-full">
            <div className="flex items-center gap-2 text-slate-500 font-bold uppercase text-xs tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                <Smartphone size={14} />
                Virtual Device Manager
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Device Label</label>
                    <input
                        type="text"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                        placeholder="My Virtual Light"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Target Location</label>
                    <select
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                        value={selectedLocation}
                        onChange={e => setSelectedLocation(e.target.value)}
                    >
                        <option value="">Select Location...</option>
                        {locations.map(loc => (
                            <option key={loc.locationId} value={loc.locationId}>{loc.name}</option>
                        ))}
                    </select>
                </div>

                {error && (
                    <div className="p-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-900/30">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleCreate}
                    disabled={creating || !name || !selectedLocation}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white rounded-lg flex items-center justify-center gap-2 font-bold transition-colors"
                >
                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Create Virtual Device
                </button>
            </div>

            <div className="mt-auto p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg">
                <h4 className="text-xs font-bold text-amber-700 dark:text-amber-500 mb-1 flex items-center gap-1">
                    💡 Tip
                </h4>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                    가상 장치는 실제 하드웨어 없이 루틴 테스팅이나 클라우드 자동화 로직을 디버깅할 때 유용합니다. 생성 후 SmartThings 앱에서도 확인 가능합니다.
                </p>
            </div>
        </div>
    );
};
