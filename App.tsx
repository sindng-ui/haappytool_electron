import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import LogExtractor from './components/LogExtractor';
import PostTool from './components/PostTool';
import TpkExtractor from './components/TpkExtractor';
import JsonTools from './components/JsonTools';
import SmartThingsDevicesPane from './components/SmartThingsDevices/SmartThingsDevicesPane';
import ReverseEngineer from './components/ReverseEngineer';
import { ToolId, LogRule, AppSettings, SavedRequest, RequestGroup, PostGlobalVariable } from './types';
import { mergeById } from './utils/settingsHelper';
import { SettingsModal } from './components/SettingsModal';
import { ALL_PLUGINS } from './plugins/registry';

const App: React.FC = () => {
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
  const [postGlobalVariables, setPostGlobalVariables] = useState<PostGlobalVariable[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Tool Order State - now generic strings
  const [toolOrder, setToolOrder] = useState<string[]>(
    ALL_PLUGINS.sort((a, b) => (a.order || 99) - (b.order || 99)).map(p => p.id)
  );

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
        if (parsed.postGlobalVariables && Array.isArray(parsed.postGlobalVariables)) {
          setPostGlobalVariables(parsed.postGlobalVariables);
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

  // Auto-save settings when changed
  useEffect(() => {
    if (!isSettingsLoaded) return;

    const settings: AppSettings = {
      logRules,
      savedRequests,
      savedRequestGroups,
      postGlobalVariables,
      lastEndpoint: lastApiUrl,
      lastMethod
    };
    localStorage.setItem('devtool_suite_settings', JSON.stringify(settings));
  }, [logRules, lastApiUrl, lastMethod, savedRequests, savedRequestGroups, postGlobalVariables]);

  const handleExportSettings = () => {
    const settings: AppSettings = {
      logRules,
      savedRequests,
      savedRequestGroups,
      postGlobalVariables,
      lastEndpoint: lastApiUrl,
      lastMethod
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

    if (settings.postGlobalVariables) {
      setPostGlobalVariables(current => mergeById(current, settings.postGlobalVariables!));
    }

    if (settings.lastEndpoint) setLastApiUrl(settings.lastEndpoint);
    if (settings.lastMethod) setLastMethod(settings.lastMethod);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e293b] font-sans text-slate-900 dark:text-slate-200 transition-colors duration-300">
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activePluginId={activeTool}
          onSelectPlugin={setActiveTool}
          pluginOrder={toolOrder}
          onReorderPlugins={setToolOrder}
          onOpenSettings={() => setIsSettingsOpen(true)}
          plugins={ALL_PLUGINS}
        />

        <main className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-slate-950 min-h-0 transition-colors duration-300">
          {!isSettingsLoaded ? (
            <div className="flex h-full items-center justify-center text-slate-500">Loading settings...</div>
          ) : (
            <>
              <div className={activeTool === ToolId.LOG_EXTRACTOR ? "h-full w-full" : "hidden"}>
                <LogExtractor
                  rules={logRules}
                  onUpdateRules={setLogRules}
                  onExportSettings={handleExportSettings}
                  onImportSettings={handleImportSettings}
                />
              </div>

              <div className={activeTool === ToolId.POST_TOOL ? "h-full w-full" : "hidden"}>
                <PostTool
                  savedRequests={savedRequests}
                  onUpdateRequests={setSavedRequests}
                  savedRequestGroups={savedRequestGroups}
                  onUpdateGroups={setSavedRequestGroups}
                  globalVariables={postGlobalVariables}
                  onUpdateGlobalVariables={setPostGlobalVariables}
                />
              </div>

              <div className={activeTool === ToolId.JSON_TOOLS ? "h-full w-full" : "hidden"}>
                <JsonTools />
              </div>

              <div className={activeTool === ToolId.TPK_EXTRACTOR ? "h-full w-full" : "hidden"}>
                <TpkExtractor />
              </div>

              <div className={activeTool === ToolId.SMARTTHINGS_DEVICES ? "h-full w-full" : "hidden"}>
                <SmartThingsDevicesPane />
              </div>

              <div className={activeTool === ToolId.REVERSE_ENGINEER ? "h-full w-full" : "hidden"}>
                <ReverseEngineer />
              </div>
            </>
          )}
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentStartLineIndex={0} />
        </main>
      </div>
    </div>
  );
};

export default App;