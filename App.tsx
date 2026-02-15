import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import { ToolId, LogRule, AppSettings, SavedRequest, RequestGroup, PostGlobalVariable, RequestHistoryItem, PostGlobalAuth, EnvironmentProfile } from './types';

import { mergeById } from './utils/settingsHelper';
import { SettingsModal } from './components/SettingsModal';
import { ALL_PLUGINS } from './plugins/registry';
import { HappyToolProvider, HappyToolContextType } from './contexts/HappyToolContext';
import { ToastProvider, useToast, ToastItem } from './contexts/ToastContext';
import { CommandProvider, useCommand } from './contexts/CommandContext';
import { LogArchiveProvider, LogArchive, useLogArchiveContext } from './components/LogArchive';
import PluginContainer from './components/PluginContainer';
import CommandPalette from './components/CommandPalette/CommandPalette';
import LoadingSplash from './components/LoadingSplash';
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
  const { openSidebar } = useLogArchiveContext();

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

    // Register Log Archive Command
    registerCommand({
      id: 'open-log-archive',
      title: 'Open Log Archive',
      section: 'Tools',
      icon: <Lucide.Archive size={18} />,
      action: openSidebar,
      shortcut: 'Ctrl+Shift+A'
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
      unregisterCommand('open-log-archive');
    };
  }, [registerCommand, unregisterCommand, setActiveTool, setIsSettingsOpen, handleExport, handleImport, openSidebar]);

  return null;
};

