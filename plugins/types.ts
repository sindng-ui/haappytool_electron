import React from 'react';

export interface PluginContext {
    // Configurable context passed to plugins on init
    uniqueId: string;
}

export interface HappyPlugin {
    id: string;             // Unique ID (e.g., 'com.happytool.log-extractor')
    name: string;           // Display Name (e.g., 'Log Extractor')
    icon: React.ComponentType<{ className?: string; size?: number }>; // Icon for Sidebar
    component: React.ComponentType<any>; // Main Content Component
    order?: number;         // Default sort order

    // Optional: Hooks for global level interactions
    onInit?: (context: PluginContext) => void;
}
