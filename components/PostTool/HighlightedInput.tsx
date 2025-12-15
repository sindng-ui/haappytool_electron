import React, { useMemo } from 'react';
import { PostGlobalVariable } from '../../types';

interface HighlightedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value: string;
    variables: PostGlobalVariable[];
    className?: string; // Layout (internal), font, padding
    containerClassName?: string; // Layout (external) - e.g. flex-1, w-full
    textClassName?: string; // Color for normal text
}

export const HighlightedInput: React.FC<HighlightedInputProps> = ({ value, variables, className = '', containerClassName = '', textClassName = 'text-slate-800 dark:text-slate-200', onChange, ...props }) => {
    // We need to parse the value and highlight tokens
    const renderedContent = useMemo(() => {
        if (!value) return null;

        // Split by {{...}}
        const parts = value.split(/(\{\{[a-zA-Z0-9_\-]+\}\})/g);

        return parts.map((part, index) => {
            if (part.startsWith('{{') && part.endsWith('}}')) {
                const key = part.slice(2, -2);
                const isDefined = variables.some(v => v.key === key && v.enabled);

                if (isDefined) {
                    return (
                        <span key={index} className="text-orange-500 font-bold dark:text-orange-400">
                            {part}
                        </span>
                    );
                }
                // Undefined variable or disabled - maybe show red or just normal? 
                // Let's show it as a variable but maybe different color?
                return <span key={index} className="text-slate-400 dark:text-slate-500">{part}</span>;
            }
            return <span key={index}>{part}</span>;
        });
    }, [value, variables]);

    // Extract basic structural styles to apply to both layers
    // We assume className contains text sizing, font, padding.
    // We need to ensure text wrapping and alignment is identical.
    // Inputs are single line usually.

    return (
        <div className={`relative group ${props.disabled ? 'opacity-50' : ''} ${containerClassName}`} style={{ isolation: 'isolate' }}>
            {/* Render Layer - Behind */}
            <div
                aria-hidden="true"
                className={`w-full h-full ${className} absolute inset-0 text-transparent bg-transparent pointer-events-none whitespace-pre overflow-hidden flex items-center`} // align-items-center for input vertical alignment
                style={{ color: 'transparent' }}
            >
                {/* We need another inner div to hold the colored spans, inheriting font styles but overriding color */}
                <div className={`w-full ${textClassName}`}>
                    {renderedContent}
                </div>
            </div>

            {/* Input Layer - Front */}
            {/* We make the text transparent but caret visible */}
            <input
                {...props}
                value={value}
                onChange={onChange}
                className={`w-full h-full ${className} relative z-10 bg-transparent text-transparent caret-slate-800 dark:caret-white focus:outline-none`}
                style={{ color: 'transparent', backgroundColor: 'transparent' }} // Force transparency
            />
        </div>
    );
};
