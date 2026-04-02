import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { AgentConfig } from '../LogAnalysisAgent/protocol';
import { sendChatMessage } from './GaussChatService';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const GaussChatAgentPlugin: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // localStorage에서 에이전트 설정 가져오기
  const getAgentConfig = (): AgentConfig => {
    const raw = localStorage.getItem('happytool_agent_config');
    return raw ? JSON.parse(raw) : { 
      endpoint: '', 
      apiKey: '', 
      model: '',
      maxIterations: 10,
      timeoutMs: 60000
    };
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // 사용자 메시지 추가
    const newMessages = [...messages, { role: 'user', content: userText } as ChatMessage];
    // 어시스턴트 메시지 자리 만들기 (스트리밍용)
    const assistantMsgIndex = newMessages.length;
    setMessages([...newMessages, { role: 'assistant', content: '', isStreaming: true }]);

    try {
      const config = getAgentConfig();
      if (!config.endpoint || !config.apiKey) {
        throw new Error('API 설정이 완료되지 않았습니다. (설정 -> Agent API 설정 확인)');
      }

      let fullResponse = '';
      await sendChatMessage(userText, config, (partial) => {
        fullResponse = partial;
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantMsgIndex] = { role: 'assistant', content: fullResponse, isStreaming: true };
          return updated;
        });
      });

      // 스트리밍 종료
      setMessages(prev => {
        const updated = [...prev];
        updated[assistantMsgIndex] = { role: 'assistant', content: fullResponse, isStreaming: false };
        return updated;
      });
    } catch (error: any) {
      setMessages(prev => [
        ...prev.slice(0, -1), // 마지막 스트리밍 메시지 제거
        { role: 'assistant', content: `❌ 오류 발생: ${error.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {/* ── Header ── */}
      <div className="h-12 flex items-center justify-between bg-slate-900 border-b border-white/5 px-6 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <MessageSquare size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-tight">Gauss Agent Chat</h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Powered by Gauss 2.3 Think</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">API Connected</span>
        </div>
      </div>

      {/* ── Messages Area ── */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 flex items-center justify-center border border-white/5">
              <Bot size={32} />
            </div>
            <div>
              <p className="text-sm font-bold">무엇을 도와드릴까요?</p>
              <p className="text-xs">가우스 에이전트와 실시간 대화를 시작해보세요.</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
              msg.role === 'user' 
                ? 'bg-slate-800 border-white/10' 
                : 'bg-indigo-600 border-indigo-400/30 shadow-lg shadow-indigo-600/20'
            }`}>
              {msg.role === 'user' ? <User size={18} /> : <Sparkles size={18} />}
            </div>
            <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600/90 text-white rounded-tr-none'
                  : 'bg-slate-900 border border-white/5 shadow-xl rounded-tl-none'
              }`}>
                {msg.content || (msg.isStreaming ? <Loader2 size={16} className="animate-spin opacity-50" /> : '')}
              </div>
              <span className="text-[10px] text-slate-600 font-medium px-1 capitalize">{msg.role}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Input Area ── */}
      <div className="p-6 pt-2 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent shrink-0">
        <div className="max-w-4xl mx-auto relative group">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="가우스에게 궁금한 점을 물어보세요..."
            className="w-full bg-slate-900/80 border border-white/10 rounded-2xl px-6 py-4 pr-16 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all backdrop-blur-xl"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-600/20"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="text-center text-[9px] text-slate-600 mt-4 uppercase tracking-[0.2em] font-bold">
          HAPPYTOOL GAUSS CHAT v1.0
        </p>
      </div>
    </div>
  );
};

export default GaussChatAgentPlugin;
