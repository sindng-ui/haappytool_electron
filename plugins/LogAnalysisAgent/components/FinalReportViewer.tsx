import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Download, CheckCircle2, FileText } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

interface FinalReportViewerProps {
  report: string;
}

const FinalReportViewer: React.FC<FinalReportViewerProps> = ({ report }) => {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if ((window as any).electronAPI?.copyToClipboard) {
        await (window as any).electronAPI.copyToClipboard(report);
      } else {
        await navigator.clipboard.writeText(report);
      }
      setCopied(true);
      addToast('보고서가 클립보드에 복사되었습니다!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('복사에 실패했습니다.', 'error');
    }
  };

  const handleDownload = async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `analysis-report-${timestamp}.md`;

    if ((window as any).electronAPI?.saveFile) {
      const result = await (window as any).electronAPI.saveFile(report);
      if (result?.status === 'success') {
        addToast(`보고서 저장 완료: ${result.filePath}`, 'success');
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-500/20 rounded-lg flex items-center justify-center">
            <FileText size={14} className="text-green-400" />
          </div>
          <span className="text-sm font-bold text-slate-300">최종 분석 보고서</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-200"
            title="마크다운 복사"
          >
            {copied ? (
              <><CheckCircle2 size={12} className="text-green-400" /> 복사됨!</>
            ) : (
              <><Copy size={12} /> 복사</>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 transition-all"
            title="파일로 저장"
          >
            <Download size={12} /> 저장
          </button>
        </div>
      </div>

      {/* 마크다운 본문 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">
        <div className="prose prose-invert prose-sm max-w-none
          prose-headings:text-slate-200 prose-headings:font-bold
          prose-h1:text-2xl prose-h1:border-b prose-h1:border-slate-700 prose-h1:pb-3 prose-h1:mb-4
          prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h2:text-indigo-300
          prose-h3:text-base prose-h3:text-slate-300 prose-h3:mt-4 prose-h3:mb-2
          prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-sm
          prose-strong:text-slate-100 prose-strong:font-bold
          prose-em:text-slate-400
          prose-code:text-indigo-300 prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700 prose-pre:rounded-xl prose-pre:p-4 prose-pre:overflow-x-auto
          prose-blockquote:border-l-2 prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-500/5 prose-blockquote:pl-4 prose-blockquote:py-1
          prose-ul:text-slate-300 prose-ul:my-2 prose-ol:text-slate-300
          prose-li:text-sm prose-li:text-slate-300
          prose-table:border-collapse prose-table:w-full
          prose-th:bg-slate-800 prose-th:text-slate-200 prose-th:px-4 prose-th:py-2 prose-th:border prose-th:border-slate-700 prose-th:text-sm
          prose-td:px-4 prose-td:py-2 prose-td:border prose-td:border-slate-700 prose-td:text-slate-300 prose-td:text-sm
          prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline
          prose-hr:border-slate-700
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {report}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default FinalReportViewer;
