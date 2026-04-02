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
    files: { text: string; name: string }[],
    rule: LogRule | null,
    analysisType: AnalysisType,
    userHints?: { pid: string; tid: string; custom: string }
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
  const [files, setFiles] = useState<{ id: string; name: string; text: string; lineCount: number }[]>([]);
  const [pid, setPid] = useState<string>('');
  const [tid, setTid] = useState<string>('');
  const [userHint, setUserHint] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRunning = status === 'running' || status === 'extracting' || status === 'waiting_user';
  const isDone = status === 'completed' || status === 'cancelled' || status === 'error';

  const loadFile = useCallback(async (file: File) => {
    setIsLoadingFile(true);
    try {
      const text = await file.text();
      const lines = await parseLogText(text);
      const newFile = {
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        text,
        lineCount: lines.length,
      };
      setFiles(prev => [...prev, newFile]);
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
    if (files.length === 0) return;
    const rule = logRules.find(r => r.id === selectedRuleId) ?? null;
    onStart(
      files.map(f => ({ text: f.text, name: f.name })),
      rule,
      analysisType,
      { pid, tid, custom: userHint }
    );
  }, [files, selectedRuleId, analysisType, logRules, onStart, pid, tid, userHint]);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setFiles([]);
    setPid('');
    setTid('');
    setUserHint('');
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
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Log Files ({files.length})
          </label>
          {files.length > 0 && !isRunning && (
            <button
              onClick={handleClearAll}
              className="text-[10px] text-red-400 hover:text-red-300 transition-colors font-bold"
            >
              전체 삭제
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar-sm pr-1">
          {files.map(file => (
            <div key={file.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-2.5 flex items-center gap-3 group">
              <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText size={16} className="text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
                <p className="text-[10px] text-slate-500">{file.lineCount.toLocaleString()} 줄</p>
              </div>
              {!isRunning && (
                <button
                  onClick={() => handleRemoveFile(file.id)}
                  className="p-1 px-2 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                  title="파일 제거"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}

          {/* 파일 추가 버튼/영역 */}
          {!isRunning && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-indigo-400 bg-indigo-500/10'
                  : 'border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'
              }`}
            >
              {isLoadingFile ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] text-slate-400">파일 로컬 로딩 중...</p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Upload size={14} className="text-slate-500" />
                  <p className="text-xs text-slate-400 font-medium">로그 파일 추가 (드롭/클릭)</p>
                </div>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".log,.txt,.out,.dump,*"
          onChange={handleFileChange}
          className="hidden"
          multiple
        />
      </div>

      {/* 사용자 추가 힌트 */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 transition-all">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">
              Process ID (PID)
            </label>
            <input
              type="text"
              value={pid}
              onChange={e => setPid(e.target.value)}
              disabled={isRunning}
              placeholder="e.g. 1234"
              className="w-full bg-slate-800/40 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">
              Thread ID (TID)
            </label>
            <input
              type="text"
              value={tid}
              onChange={e => setTid(e.target.value)}
              disabled={isRunning}
              placeholder="e.g. 5678"
              className="w-full bg-slate-800/40 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">
            Additional User Hint
          </label>
          <textarea
            value={userHint}
            onChange={e => setUserHint(e.target.value)}
            disabled={isRunning}
            placeholder="분석에 도움이 될만한 추가 정보나 상황을 입력해주세요..."
            rows={2}
            className="w-full bg-slate-800/40 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600 resize-none custom-scrollbar-sm"
          />
        </div>
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
              onClick={handleClearAll}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 font-bold text-sm transition-all"
            >
              처음으로
            </button>
            <button
              onClick={handleStart}
              disabled={files.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={14} />
              재분석
            </button>
          </div>
        ) : (
          <button
            onClick={handleStart}
            disabled={files.length === 0 || isLoadingFile}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            <Play size={16} />
            분석 시작
          </button>
        )}

        {files.length === 0 && (
          <div className="flex items-center gap-2 mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
            <p className="text-[11px] text-amber-300/80">분석할 로그 파일을 하나 이상 추가해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentConfigPanel;
