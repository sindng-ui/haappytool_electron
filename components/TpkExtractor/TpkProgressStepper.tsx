import React from 'react';
import * as Lucide from 'lucide-react';

const { CheckCircle } = Lucide;

interface Step {
    id: number;
    label: string;
}

interface TpkProgressStepperProps {
    currentStep: number;
    steps?: Step[];
}

const DEFAULT_STEPS: Step[] = [
    { id: 1, label: 'Upload' },
    { id: 2, label: 'Analyze' },
    { id: 3, label: 'Unpack RPM' },
    { id: 4, label: 'Expand CPIO' },
    { id: 5, label: 'Extract TPK' }
];

export const TpkProgressStepper: React.FC<TpkProgressStepperProps> = ({ currentStep, steps = DEFAULT_STEPS }) => {
    return (
        <div className="flex justify-between items-center mb-10 relative">
            {/* Connector Line */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 dark:bg-slate-800 -z-10 rounded-full">
                <div
                    className="h-full bg-orange-600 transition-all duration-700 rounded-full shadow-[0_0_10px_rgba(234,88,12,0.5)]"
                    style={{ width: `${((Math.max(currentStep, 1) - 1) / (steps.length - 1)) * 100}%` }}
                ></div>
            </div>

            {steps.map((step) => {
                const isCompleted = currentStep > step.id;
                const isCurrent = currentStep === step.id;
                return (
                    <div key={step.id} className="flex flex-col items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-500
                        ${isCompleted || isCurrent ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-500/30' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600'}
                        ${isCurrent ? 'ring-4 ring-orange-500/20 scale-110' : ''}
                    `}>
                            {isCompleted ? <CheckCircle size={14} /> : step.id}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent ? 'text-orange-600 dark:text-orange-500' : 'text-slate-400 dark:text-slate-600'}`}>
                            {step.label}
                        </span>
                    </div>
                )
            })}
        </div>
    );
};
