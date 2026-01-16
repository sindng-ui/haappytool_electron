import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import { ToolId, LogRule, AppSettings, SavedRequest, RequestGroup, PostGlobalVariable, RequestHistoryItem } from './types';

import { mergeById } from './utils/settingsHelper';
import { SettingsModal } from './components/SettingsModal';
import { ALL_PLUGINS } from './plugins/registry';
import { HappyToolProvider, HappyToolContextType } from './contexts/HappyToolContext';
import { ToastProvider } from './contexts/ToastContext';
import { CommandProvider, useCommand } from './contexts/CommandContext';
import PluginContainer from './components/PluginContainer';
import CommandPalette from './components/CommandPalette/CommandPalette';
import * as Lucide from 'lucide-react';

const { Settings, Monitor, Terminal, Database, Code, Activity, Home, FileUp, FileDown } = Lucide;

// Component to register global commands (runs inside CommandProvider)
const CommandRegistrar: React.FC<{
  setActiveTool: (id: string) => void;
  setIsSettingsOpen: (open: boolean) => void;
  handleExport: () => void;
  handleImport: () => void;
}> = ({ setActiveTool, setIsSettingsOpen, handleExport, handleImport }) => {
  const { registerCommand, unregisterCommand } = useCommand();

  useEffect(() => {
    // Register Navigation Commands
    ALL_PLUGINS.forEach(plugin => {
      registerCommand({
        id: `nav-${plugin.id}`,
        title: `Go to ${plugin.name}`,
        section: 'Navigation',
        icon: plugin.icon ? <plugin.icon size={18} /> : <Activity size={18} />,
        action: () => setActiveTool(plugin.id),
        keywords: [plugin.name, 'nav', 'switch']
      });
    });

    // Register Global Settings Command
    registerCommand({
      id: 'global-settings',
      title: 'Open Settings',
      section: 'General',
      icon: <Settings size={18} />,
      action: () => setIsSettingsOpen(true),
      shortcut: 'Ctrl+,'
    });

    // Register Export Settings
    registerCommand({
      id: 'export-settings',
      title: 'Export Settings (Json)',
      section: 'General',
      icon: <FileUp size={18} />,
      action: handleExport
    });

    // Register Import Settings
    registerCommand({
      id: 'import-settings',
      title: 'Import Settings (Json)',
      section: 'General',
      icon: <FileDown size={18} />,
      action: handleImport
    });

    return () => {
      // Cleanup
      ALL_PLUGINS.forEach(plugin => unregisterCommand(`nav-${plugin.id}`));
      unregisterCommand('global-settings');
      unregisterCommand('export-settings');
      unregisterCommand('import-settings');
    };
  }, [registerCommand, unregisterCommand, setActiveTool, setIsSettingsOpen, handleExport, handleImport]);

  return null;
};

