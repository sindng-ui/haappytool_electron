export const THEME = {
    layout: {
        main: "bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200",
        border: "border-slate-200 dark:border-slate-800"
    },
    header: {
        container: "bg-[#0f172a] border-b border-indigo-500/30",
        tab: {
            active: "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300",
            inactive: "bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
        },
        newPipelineBtn: "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
    },
    subHeader: {
        container: "bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800",
        dropdown: "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 focus:ring-indigo-500",
        deleteBtn: "text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
    },
    sidebar: { // BlockManager
        container: "bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800",
        header: "bg-slate-50/50 dark:bg-slate-900/50",
        text: "text-slate-800 dark:text-slate-200",
        search: {
            container: "border-b border-slate-200/50 dark:border-slate-800/50",
            input: "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-indigo-500/50"
        },
        category: {
            header: "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            count: "bg-slate-200 dark:bg-slate-800 text-slate-400"
        },
        item: {
            special: "bg-violet-50/50 dark:bg-violet-900/20 hover:bg-violet-50 dark:hover:bg-violet-900/40 border-violet-100 dark:border-violet-800 hover:border-violet-400 dark:hover:border-violet-500 text-slate-700 dark:text-slate-200",
            predefined: "bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-700 dark:text-slate-200",
            custom: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-slate-800 dark:text-slate-200"
        }
    },
    editor: { // PipelineEditor
        container: "bg-slate-950 text-slate-200",
        header: "bg-slate-950 border-b border-indigo-500/30 shadow-md", // Changed to slate-50/950 to match other headers or should it be independent? 
        // Note: PipelineEditor header was "bg-slate-50 dark:bg-slate-950" in last edit.
        canvas: {
            bg: "bg-[#0B0F19]",
            dots: "bg-[radial-gradient(#1f2937_1px,transparent_1px)]"
        },
        controls: "bg-slate-50 dark:bg-slate-950 border-slate-700 text-slate-400",
        node: {
            start: "bg-slate-800 border-green-500/50",
            end: "bg-slate-900 border-slate-700",
            base: "backdrop-blur-md shadow-xl",
            selected: "ring-2 ring-orange-500 ring-offset-2 ring-offset-[#0B0F19] bg-indigo-900/90 border-indigo-400",
            predefined: "bg-slate-800/90 border-slate-600 shadow-slate-900/50",
            special: "bg-violet-950/40 border-violet-500/30 shadow-violet-900/40",
            custom: "bg-indigo-950/90 border-indigo-500/50 shadow-indigo-900/40",
            loop: "border-orange-500/40 bg-orange-950/20",
            loopSelected: "border-orange-500 bg-orange-900/30 ring-2 ring-orange-500 ring-offset-2 ring-offset-[#0B0F19]"
        }
    },
    runner: {
        container: "bg-slate-950",
        header: "bg-[#0f172a] border-b border-indigo-500/30",
        visual: "bg-slate-950 border-r border-indigo-500/30",
        logs: "bg-black text-green-400",
        item: {
            active: "bg-white dark:bg-slate-800 border-indigo-500 shadow-lg",
            completed: "bg-slate-50 dark:bg-slate-900 border-green-200 dark:border-green-900/30",
            pending: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60"
        }
    }
};
