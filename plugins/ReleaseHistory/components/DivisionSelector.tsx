import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, ChevronDown, Plus, Trash2 } from 'lucide-react';

interface DivisionSelectorProps {
    divisions: string[];
    activeDivision: string;
    onSelect: (division: string) => void;
    onAddClick: () => void;
    onDeleteClick: (division: string) => void;
}

const DivisionSelector: React.FC<DivisionSelectorProps> = ({
    divisions,
    activeDivision,
    onSelect,
    onAddClick,
    onDeleteClick
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative flex items-center space-x-2" ref={dropdownRef}>
            {/* Main Selector Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                data-testid="division-selector-trigger"
                className="h-10 w-44 px-4 rounded-xl text-xs font-black text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all flex items-center justify-between border border-white/5 active:scale-95"
            >
                <div className="flex items-center gap-2 truncate flex-1 mr-2">
                    <Layers size={14} className="text-indigo-400 flex-shrink-0" />
                    <span data-testid="active-division-text" className="truncate">{activeDivision}</span>
                </div>
                <ChevronDown 
                    size={12} 
                    className={`text-slate-500 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
                />
            </button>

            {/* Quick Add Button */}
            <button
                onClick={onAddClick}
                className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 active:scale-95"
                title="Add New Division"
            >
                <Plus size={16} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-2 w-44 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-[100] overflow-hidden"
                    >
                        <div className="p-1.5 max-h-60 overflow-y-auto">
                            {divisions.map((div) => {
                                const isActive = div === activeDivision;
                                return (
                                    <div
                                        key={div}
                                        className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-all ${
                                            isActive
                                                ? 'bg-indigo-600/20 text-indigo-200 font-black border border-indigo-500/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                        }`}
                                    >
                                        <button
                                            onClick={() => {
                                                onSelect(div);
                                                setIsOpen(false);
                                            }}
                                            data-testid={`division-option-${div}`}
                                            className="flex-1 text-left truncate mr-2"
                                        >
                                            {div}
                                        </button>
                                        
                                        {/* Don't allow deleting 'Default' division */}
                                        {div !== 'Default' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteClick(div);
                                                }}
                                                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-all active:scale-90 flex-shrink-0"
                                                title={`Delete ${div}`}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DivisionSelector;