const AppContent: React.FC = () => {
  const [activeTool, setActiveTool] = useState<string>(ToolId.LOG_EXTRACTOR);

  // App-wide state (Settings)
  const [logRules, setLogRules] = useState<LogRule[]>([
    {
      id: '1',
      name: 'New Analysis',
      includeGroups: [['']],
      excludes: [],
      highlights: []
    }
  ]);
  const [lastApiUrl, setLastApiUrl] = useState('');
  const [lastMethod, setLastMethod] = useState('GET');
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>([]);
  const [savedRequestGroups, setSavedRequestGroups] = useState<RequestGroup[]>([]);
  const [requestHistory, setRequestHistory] = useState<RequestHistoryItem[]>([]);
  const [postGlobalVariables, setPostGlobalVariables] = useState<PostGlobalVariable[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  // Tool Order State - now generic strings
  const [toolOrder, setToolOrder] = useState<string[]>(
    ALL_PLUGINS.sort((a, b) => (a.order || 99) - (b.order || 99)).map(p => p.id)
  );

  // Plugin Management State
  const defaultEnabledPlugins = [
    ToolId.LOG_EXTRACTOR,
    ToolId.BLOCK_TEST,
    ToolId.JSON_TOOLS,
    ToolId.POST_TOOL,
    ToolId.TPK_EXTRACTOR
  ];

  const [enabledPlugins, setEnabledPlugins] = useState<string[]>(defaultEnabledPlugins);

  // Load settings on mount
  useEffect(() => {
    const saved = localStorage.getItem('devtool_suite_settings');
    const defaultRequest: SavedRequest = {
      id: 'default-st-devices',
      name: 'SmartThings Devices',
      method: 'GET',
      url: 'https://client.smartthings.com/v1/devices?includeAllowedActions=true&includeHealth=true&includeGroups=true&includeStatus=true',
      headers: [
        { key: 'Accept', value: 'application/json' },
        { key: 'Authorization', value: 'Bearer AccessTokenHere' }
      ],
      body: ''
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.logRules) {
          // Migration for legacy fields
          const migratedRules = parsed.logRules.map((r: any) => {
            let rule = { ...r };

            // Migrate legacy 'includes'
            if (rule.includes && !rule.includeGroups) {
              rule.includeGroups = Array.isArray(rule.includes)
                ? rule.includes.map((i: string) => [i])
                : [[]];
              delete rule.includes;
            }

            // Migrate missing 'highlights'
            if (!rule.highlights) {
              rule.highlights = [];
            }

            return rule;
          });
          setLogRules(migratedRules);
        }
        if (parsed.savedRequests && Array.isArray(parsed.savedRequests) && parsed.savedRequests.length > 0) {
          setSavedRequests(parsed.savedRequests);
        } else {
          // If missing OR empty array, force default item
          setSavedRequests([defaultRequest]);
        }
        if (parsed.savedRequestGroups && Array.isArray(parsed.savedRequestGroups)) {
          setSavedRequestGroups(parsed.savedRequestGroups);
        }
        if (parsed.requestHistory && Array.isArray(parsed.requestHistory)) {
          setRequestHistory(parsed.requestHistory);
        }
        if (parsed.postGlobalVariables && Array.isArray(parsed.postGlobalVariables)) {
          setPostGlobalVariables(parsed.postGlobalVariables);
        }
        if (parsed.lastEndpoint) setLastApiUrl(parsed.lastEndpoint);
        if (parsed.enabledPlugins) {
          setEnabledPlugins(parsed.enabledPlugins);
        }
      } catch (e) {
        console.error("Failed to load settings", e);
        // Fallback to default on error
        setSavedRequests([defaultRequest]);
      }
    } else {
      // First run ever
      setSavedRequests([defaultRequest]);
    }
    setIsSettingsLoaded(true);
  }, []);

  // Auto-save settings when changed
  useEffect(() => {
    if (!isSettingsLoaded) return;

    const settings: AppSettings = {
      logRules,
      savedRequests,
      savedRequestGroups,
      requestHistory,
      postGlobalVariables,
      lastEndpoint: lastApiUrl,
      lastMethod,
      enabledPlugins
    };
    localStorage.setItem('devtool_suite_settings', JSON.stringify(settings));
  }, [logRules, lastApiUrl, lastMethod, savedRequests, savedRequestGroups, requestHistory, postGlobalVariables, enabledPlugins]);

  const handleExportSettings = () => {
    const settings: AppSettings = {
      logRules,
      savedRequests,
      savedRequestGroups,
      postGlobalVariables,
      lastEndpoint: lastApiUrl,
      lastMethod,
      enabledPlugins,
      blocks: JSON.parse(localStorage.getItem('happytool_blocks') || '[]'),
      pipelines: JSON.parse(localStorage.getItem('happytool_pipelines') || '[]')
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'happytool_settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = (settings: AppSettings) => {
    if (settings.logRules) {
      // Migration for imported legacy rules
      const migratedRules = settings.logRules.map((r: any) => {
        let rule = { ...r };
        if (rule.includes && !rule.includeGroups) {
          rule.includeGroups = Array.isArray(rule.includes) ? rule.includes.map((i: string) => [i]) : [[]];
          delete rule.includes;
        }
        if (!rule.highlights) {
          rule.highlights = [];
        }
        return rule;
      });

      setLogRules(current => mergeById(current, migratedRules));
    }

    if (settings.savedRequests) {
      setSavedRequests(current => mergeById(current, settings.savedRequests));
    }

    if (settings.savedRequestGroups) {
      const groups = settings.savedRequestGroups;
      setSavedRequestGroups(current => mergeById(current, groups));
    }

    if (settings.requestHistory) {
      // For history, maybe we merge or overwrite? Let's just prepend new history or merge by ID if they had one? 
      // History items usually have unique IDs generated execution time?
      // For now, let's just REPLACE history or Append? MergeById is safer.
      setRequestHistory(current => mergeById(current, settings.requestHistory!));
    }

    if (settings.postGlobalVariables) {
      setPostGlobalVariables(current => mergeById(current, settings.postGlobalVariables!));
    }

    if (settings.lastEndpoint) setLastApiUrl(settings.lastEndpoint);
    if (settings.lastMethod) setLastMethod(settings.lastMethod);
    if (settings.enabledPlugins) setEnabledPlugins(settings.enabledPlugins);

    // Import BlockTest Data
    if (settings.blocks) {
      localStorage.setItem('happytool_blocks', JSON.stringify(settings.blocks));
    }
    if (settings.pipelines) {
      localStorage.setItem('happytool_pipelines', JSON.stringify(settings.pipelines));
    }

    // Notify plugins to reload from localStorage
    window.dispatchEvent(new Event('happytool:settings-imported'));
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const onImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const settings = JSON.parse(content);
        handleImportSettings(settings);
        // useToast isn't directly available here unless we move AppContent logic deeper or assume ToastProvider wraps this.
        // Since AppContent is inside ToastProvider, we can use useToast if we hook it.
        // But AppContent is a component, so we can add 'const { addToast } = useToast()' to it.
      } catch (err) {
        console.error('Failed to parse settings file', err);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  const contextValue: HappyToolContextType = React.useMemo(() => ({
    logRules,
    setLogRules,
    savedRequests,
    setSavedRequests,
    savedRequestGroups,
    setSavedRequestGroups,
    requestHistory,
    setRequestHistory,
    postGlobalVariables,
    setPostGlobalVariables,
    handleExportSettings,
    handleImportSettings
  }), [
    logRules,
    savedRequests,
    savedRequestGroups,
    postGlobalVariables,
    lastApiUrl,
    lastMethod,
    requestHistory
  ]);


  return (
    <HappyToolProvider value={contextValue}>
      <CommandRegistrar
        setActiveTool={setActiveTool}
        setIsSettingsOpen={setIsSettingsOpen}
        handleExport={handleExportSettings}
        handleImport={handleImportClick}
      />

      {/* Hidden Import Input for Command Palette */}
      <input
        type="file"
        ref={importInputRef}
        className="hidden"
        accept=".json"
        onChange={onImportFileChange}
      />

      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0B0F19] font-sans text-slate-900 dark:text-slate-200 transition-colors duration-300">
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            activePluginId={activeTool}
            onSelectPlugin={setActiveTool}
            pluginOrder={toolOrder}
            onReorderPlugins={setToolOrder}
            onOpenSettings={() => setIsSettingsOpen(true)}
            plugins={ALL_PLUGINS}
            enabledPlugins={enabledPlugins}
          />

          <main className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-slate-950 min-h-0 transition-colors duration-300">
            {!isSettingsLoaded ? (
              <div className="flex h-full items-center justify-center text-slate-500">Loading settings...</div>
            ) : (
              <>
                {ALL_PLUGINS.map(plugin => (
                  <PluginContainer
                    key={plugin.id}
                    plugin={plugin}
                    isActive={activeTool === plugin.id}
                  />
                ))}
              </>
            )}
            <SettingsModal
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              currentStartLineIndex={0}
              enabledPlugins={enabledPlugins}
              setEnabledPlugins={setEnabledPlugins}
            />
            <CommandPalette />
          </main>
        </div>
      </div>
    </HappyToolProvider>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <CommandProvider>
        <AppContent />
      </CommandProvider>
    </ToastProvider>
  );
};

export default App;