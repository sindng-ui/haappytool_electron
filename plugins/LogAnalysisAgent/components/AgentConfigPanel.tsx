import React, { useCallback, useRef, useState } from 'react';
import { LogRule } from '../../../types';
import { AnalysisType } from '../protocol';
import { useHappyTool } from '../../../contexts/HappyToolContext';
import { ChevronDown, FileText, Upload, X, Play, Square, AlertCircle } from 'lucide-react';
import { AgentRunStatus } from '../hooks/useAnalysisAgent';
import { parseLogText } from '../services/hintExtractor';

interface AgentConfigPanelProps {
  status: AgentRunStatus;
  onStart: (
    logText: string,
    fileName: string,
    rule: LogRule | null,
    analysisType: AnalysisType
  ) => void;
  onCancel: () => void;
  onReset: () => void;
}

const ANALYSIS_TYPES: { value: AnalysisType; label: string; emoji: string; desc: string }[] = [
  { value: 'crash', label: 'Crash', emoji: '💥', desc: '앱 크래시 / 시그널 / 스택트레이스 분석' },
  { value: 'deadlock', label: 'Deadlock', emoji: '🔒', desc: '교착 상태 / 뮤텍스 / 스레드 블록 분석' },
  { value: 'perf', label: 'Perf Analyze', emoji: '⚡', desc: '성능 병목 / 타임아웃 / 지연 분석' },
  { value: 'traffic', label: 'Traffic Analyze', emoji: '🌐', desc: 'HTTP 오류 / 트래픽 이상 분석' },
];

const AgentConfigPanel: React.FC<AgentConfigPanelProps> = ({
  status,
  onStart,
  onCancel,
  onReset,
}) => {
  const { logRules } = useHappyTool();
  const [analysisType, setAnalysisType] = useState<AnalysisType>('crash');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [logText, setLogText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileLineCount, setFileLineCount] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRunning = status === 'running' || status === 'extracting' || status === 'waiting_user';
  const isDone = status === 'completed' || status === 'cancelled' || status === 'error';

  const loadFile = useCallback(async (file: File) => {
    setIsLoadingFile(true);
    setFileName(file.name);
    try {
      const text = await file.text();
      setLogText(text);
      // 줄 수 계산 (비동기)
      const lines = await parseLogText(text);
      setFileLineCount(lines.length);
    } catch (err) {
      console.error('파일 로드 오류:', err);
    } finally {
      setIsLoadingFile(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    // 같은 파일을 다시 선택할 수 있도록 초기화
    e.target.value = '';
  }, [loadFile]);

  const handleStart = useCallback(() => {
    if (!logText) return;
    const rule = logRules.find(r => r.id === selectedRuleId) ?? null;
    onStart(logText, fileName, rule, analysisType);
  }, [logText, fileName, selectedRuleId, analysisType, logRules, onStart]);

  const handleClearFile = useCallback(() => {
    setLogText('');
    setFileName('');
    setFileLineCount(0);
    onReset();
  }, [onReset]);

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar pr-1">
      {/* 분석 유형 */}
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Analysis Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ANALYSIS_TYPES.map(at => (
            <button
              key={at.value}
              onClick={() => setAnalysisType(at.value)}
              disabled={isRunning}
              className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 transition-all text-left ${
                analysisType === at.value
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                  : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-base">{at.emoji}</span>
              <span className="font-bold text-xs">{at.label}</span>
              <span className="text-[10px] text-slate-500 leading-tight">{at.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mission 선택 */}
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Mission (Log Extractor Filter)
        </label>
        <div className="relative">
          <select
            value={selectedRuleId}
            onChange={e => setSelectedRuleId(e.target.value)}
            disabled={isRunning}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <option value="">전체 로그 분석 (필터 없음)</option>
            {logRules.map(rule => (
              <option key={rule.id} value={rule.id}>
                {rule.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        {selectedRuleId && (
          <p className="text-[10px] text-slate-500 mt-1 ml-1">
            선택된 미션의 Happy Combo 필터가 1차 힌트 추출에 사용됩니다.
          </p>
        )}
      </div>

      {/* 로그 파일 */}
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Log File
        </label>

        {logText ? (
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText size={20} className="text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">{fileName}</p>
              <p className="text-[10px] text-slate-500">
                {fileLineCount.toLocaleString()} 줄
              </p>
            </div>
            {!isRunning && (
              <button
                onClick={handleClearFile}
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                title="파일 제거"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ) : (
          <div
            onClick={() => !isRunning && fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-indigo-400 bg-indigo-500/10'
                : 'border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'
            } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoadingFile ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-400">파일 로딩 중...</p>
              </div>
            ) : (
              <>
                <Upload size={24} className="mx-auto mb-2 text-slate-500" />
                <p className="text-sm text-slate-400 font-medium">
                  로그 파일을 드롭하거나 클릭하세요
                </p>
                <p className="text-[10px] text-slate-600 mt-1">.log, .txt 모든 텍스트 파일 지원</p>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".log,.txt,.out,.dump,*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* 액션 버튼 */}
      <div className="mt-auto pt-2">
        {isRunning ? (
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-500/10 text-red-400 border-2 border-red-500/30 hover:bg-red-500/20 font-bold transition-all"
          >
            <Square size={16} />
            분석 중단
          </button>
        ) : isDone ? (
          <div className="flex gap-2">
            <button
              onClick={handleClearFile}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 font-bold text-sm transition-all"
            >
              처음으로
            </button>
            <button
              onClick={handleStart}
              disabled={!logText}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={14} />
              재분석
            </button>
          </div>
        ) : (
          <button
            onClick={handleStart}
            disabled={!logText || isLoadingFile}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            <Play size={16} />
            분석 시작
          </button>
        )}

        {!logText && (
          <div className="flex items-center gap-2 mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
            <p className="text-[11px] text-amber-300/80">로그 파일을 먼저 업로드해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentConfigPanel;