const AppContent: React.FC = () => {
  const [activeTool, setActiveTool] = useState<string>(ToolId.LOG_EXTRACTOR);
  // Toast Integration
  const { toasts, removeToast } = useToast();

  // Loading States
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [isInitialPluginReady, setIsInitialPluginReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

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

  // Environment Profiles State
  const [envProfiles, setEnvProfiles] = useState<EnvironmentProfile[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string>('default');

  // Derived state for legacy compatibility
  // We don't use a simple useState for variables anymore, we derive it from profiles
  // HOWEVER, context expects [vars, setVars]. 
  // So we'll use a wrapper. But wait, `setPostGlobalVariables` is passed to context.

  const [postGlobalAuth, setPostGlobalAuth] = useState<PostGlobalAuth>({ enabled: true, type: 'none' });
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

  // Focus Mode State (F11)
  const [isFocusMode, setIsFocusMode] = useState(false);
  const toggleFocusMode = React.useCallback(() => setIsFocusMode(prev => !prev), []);

  // Reactive Ambient Mood
  const [ambientMood, setAmbientMood] = useState<'idle' | 'working' | 'error' | 'success'>('idle');

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
        if (parsed.requestHistory) setRequestHistory(parsed.requestHistory);

        // Profiles Migration / Loading
        if (parsed.envProfiles && parsed.envProfiles.length > 0) {
          setEnvProfiles(parsed.envProfiles);
          setActiveEnvId(parsed.activeEnvId || parsed.envProfiles[0].id);
        } else {
          // Migration: Create Default Profile from existing variables
          const initialVars = (parsed.postGlobalVariables && Array.isArray(parsed.postGlobalVariables)) ? parsed.postGlobalVariables : [];
          const defaultProfile: EnvironmentProfile = {
            id: 'default',
            name: 'Default Environment',
            variables: initialVars
          };
          setEnvProfiles([defaultProfile]);
          setActiveEnvId('default');
        }

        if (parsed.postGlobalAuth) {
          setPostGlobalAuth(parsed.postGlobalAuth);
        }
        if (parsed.lastEndpoint) setLastApiUrl(parsed.lastEndpoint);

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

  // ✅ Performance: Auto-save settings with debounce to reduce I/O
  useEffect(() => {
    if (!isSettingsLoaded) return;

    // 1-second debounce to prevent excessive writes
    const timer = setTimeout(() => {
      const settings: AppSettings = {
        logRules,
        savedRequests,
        savedRequestGroups,
        requestHistory,
        envProfiles,
        activeEnvId,
        postGlobalAuth,
        lastEndpoint: lastApiUrl,
        lastMethod,
        enabledPlugins
      };

      try {
        localStorage.setItem('devtool_suite_settings', JSON.stringify(settings));
        // console.log('[App] Settings auto-saved to localStorage');
      } catch (e) {
        console.error('[App] Failed to save settings:', e);
      }
    }, 1000); // ✅ 1-second debounce

    return () => clearTimeout(timer);
  }, [logRules, lastApiUrl, lastMethod, savedRequests, savedRequestGroups, requestHistory, envProfiles, activeEnvId, postGlobalAuth, enabledPlugins]);

  // ✅ Performance: Memoize export/import handlers
  const handleExportSettings = React.useCallback(() => {
    const settings: AppSettings = {
      logRules,
      savedRequests,
      savedRequestGroups,
      envProfiles,
      activeEnvId,
      postGlobalAuth,
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
  }, [logRules, savedRequests, savedRequestGroups, envProfiles, activeEnvId, postGlobalAuth, lastApiUrl, lastMethod, enabledPlugins]);

  const handleImportSettings = React.useCallback((settings: AppSettings) => {
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

    if (settings.envProfiles) {
      setEnvProfiles(settings.envProfiles);
      if (settings.activeEnvId) setActiveEnvId(settings.activeEnvId);
    } else if (settings.postGlobalVariables) {
      // Fallback import for legacy settings that only have postGlobalVariables
      const newVars = settings.postGlobalVariables;
      setEnvProfiles(prev => {
        const active = prev.find(p => p.id === activeEnvId);
        if (active) {
          // Merge into the active profile's variables
          return prev.map(p => p.id === activeEnvId ? { ...p, variables: mergeById(p.variables, newVars) } : p);
        }
        // If no active profile found (e.g., first import), create a default one
        return [{ id: 'default', name: 'Default', variables: newVars }];
      });
    }

    if (settings.postGlobalAuth) {
      setPostGlobalAuth(settings.postGlobalAuth);
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
  }, [activeEnvId]); // ✅ Only depends on activeEnvId (setters are stable)

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

  // ✅ Performance: Separate memoization for derived values
  const postGlobalVariables = React.useMemo(() =>
    envProfiles.find(p => p.id === activeEnvId)?.variables || []
    , [envProfiles, activeEnvId]);

  const setPostGlobalVariables = React.useCallback((action: any) => {
    setEnvProfiles(currentProfiles => {
      const activeIdx = currentProfiles.findIndex(p => p.id === activeEnvId);
      if (activeIdx === -1) return currentProfiles;

      const activeProfile = currentProfiles[activeIdx];
      const newVars = typeof action === 'function'
        ? (action as (prev: PostGlobalVariable[]) => PostGlobalVariable[])(activeProfile.variables)
        : action;

      const newProfiles = [...currentProfiles];
      newProfiles[activeIdx] = { ...activeProfile, variables: newVars };
      return newProfiles;
    });
  }, [activeEnvId]); // ✅ Only depend on activeEnvId, not envProfiles

  const contextValue: HappyToolContextType = React.useMemo(() => ({
    logRules,
    setLogRules,
    savedRequests,
    setSavedRequests,
    savedRequestGroups,
    setSavedRequestGroups,
    requestHistory,
    setRequestHistory,
    postGlobalVariables, // ✅ Already memoized
    setPostGlobalVariables, // ✅ Stable callback
    envProfiles,
    setEnvProfiles,
    activeEnvId,
    setActiveEnvId,
    postGlobalAuth,
    setPostGlobalAuth,
    handleExportSettings,
    handleImportSettings,
    isFocusMode,
    toggleFocusMode,
    ambientMood,
    setAmbientMood
  }), [
    logRules,
    savedRequests,
    savedRequestGroups,
    requestHistory,
    postGlobalVariables, // ✅ Now stable
    setPostGlobalVariables, // ✅ Now stable
    envProfiles,
    setEnvProfiles,
    activeEnvId,
    setActiveEnvId,
    postGlobalAuth,
    isFocusMode,
    toggleFocusMode
    // ✅ Removed duplicates: requestHistory, lastApiUrl, lastMethod
  ]);

  // ✅ Performance: Use transition for tab switching to prevent UI blocking
  const [isPending, startTransition] = React.useTransition();

  const handleSetActiveTool = React.useCallback((id: string) => {
    startTransition(() => {
      setActiveTool(id);
    });
  }, []);

  // Loading complete handler (Backend)
  const handleBackendLoadingComplete = () => {
    setIsBackendReady(true);
  };

  // Plugin loaded handler
  const handlePluginLoaded = React.useCallback(() => {
    setIsInitialPluginReady(true);
  }, []);

  // Detect page reload and skip splash screen
  useEffect(() => {
    // In web environment (dev mode without Electron), skip splash immediately
    if (process.env.NODE_ENV === 'development' && !window.electronAPI) {
      setShowSplash(false);
      return;
    }

    // Detect if this is a page reload (not initial load)
    // In Electron, page reload happens when user presses Ctrl+R or Ctrl+Shift+R
    if (window.performance) {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const isReload = navEntries.length > 0 && navEntries[0].type === 'reload';

      if (isReload && window.electronAPI) {
        // This is a page reload in Electron - backend is already ready, skip splash
        console.log('[App] Page reload detected, skipping splash screen');
        setShowSplash(false);
        setIsBackendReady(true);
        setIsInitialPluginReady(true);
        return;
      }
    }

    // Listen for backend loading complete (for initial app launch)
    window.electronAPI?.on('loading-complete', handleBackendLoadingComplete);

    return () => {
      window.electronAPI?.off('loading-complete', handleBackendLoadingComplete);
    };
  }, []);

  // Safety timer for plugin loading (5s)
  useEffect(() => {
    if (isBackendReady && !isInitialPluginReady) {
      const timer = setTimeout(() => {
        console.warn('Plugin loading timed out, forcing ready');
        setIsInitialPluginReady(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isBackendReady, isInitialPluginReady]);

  // When Splash says it's done (fade out finished)
  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  // Global Shortcut Prevention (Ctrl+W)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+W (Close Window) and Ctrl+T (New Tab) defaults
      if ((e.ctrlKey || e.metaKey) && (e.key === 'w' || e.key === 'W' || e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        // Do not stop propagation, so other components (LogExtractor) can handle it
        console.log(`[App] Parsed Ctrl+${e.key} - Preventing default behavior`);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);

  // Focus Mode Shortcut (F11)
  useEffect(() => {
    const handleFocusModeKey = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        const nextState = !isFocusMode;
        setIsFocusMode(nextState);
        if (window.electronAPI?.toggleFullscreen) {
          window.electronAPI.toggleFullscreen(nextState);
        }
      }
    };
    window.addEventListener('keydown', handleFocusModeKey);
    return () => window.removeEventListener('keydown', handleFocusModeKey);
  }, [isFocusMode]);

  return (
    <HappyToolProvider value={contextValue}>
      <CommandRegistrar
        setActiveTool={handleSetActiveTool}
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

      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0B0F19] font-sans text-slate-900 dark:text-slate-200 transition-colors duration-300 relative">
        <div className="flex-1 flex overflow-hidden z-10 relative">
          <div className={`sidebar-transition relative z-[100] ${isFocusMode ? 'sidebar-hidden w-0 opacity-0 -ml-14' : 'w-14 opacity-100'}`}>
            <Sidebar
              activePluginId={activeTool}
              onSelectPlugin={handleSetActiveTool}
              pluginOrder={toolOrder}
              onReorderPlugins={setToolOrder}
              onOpenSettings={() => setIsSettingsOpen(true)}
              plugins={ALL_PLUGINS}
              enabledPlugins={enabledPlugins}
            />
          </div>

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
                    onLoaded={activeTool === plugin.id ? handlePluginLoaded : undefined}
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
            {/* Log Archive - Global feature available across all plugins */}
            <LogArchive />
          </main>
        </div>
        {/* Splash Overlay - Always rendered until complete to allow plugins to load underneath */}
        {showSplash && (
          <LoadingSplash
            onLoadingComplete={handleSplashComplete}
            waitForPlugins={!isInitialPluginReady}
          />
        )}

        {/* Toast Container - Explicitly Rendered in App Root */}
        <div className="fixed bottom-6 right-6 z-[999999] flex flex-col gap-3 pointer-events-none">
          <div className="flex flex-col gap-3 items-end pointer-events-auto">
            {toasts.map(toast => (
              <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
            ))}
          </div>
        </div>
      </div>
    </HappyToolProvider>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <CommandProvider>
        <LogArchiveProvider>
          <AppContent />
        </LogArchiveProvider>
      </CommandProvider>
    </ToastProvider>
  );
};

export default App;