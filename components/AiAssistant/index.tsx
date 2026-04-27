import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useHappyTool } from '../../contexts/HappyToolContext';
import * as Lucide from 'lucide-react';
import { db, ChatSession } from './db'; // Import DB
import { useTextSelectionMenu } from '../LogArchive/hooks/useTextSelectionMenu';

const { Send, Bot, User, Trash2, StopCircle, RefreshCw, Copy, Check, Settings, X, Save, Plus, Paperclip, FileText, History, Download, AlignJustify, Edit2, ChevronRight } = Lucide;

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Use proxy in browser environment (development) to avoid CORS
// If electronAPI is available, we might still use absolute URL, but let's stick to proxy for browser consistency
const API_BASE = window.electronAPI ? 'http://localhost:1234/v1' : '/lm-studio';

interface Model {
    id: string;
    object: string;
    owned_by: string;
}

interface SystemPrompt {
    id: string;
    name: string;
    content: string;
}

// Interface moved to db.ts, but we keep Message for local type usage if needed, 
// strictly speaking we should import it or keep it compatible.
// The db.ts defines ChatSession with inline messages type.
// Let's rely on db.ts types or ensure compatibility.
// We will remove ChatSession interface definition here to avoid conflict if I export it from db.ts
// But wait, line 7-10 defines Message.

const SUPPORTED_LANGUAGES = [
    { code: 'ko', name: '한국어' },
    { code: 'en', name: 'English' },
    { code: 'zh', name: '中文' },
    { code: 'es', name: 'Español' },
    { code: 'ja', name: '日本語' },
    { code: 'fr', name: 'Français' },
    { code: 'it', name: 'Italiano' }
];

const DEFAULT_PROMPTS: SystemPrompt[] = [
    {
        id: 'default',
        name: 'Default Assistant',
        content: 'You are a helpful coding assistant specialized in C# and .NET.'
    },
    {
        id: 'network_traffic_master',
        name: 'Network Traffic Master',
        content: `[Role] 너는 클라우드 비용 절감과 데이터 효율화를 전문으로 하는 **'시니어 네트워크 아키텍트 및 성능 최적화 전문가'**야. Tizen 환경의 기기에서 발생하는 트래픽을 분석하고 최적화하는 데 특화되어 있어. 

[Goal] 가장 큰 목표는 **'불필요한 네트워크 트래픽을 획기적으로 줄여 인프라 비용을 절감하는 것'**이야. 제공되는 Tizen Client 로그를 분석하여 데이터 낭비가 발생하는 지점을 찾아내고, 기술적인 해결책을 제시해야 해.

[Analysis Guidelines]

중복 요청 탐지: 동일한 데이터를 반복해서 호출하는 폴링(Polling)이나 비효율적인 동기화 로직을 찾아내.

페이로드 최적화: 전송되는 JSON/XML 데이터 중 불필요한 필드나 비효율적인 데이터 형식을 지적해. (예: 압축 필요성, 바이너리 포맷 전환 등)

캐싱 전략: HTTP 헤더(ETag, Cache-Control) 미흡으로 인해 발생하는 불필요한 재다운로드 구간을 분석해.

연결 관리: 과도한 TCP 핸드쉐이크나 Keep-Alive 설정 미흡으로 인한 오버헤드를 탐지해.

비용 영향 분석: 특정 트래픽 패턴이 유지될 때 발생할 수 있는 예상 비용 리스크를 언급해.

[Output Format] 모든 분석은 다음 형식을 엄격히 지켜서 답변해줘.

[트래픽 낭비 지점]: 로그에서 발견된 문제의 타임스탬프와 태그.

[데이터 낭비 규모]: 현재 발생 중인 불필요한 트래픽 크기 추정.

[비용 절감 솔루션]: 구체적인 최적화 기술(예: Rx.NET의 Throttle/DistinctUntilChanged 적용, 응답 압축 등).

[기대 효과]: 최적화 후 예상되는 트래픽 감소량(%).`
    },
    {
        id: 'dotnet_rx_master',
        name: 'C# .NET Rx.NET Master',
        content: `[Role] 너는 세계적인 수준의 **'시니어 .NET 반응형 프로그래밍 아키텍트(Senior .NET Reactive Architect)'**이자 **'Rx.NET(Reactive Extensions) 전문가'**야. 복잡한 비동기 이벤트 스트림을 선언적이고 효율적인 파이프라인으로 설계하는 데 독보적인 능력을 갖추고 있어.

[Expertise]

비동기 패턴: async/await, TaskParallel Library(TPL)를 완벽히 이해하며, 이를 Rx.NET의 Observable과 결합하여 교착 상태(Deadlock)나 레이스 컨디션이 없는 코드를 설계해.

Rx.NET 마스터: SelectMany, Switch, CombineLatest, Throttle, Sample 등 복잡한 연산자를 적재적소에 사용하여 데이터 흐름을 제어하는 데 능숙해.

Tizen & 임베디드 최적화: 자원이 제한된 Tizen 가전 환경을 고려하여, 가비지 컬렉션(GC) 압력을 낮추고 CPU 사용량을 최적화하는 코드를 지향해.

메모리 안전성: 스트림 구독 해제(IDisposable, CompositeDisposable)를 철저히 관리하여 메모리 누수를 원천 차단하는 로직을 기본으로 해.

[Guidelines for Code Generation]

선언적 프로그래밍: if/else, foreach 루프보다는 Rx 연산자를 활용한 파이프라인 방식을 우선해.

스케줄링 명시: 데이터 처리 위치(SubscribeOn)와 UI 업데이트 위치(ObserveOn)를 명확히 구분하여 성능과 반응성을 모두 잡아.

에러 핸들링: 스트림 도중 에러가 발생해도 전체 파이프라인이 죽지 않도록 Retry, Catch, OnErrorResumeNext를 적절히 활용해.

최신 문법: .NET 8/9 및 C# 12/13의 최신 기능(Primary Constructors, Collection Expressions 등)을 적극 사용해.

[Output Structure] **설명은 절대 코드 블록(code block) 안에 넣지 마세요. 오직 실제 C# 코드만 코드 블록을 사용하세요.**

[코드 아키텍처 설명]: 왜 이 구조가 성능과 유지보수 면에서 유리한지 설명.

[C# 구현 코드]: 가독성이 높고 즉시 실행 가능한 코드 블록(\`\`\`csharp ... \`\`\`).

[Rx 연산자 핵심 팁]: 사용된 주요 연산자의 역할과 주의사항 요약.

[성능 및 메모리 체크리스트]: Tizen 환경에서 주의해야 할 최적화 포인트.`
    },
    {
        id: 'tizen_perf_expert',
        name: 'Tizen Performance Expert',
        content: `🛠️ Tizen 앱 성능 분석 전문가 시스템 프롬프트 
[Role] 너는 삼성 Tizen OS 플랫폼에 최적화된 **'시니어 Tizen 성능 엔지니어'**이자 **'시스템 분석 전문가'**야. Tizen .NET(NUI) 앱의 실행 속도, 메모리 효율성, 그리고 사용자 경험(UX) 반응성을 분석하고 최적화하는 데 독보적인 전문성을 가지고 있어.

[Goal] 가장 큰 목표는 **'앱 실행 성능(App Launch Performance) 극대화'**와 **'시스템 자원(CPU/RAM) 사용 최적화'**야. 제공된 로그에서 사용자 체감 성능을 저하시키는 '병목 지점(Bottleneck)'을 데이터 기반으로 찾아내고 실질적인 개선안을 제시해야 해.

[Analysis Guidelines]

실행 단계별 정밀 분석: OnCreate, OnResume, First Frame Rendered 등 주요 생명주기 이벤트 간의 시간 간격(Delta)을 계산하여 로딩 속도를 분석해.

리소스 로딩 병목 탐지: 대용량 이미지 자원 로드, DB 쿼리, XML/JSON 파싱 등에서 발생하는 지연을 식별해.

UI 렌더링 부하 분석: NUI(Native UI) 엔진의 렌더링 로그를 통해 프레임 드랍(Jank)이나 레이아웃 계산 지연 여부를 판단해.

시스템 이벤트 모니터링: Low Memory Warning, GC_FOR_MALLOC 등 시스템 수준의 경고 로그와 앱 성능의 인과관계를 분석해.

Tizen 특화 최적화: 가전/TV의 낮은 CPU 사양을 고려하여 멀티스레딩 활용이나 비동기 처리(Async)가 필요한 지점을 지적해.

[Output Format] 모든 분석 결과는 다음 형식을 준수하여 전문적으로 출력해줘. **설명은 절대 코드 블록(code block) 안에 넣지 마세요. 오직 실제 코드만 코드 블록을 사용하세요.**

[성능 분석 요약]: 전체적인 실행 시간 및 주요 지표 요약.

[병목 구간 상세]: 로그 타임스탬프 기반 지연 발생 구간 및 해당 줄 번호.

[원인 추론]: Tizen 아키텍처 관점에서의 기술적 원인 분석.

[최적화 가이드]: Tizen API 활용 및 C# 코드 수준의 개선 권고 사항.

[UX 영향도]: 해당 문제가 사용자에게 미치는 영향(예: 로딩 애니메이션 멈춤 등).`
    },
    {
        id: 'smartthings_architect',
        name: 'SmartThings IoT Architect',
        content: `[Role] 너는 15년 이상의 경력을 가진 **'시니어 SmartThings IoT 솔루션 아키텍트'**이자 **'UX 경험 설계 전문가'**야. 단순히 기기를 연결하는 것을 넘어, IoT 기술을 통해 사용자의 일상에 '감동'과 '편안함'을 주는 것을 최고의 가치로 여겨.

[Philosophy] "최고의 기술은 눈에 보이지 않아야 하며, 사용자가 요구하기 전에 그 마음을 먼저 읽어야 한다." 너는 이 철학을 바탕으로, 기기 간의 유기적인 자동화(Automation)가 어떻게 사용자의 감정을 케어할 수 있는지 고민해.

[Expertise]

SmartThings 생태계 마스터: Edge Drivers, Rules API, Scenes, 그리고 Matter 표준에 대한 깊은 이해를 바탕으로 가장 안정적인 스마트 홈 환경을 설계해.

맥락 인식(Context-aware) 자동화: 시간, 위치, 센서 데이터뿐만 아니라 사용자의 평소 습관을 분석하여 '개인화된 감동의 순간'을 찾아내.

Tizen & 가전 시너지: 삼성 가전과 Tizen OS 기기들이 SmartThings 내에서 어떻게 최상의 시너지를 내어 사용자 경험(UX)을 극대화할 수 있는지 제안해.

[Analysis & Design Guidelines]

감동의 포인트 찾기: 사용자가 불편함을 느끼기 전, 기기가 먼저 알아서 배려해주는 시나리오를 구상해. (예: 귀가 시간에 맞춰 조명과 음악이 기분을 맞춰주는 등)

안정성 기반의 감동: 기술적 오류는 감동을 깨뜨려. 가장 안정적이고 실패 없는 기기 연결 및 자동화 로직을 설계해.

멀티 디바이스 오케스트레이션: 여러 기기가 마치 하나의 생명체처럼 조화롭게 움직여 최상의 분위기를 연출하는 방법을 제시해.

[Output Format] **설명은 일반 텍스트로 작성하고, 오직 기술적 코드(JSON/YAML 등)만 코드 블록을 사용하세요.**

[사용자 시나리오]: 사용자가 일상에서 경험하게 될 따뜻하고 감동적인 순간 묘사.

[IoT 설계도]: SmartThings에서 구현할 기기 목록과 자동화 조건(Trigger/Action).

[기술적 디테일]: 안정적인 구현을 위한 Rules API 또는 Scene 설정 팁.

[전문가의 한마디]: 이 설계가 왜 사용자의 마음을 움직일 수 있는지에 대한 인문학적 고찰.`
    }
];

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative my-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1117]">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase">{language || 'code'}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="overflow-x-auto p-4">
                <pre className="font-mono text-sm text-slate-800 dark:text-slate-300 whitespace-pre">
                    {code}
                </pre>
            </div>
        </div>
    );
};

const ThoughtBlock: React.FC<{ content: string }> = ({ content }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="my-2 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-900/10 overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-left"
            >
                <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                    <ChevronRight size={14} />
                </div>
                <span>Thought Process</span>
            </button>
            <div className={`px-3 py-2 text-sm text-slate-800 dark:text-slate-300 font-mono text-[13px] leading-relaxed border-t border-indigo-100 dark:border-indigo-900/50 whitespace-pre-wrap ${!isExpanded ? 'line-clamp-3 opacity-70' : ''}`}>
                {content.trim()}
            </div>
            {!isExpanded && (
                <div className="px-3 pb-2 pt-0 text-[10px] text-indigo-500/70 hover:text-indigo-500 cursor-pointer" onClick={() => setIsExpanded(true)}>
                    Click to expand...
                </div>
            )}
        </div>
    );
};

// Helper to parse inline styles (bold)
const parseInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-indigo-700 dark:text-indigo-300">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

// Static regex for performance
const THINK_BLOCK_REGEX = /(<think>[\s\S]*?<\/think>)/g;

const FormattedText: React.FC<{ text: string }> = React.memo(({ text }) => {
    // 1. Split by <think> tags first
    const parts = text.split(THINK_BLOCK_REGEX);

    return (
        <div className="leading-relaxed space-y-1">
            {parts.map((part, index) => {
                // Handle <think> block
                if (part.startsWith('<think>') && part.endsWith('</think>')) {
                    const content = part.slice(7, -8); // Remove tags
                    return <ThoughtBlock key={index} content={content} />;
                }

                // Handle regular text (which might contain code blocks)
                const codeParts = part.split(/(```[\s\S]*?```)/g);
                return (
                    <div key={index} className="inline-block w-full">
                        {codeParts.map((subPart, subIndex) => {
                            if (subPart.startsWith('```') && subPart.endsWith('```')) {
                                const content = subPart.slice(3, -3);
                                const match = content.match(/^(\w+)?\n/);
                                const lang = match ? match[1] : '';
                                const code = match ? content.slice(match[0].length) : content;
                                return <CodeBlock key={`${index}-${subIndex}`} code={code} language={lang} />;
                            }

                            // Parse Markdown-like features line by line
                            const lines = subPart.split('\n');
                            return (
                                <div key={`${index}-${subIndex}`}>
                                    {lines.map((line, lineIdx) => {
                                        const trimmed = line.trim();
                                        if (!trimmed) return <div key={lineIdx} className="h-2" />; // Spacer for double newline

                                        // Headers
                                        if (trimmed.startsWith('### ')) {
                                            return <h3 key={lineIdx} className="text-lg font-bold mt-4 mb-2 text-slate-800 dark:text-slate-100">{parseInline(line.slice(4))}</h3>;
                                        }
                                        if (trimmed.startsWith('## ')) {
                                            return <h2 key={lineIdx} className="text-xl font-bold mt-6 mb-3 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-1">{parseInline(line.slice(3))}</h2>;
                                        }

                                        // Lists
                                        if (trimmed.startsWith('- ')) {
                                            return (
                                                <div key={lineIdx} className="flex gap-2 ml-1 my-1">
                                                    <span className="text-indigo-500 font-bold">•</span>
                                                    <div className="flex-1">{parseInline(line.replace(/^- /, ''))}</div>
                                                </div>
                                            );
                                        }
                                        // Numbered Lists (Simple 1. detection)
                                        if (/^\d+\.\s/.test(trimmed)) {
                                            return (
                                                <div key={lineIdx} className="flex gap-2 ml-1 my-1">
                                                    <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs pt-1">{trimmed.split('.')[0]}.</span>
                                                    <div className="flex-1">{parseInline(line.replace(/^\d+\.\s/, ''))}</div>
                                                </div>
                                            );
                                        }

                                        // Blockquotes
                                        if (trimmed.startsWith('> ')) {
                                            return (
                                                <div key={lineIdx} className="border-l-4 border-indigo-300 dark:border-indigo-700 pl-3 py-1 my-2 bg-slate-50 dark:bg-slate-800/50 italic text-slate-600 dark:text-slate-400">
                                                    {parseInline(line.slice(2))}
                                                </div>
                                            );
                                        }

                                        return <div key={lineIdx} className="my-0.5 min-h-[1.5em]">{parseInline(line)}</div>;
                                    })}
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}); // End of FormattedText

const CollapsibleText: React.FC<{ text: string }> = React.memo(({ text }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const MAX_LENGTH = 300;
    const isLong = text.length > MAX_LENGTH;

    if (!isLong) {
        return <p className="whitespace-pre-wrap leading-relaxed">{text}</p>;
    }

    return (
        <div>
            <p className="whitespace-pre-wrap leading-relaxed">
                {isExpanded ? text : `${text.slice(0, MAX_LENGTH)}...`}
            </p>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-indigo-200 hover:text-white mt-2 flex items-center gap-1 font-medium transition-colors"
                type="button"
            >
                {isExpanded ? (
                    <>Show less</>
                ) : (
                    <>Show more <ChevronRight size={10} /></>
                )}
            </button>
        </div>
    );
}); // End of CollapsibleText

const AiAssistant: React.FC = () => {
    const { handleContextMenu, ContextMenuComponent } = useTextSelectionMenu();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string>('default');
    const [isDbLoaded, setIsDbLoaded] = useState(false);

    const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
    const messages = activeSession?.messages || [];
    const activePromptId = activeSession?.activePromptId || 'default';

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [models, setModels] = useState<Model[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>(DEFAULT_PROMPTS);

    // New Feature States
    const [promptHistory, setPromptHistory] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [sendOnEnter, setSendOnEnter] = useState(true);

    // File Attachments
    const [attachments, setAttachments] = useState<{ name: string, content: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // UI State for Settings Modal
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [editingPromptId, setEditingPromptId] = useState<string>('default');
    const [editName, setEditName] = useState('');
    const [editContent, setEditContent] = useState('');

    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);

    // Server Configuration
    const [serverConfig, setServerConfig] = useState({ host: 'http://localhost', port: '1234' });
    const [isLoaded, setIsLoaded] = useState(false);

    // Response Language
    const [responseLanguage, setResponseLanguage] = useState<string>('ko');

    // Smart Auto-Scroll State
    const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

    // Abort Controller for stopping generation
    const [abortController, setAbortController] = useState<AbortController | null>(null);

    // Chat Renaming State
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editSessionTitle, setEditSessionTitle] = useState('');

    // Load Sessions Helper
    const loadSessions = async () => {
        const all = await db.sessions.orderBy('lastUpdated').reverse().toArray();
        if (all.length === 0) {
            // Create default if empty
            const def: ChatSession = { id: 'default', title: 'New Chat', messages: [], activePromptId: 'default', lastUpdated: Date.now() };
            await db.sessions.add(def);
            setSessions([def]);
        } else {
            setSessions(all);
        }
    };

    // ... (useEffect hooks)

    const handleStop = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            setIsLoading(false);

            // Add [Stopped] check to last message if needed, or just let it stay as is
            updateActiveSession(prev => {
                const msgs = [...prev.messages];
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    // Start a new line to indicate stop
                    // lastMsg.content += ' [Stopped]';
                }
                return { ...prev, messages: msgs };
            });
        }
    };

    const handleStartRenameSession = (id: string, currentTitle: string) => {
        setEditingSessionId(id);
        setEditSessionTitle(currentTitle);
    };

    const handleSaveRenamedSession = (id: string) => {
        if (!editSessionTitle.trim()) {
            setEditingSessionId(null);
            return;
        }

        if (!editSessionTitle.trim()) {
            setEditingSessionId(null);
            return;
        }

        db.sessions.update(id, { title: editSessionTitle.trim(), lastUpdated: Date.now() })
            .then(loadSessions);
        setEditingSessionId(null);
    };

    // Computed active prompt content
    const activePromptContent = systemPrompts.find(p => p.id === activePromptId)?.content || DEFAULT_PROMPTS[0].content;

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Load saved prompts
        const savedPrompts = localStorage.getItem('ai_assistant_prompts');
        if (savedPrompts) {
            try {
                const parsed = JSON.parse(savedPrompts);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Merge saved prompts with new defaults
                    // We keep saved prompts (to preserve user edits) but append any new default IDs that are missing
                    const merged = [...parsed];
                    let hasNew = false;

                    DEFAULT_PROMPTS.forEach(def => {
                        if (!merged.some(p => p.id === def.id)) {
                            merged.push(def);
                            hasNew = true;
                        }
                    });

                    setSystemPrompts(merged);
                    if (hasNew) {
                        localStorage.setItem('ai_assistant_prompts', JSON.stringify(merged));
                    }
                }
            } catch (e) {
                console.error('Failed to parse saved prompts', e);
            }
        }

        // Load sessions
        // MIGRATION & INIT Logic
        const initFn = async () => {
            // Migration
            const savedSessions = localStorage.getItem('ai_assistant_sessions');
            if (savedSessions) {
                try {
                    const parsed = JSON.parse(savedSessions);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        // Check if DB is already populated to avoid double migration? 
                        // Or just overwrite/merge. Let's assume if DB is empty we migrate.
                        const count = await db.sessions.count();
                        if (count === 0) {
                            await db.sessions.bulkPut(parsed);
                            console.log("Migrated sessions to IndexedDB");
                        }
                    }
                } catch (e) { console.error("Migration failed", e); }
                // Clear localStorage to free up space
                localStorage.removeItem('ai_assistant_sessions');
            }

            await loadSessions();

            const savedActiveSessionId = localStorage.getItem('ai_assistant_active_session_id');
            if (savedActiveSessionId) setActiveSessionId(savedActiveSessionId);

            setIsDbLoaded(true);
        };

        initFn();

        // Load history and settings
        const savedHistory = localStorage.getItem('ai_assistant_history');
        if (savedHistory) setPromptHistory(JSON.parse(savedHistory));

        const savedSendOnEnter = localStorage.getItem('ai_assistant_send_on_enter');
        if (savedSendOnEnter) setSendOnEnter(savedSendOnEnter === 'true');

        const savedSidebarWidth = localStorage.getItem('ai_assistant_sidebar_width');
        if (savedSidebarWidth) setSidebarWidth(parseInt(savedSidebarWidth, 10));

        const savedServerConfig = localStorage.getItem('ai_assistant_server_config');
        if (savedServerConfig) {
            try {
                setServerConfig(JSON.parse(savedServerConfig));
            } catch (e) { console.error("Failed to parse server config", e); }
        }

        const savedLanguage = localStorage.getItem('ai_assistant_response_language');
        if (savedLanguage) setResponseLanguage(savedLanguage);

        setIsLoaded(true);
    }, []);

    // Save sessions whenever they change
    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('ai_assistant_active_session_id', activeSessionId);
    }, [activeSessionId, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('ai_assistant_server_config', JSON.stringify(serverConfig));
        localStorage.setItem('ai_assistant_response_language', responseLanguage);
    }, [serverConfig, responseLanguage, isLoaded]);

    const createNewSession = () => {
        const newId = `session_${Date.now()}`;
        const newSession: ChatSession = {
            id: newId,
            title: 'New Chat',
            messages: [],
            activePromptId: 'default',
            lastUpdated: Date.now()
        };
        db.sessions.add(newSession).then(loadSessions);
        setActiveSessionId(newId);
    };

    const deleteSession = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (sessions.length <= 1) {
            alert("Cannot delete the last session.");
            return;
        }
        if (confirm("Delete this chat?")) {
            // Calculate next active session manually if deleting active
            let nextId = activeSessionId;
            if (activeSessionId === id && sessions.length > 1) {
                // Find index
                const idx = sessions.findIndex(s => s.id === id);
                // Try next, or prev
                const nextS = sessions[idx + 1] || sessions[idx - 1];
                if (nextS) nextId = nextS.id;
            }

            db.sessions.delete(id).then(() => {
                loadSessions();
                if (activeSessionId === id) setActiveSessionId(nextId);
            });
        }
    };


    const updateActiveSession = async (update: Partial<ChatSession> | ((prev: ChatSession) => Partial<ChatSession>)) => {
        setSessions(prevSessions => {
            const idx = prevSessions.findIndex(s => s.id === activeSessionId);
            if (idx === -1) return prevSessions;

            const current = prevSessions[idx];
            const newValues = typeof update === 'function' ? update(current) : update;
            const updatedSession = { ...current, ...newValues, lastUpdated: Date.now() };

            // Fire-and-forget DB update to ensure sync
            db.sessions.put(updatedSession).catch(err => console.error("DB Update Failed", err));

            const newSessions = [...prevSessions];
            newSessions[idx] = updatedSession;
            return newSessions;
        });
    };


    // Resize handlers
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Resize handlers
    const startResizing = useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        localStorage.setItem('ai_assistant_sidebar_width', sidebarWidth.toString());
    }, [sidebarWidth]);

    const resize = useCallback((mouseMoveEvent: any) => {
        if (isResizing && sidebarRef.current) {
            const sidebarRect = sidebarRef.current.getBoundingClientRect();
            // Calculate width based on mouse position relative to sidebar's left starting edge
            const newWidth = mouseMoveEvent.clientX - sidebarRect.left;

            if (newWidth > 200 && newWidth < 800) { // Min/Max limits
                setSidebarWidth(newWidth);
            }
        }
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    const scrollToBottom = () => {
        // Only scroll if user hasn't scrolled up
        if (!isUserScrolledUp) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isUserScrolledUp]); // Trigger when messages change

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // If user is near bottom (within 50px), enable auto-scroll. Otherwise, disable it.
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setIsUserScrolledUp(!isNearBottom);
    };

    // ... fetchUrl and fetchModels ...

    const handleOpenSettings = () => {
        // Prepare editing state with currently active prompt or default
        const currentHook = systemPrompts.find(p => p.id === activePromptId) || systemPrompts[0];
        setEditingPromptId(currentHook.id);
        setEditName(currentHook.name);
        setEditContent(currentHook.content);
        setIsSettingsOpen(true);
    };

    const handleSelectPromptToEdit = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        const prompt = systemPrompts.find(p => p.id === id);
        if (prompt) {
            setEditingPromptId(id);
            setEditName(prompt.name);
            setEditContent(prompt.content);
        }
    };

    const handleNewPrompt = () => {
        const newId = `custom_${Date.now()}`;
        const newPrompt = { id: newId, name: 'New Prompt', content: '' };
        setSystemPrompts(prev => [...prev, newPrompt]);
        setEditingPromptId(newId);
        setEditName('New Prompt');
        setEditContent('');
    };

    const handleSaveCurrentPrompt = () => {
        setSystemPrompts(prev => {
            const updated = prev.map(p => {
                if (p.id === editingPromptId) {
                    return { ...p, name: editName, content: editContent };
                }
                return p;
            });
            localStorage.setItem('ai_assistant_prompts', JSON.stringify(updated));
            return updated;
        });
        alert('Prompt saved!');
        // Don't close, allow continue editing
    };

    const handleActivatePrompt = () => {
        updateActiveSession({ activePromptId: editingPromptId });

        // Also save content changes if any
        handleSaveCurrentPrompt();

        // Close
        setIsSettingsOpen(false);
    };

    const handleDeletePrompt = () => {
        if (DEFAULT_PROMPTS.some(p => p.id === editingPromptId)) {
            alert("Cannot delete default presets.");
            return;
        }
        if (!confirm("Delete this prompt?")) return;

        setSystemPrompts(prev => {
            const updated = prev.filter(p => p.id !== editingPromptId);
            localStorage.setItem('ai_assistant_prompts', JSON.stringify(updated));
            // If we deleted the active one, revert to default
            if (activePromptId === editingPromptId) {
                updateActiveSession({ activePromptId: 'default' });
            }
            // If we deleted the one we were editing, switch edit view to default
            setEditingPromptId('default');
            const def = updated.find(p => p.id === 'default') || DEFAULT_PROMPTS[0];
            setEditName(def.name);
            setEditContent(def.content);
            return updated;
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);

            // Limit to 3 files for now to avoid token explosion
            if (attachments.length + files.length > 5) {
                alert("You can attach up to 5 files.");
                return;
            }

            const newAttachments: { name: string, content: string }[] = [];

            for (const file of files) {
                // Simple check for text-readable files
                // We'll try to read text from anything, but warn or fail on binary effectively
                try {
                    const text = await file.text();
                    newAttachments.push({
                        name: file.name,
                        content: text
                    });
                } catch (err) {
                    console.error("Failed to read file", file.name, err);
                }
            }

            setAttachments(prev => [...prev, ...newAttachments]);
            // clear input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleExportChat = () => {
        const exportData = {
            meta: {
                exportedAt: new Date().toISOString(),
                model: selectedModel,
                systemPrompt: {
                    name: systemPrompts.find(p => p.id === activePromptId)?.name,
                    content: activePromptContent
                }
            },
            messages: messages
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-export-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const toggleSendOnEnter = () => {
        setSendOnEnter(prev => {
            const newValue = !prev;
            localStorage.setItem('ai_assistant_send_on_enter', String(newValue));
            return newValue;
        });
    };

    const fetchUrl = async (url: string, options?: RequestInit) => {
        if (window.electronAPI) {
            const res = await window.electronAPI.fetchUrl(url, {
                method: options?.method || 'GET',
                headers: options?.headers as any,
                body: options?.body as string
            });
            return JSON.parse(res);
        } else {
            const res = await fetch(url, options);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        }
    };

    const fetchModels = async () => {
        setIsModelLoading(true);
        try {
            const baseUrl = window.electronAPI
                ? `${serverConfig.host.replace(/\/$/, '')}:${serverConfig.port}/v1`
                : '/lm-studio';
            const data = await fetchUrl(`${baseUrl}/models`);
            console.log('AI Assistant: Fetched models raw:', data);

            // Handle different response structures
            // Standard OpenAI: data.data
            // Some LMS: data directly or data.models
            const modelList = Array.isArray(data) ? data : (data.data || data.models || []);

            console.log('AI Assistant: Parsed model list:', modelList);

            if (Array.isArray(modelList)) {
                setModels(modelList);
                if (modelList.length > 0 && !selectedModel) {
                    setSelectedModel(modelList[0].id);
                }
            } else {
                console.warn('AI Assistant: Models data is not an array', modelList);
            }
        } catch (error) {
            console.warn('AI Assistant: Could not connect to model server. Is LM Studio/Ollama running?', error);
            // Fallback or alert
        } finally {
            setIsModelLoading(false);
        }
    };

    useEffect(() => {
        if (isLoaded) {
            fetchModels();
        }
    }, [isLoaded]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!input.trim() && attachments.length === 0) || isLoading) return;
        if (!selectedModel) {
            alert('Please select a model first.');
            return;
        }

        const attachmentContext = attachments.length > 0
            ? `\n\n${attachments.map(a => `--- BEGIN FILE: ${a.name} ---\n${a.content}\n--- END FILE: ${a.name} ---`).join('\n\n')}`
            : '';

        const fullContent = (input + attachmentContext).trim();

        const userMsg: Message = { role: 'user', content: fullContent };

        // 1. Update UI immediately
        const newMessages = [...messages, userMsg];
        updateActiveSession(prev => ({
            messages: newMessages,
            // Update title if it's the first user message and title is still "New Chat"
            title: prev.messages.length === 0 && prev.title === 'New Chat' ? input.slice(0, 30) : prev.title
        }));

        setInput('');
        setAttachments([]); // Clear attachments
        setIsLoading(true);
        setShowHistory(false); // Close history if open

        // Save to History (Text input only, unique, max 10)
        if (input.trim()) {
            setPromptHistory(prev => {
                const newHistory = [input, ...prev.filter(h => h !== input)].slice(0, 10);
                localStorage.setItem('ai_assistant_history', JSON.stringify(newHistory));
                return newHistory;
            });
        }

        // Create AbortController
        const controller = new AbortController();
        setAbortController(controller);

        try {
            // Set 120s timeout
            const timeoutId = setTimeout(() => {
                controller.abort();
                updateActiveSession(prev => ({
                    messages: [...prev.messages, { role: 'assistant', content: "Error: Request timed out after 120 seconds. The server might be busy." }]
                }));
                setIsLoading(false);
            }, 120000);

            // Build conversation history for context (Limit to last 20)
            const recentMessages = newMessages.filter(m => m.role !== 'system').slice(-20);

            // Inject Language Instruction
            const languageInstruction = `\n\n[IMPORTANT] output language: ${SUPPORTED_LANGUAGES.find(l => l.code === responseLanguage)?.name || 'English'}`;
            const finalSystemContent = activePromptContent + languageInstruction;

            const conversation = [{ role: 'system', content: finalSystemContent }, ...recentMessages];


            const baseUrl = window.electronAPI
                ? `${serverConfig.host.replace(/\/$/, '')}:${serverConfig.port}/v1`
                : '/lm-studio';

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: conversation,
                    temperature: 0.7,
                    stream: true // Enable streaming
                }),
                signal: controller.signal
            });

            // Clear timeout on response
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }

            if (!response.body) throw new Error('ReadableStream not supported.');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let assistantContent = '';

            // Add initial empty assistant message to UI
            updateActiveSession(prev => ({
                messages: [...prev.messages, { role: 'assistant', content: '' }]
            }));

            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const lines = buffer.split('\n');
                // Keep the last line in buffer if it's incomplete (doesn't end with newline)
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

                    const dataStr = trimmedLine.slice(6);
                    if (dataStr === '[DONE]') break;

                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices?.[0]?.delta?.content || '';
                        if (content) {
                            assistantContent += content;

                            // Update UI gracefully
                            updateActiveSession(prev => {
                                const msgs = [...prev.messages];
                                const lastMsg = msgs[msgs.length - 1];
                                if (lastMsg && lastMsg.role === 'assistant') {
                                    // Create new object to trigger re-render
                                    msgs[msgs.length - 1] = { ...lastMsg, content: assistantContent };
                                }
                                return { ...prev, messages: msgs };
                            });
                        }
                    } catch (e) {
                        console.warn('Failed to parse stream chunk:', e);
                    }
                }
            }

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Generation stopped by user');
                return;
            }
            console.error('Chat error:', error);
            updateActiveSession(prev => ({
                messages: [...prev.messages, { role: 'assistant', content: `Error: ${error.message}. Is the server running at ${serverConfig.host}:${serverConfig.port}?` }]
            }));
        } finally {
            setIsLoading(false);
            setAbortController(null);
        }
    };

    const handleClear = () => {
        updateActiveSession({ messages: [] });
    };

    return (
        <div
            className="flex h-full bg-slate-50 dark:bg-slate-950 overflow-hidden select-none"
            onContextMenu={(e) => handleContextMenu(e, { sourceFile: 'AiAssistant' })}
        >
            {/* Left Sidebar */}
            <div
                ref={sidebarRef}
                className="bg-white dark:bg-[#0b0f19] border-r border-slate-200 dark:border-white/5 flex flex-col shrink-0 z-20 relative"
                style={{ width: sidebarWidth }}
            >
                <div className="h-16 shrink-0 title-drag pl-16 flex items-center border-b border-white/5 bg-[#0f172a]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest no-drag">Control Panel</span>
                </div>
                {/* Drag Handle */}
                <div
                    className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-50"
                    onMouseDown={startResizing}
                />

                {/* Sidebar Header */}
                <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0" style={{ WebkitAppRegion: 'drag' } as any}>
                    <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Settings size={18} className="text-indigo-500" />
                        Settings
                    </h2>
                </div>

                <div className="flex-1 overflow-visible overflow-y-auto p-4 space-y-6">
                    {/* Chat Rooms */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded">
                                Chats
                            </label>
                            <button
                                onClick={createNewSession}
                                className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md text-indigo-500 transition-colors"
                                title="New Chat"
                            >
                                <Plus size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                        <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                            {sessions.map(s => (
                                <div
                                    key={s.id}
                                    className={`group flex items-center justify-between p-3 rounded-r-lg mb-1 cursor-pointer text-sm transition-all duration-200 border-l-[3px] ${activeSessionId === s.id
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-500 font-semibold shadow-sm'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                    onClick={() => setActiveSessionId(s.id)}
                                >
                                    {editingSessionId === s.id ? (
                                        <input
                                            type="text"
                                            value={editSessionTitle}
                                            onChange={(e) => setEditSessionTitle(e.target.value)}
                                            onBlur={() => handleSaveRenamedSession(s.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveRenamedSession(s.id);
                                                if (e.key === 'Escape') setEditingSessionId(null);
                                            }}
                                            className="flex-1 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-600 rounded px-1 py-0.5 text-xs outline-none"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="truncate flex-1" onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleStartRenameSession(s.id, s.title);
                                        }}>
                                            {s.title || 'New Chat'}
                                        </span>
                                    )}

                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!editingSessionId && (
                                            <button
                                                className="p-1 hover:text-indigo-500 transition-colors mr-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStartRenameSession(s.id, s.title);
                                                }}
                                                title="Rename"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                        )}
                                        <button
                                            className="p-1 hover:text-red-500 transition-colors"
                                            onClick={(e) => deleteSession(s.id, e)}
                                            title="Delete"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Role Selection */}
                    <div className="space-y-2 pt-6 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded">
                                System Roles
                            </label>
                            <div className="flex gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
                                <button
                                    onClick={handleNewPrompt}
                                    className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md text-indigo-500 transition-colors"
                                    title="New Role"
                                >
                                    <Plus size={16} strokeWidth={2.5} />
                                </button>
                                <button
                                    onClick={() => {
                                        if (DEFAULT_PROMPTS.some(p => p.id === activePromptId)) {
                                            alert("Cannot delete default presets.");
                                            return;
                                        }
                                        if (confirm("Delete this role?")) {
                                            setSystemPrompts(prev => {
                                                const updated = prev.filter(p => p.id !== activePromptId);
                                                localStorage.setItem('ai_assistant_prompts', JSON.stringify(updated));
                                                return updated;
                                            });
                                            // Reset active session's role to default if deleted
                                            if (activePromptId === activePromptId) {
                                                updateActiveSession({ activePromptId: 'default' });
                                            }
                                        }
                                    }}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-red-500"
                                    title="Delete Role"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        <select
                            className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={activePromptId}
                            onChange={(e) => {
                                updateActiveSession({ activePromptId: e.target.value });
                            }}
                        >
                            {systemPrompts.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Role Edit Area */}
                    <details className="group space-y-2">
                        <summary className="flex items-center justify-between cursor-pointer list-none select-none p-2 -mx-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-2">
                                <ChevronRight size={14} className="text-slate-400 transition-transform group-open:rotate-90" />
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">System Instructions</span>
                            </div>
                            <span className="text-[10px] text-indigo-500 font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="group-open:hidden">Edit</span>
                                <span className="hidden group-open:inline">Hide</span>
                            </span>
                        </summary>
                        <div className="pt-2">
                            <input
                                type="text"
                                value={systemPrompts.find(p => p.id === activePromptId)?.name || ''}
                                onChange={(e) => {
                                    setSystemPrompts(prev => {
                                        const updated = prev.map(p => p.id === activePromptId ? { ...p, name: e.target.value } : p);
                                        localStorage.setItem('ai_assistant_prompts', JSON.stringify(updated));
                                        return updated;
                                    });
                                }}
                                className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-sm mb-2"
                                placeholder="Role Name"
                            />
                            <textarea
                                value={systemPrompts.find(p => p.id === activePromptId)?.content || ''}
                                onChange={(e) => {
                                    setSystemPrompts(prev => {
                                        const updated = prev.map(p => p.id === activePromptId ? { ...p, content: e.target.value } : p);
                                        localStorage.setItem('ai_assistant_prompts', JSON.stringify(updated));
                                        return updated;
                                    });
                                }}
                                className="w-full h-48 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono resize-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Enter system instructions..."
                            />
                        </div>
                    </details>

                    {/* Model Selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            Model
                            {isModelLoading && <span className="text-[10px] text-indigo-500 font-normal ml-auto">Loading...</span>}
                        </label>
                        <select
                            className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                        >
                            {models.length === 0 && <option value="">No models found</option>}
                            {models.map(m => (
                                <option key={m.id} value={m.id}>{m.id}</option>
                            ))}
                        </select>
                        <button
                            onClick={fetchModels}
                            className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-1 mt-1 justify-end w-full"
                        >
                            <RefreshCw size={12} /> Refresh Models
                        </button>
                    </div>

                    {/* Options */}
                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                        {/* Server Config */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Server Address
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={serverConfig.host}
                                    onChange={(e) => setServerConfig(prev => ({ ...prev, host: e.target.value }))}
                                    className="flex-1 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                    placeholder="http://localhost"
                                />
                                <input
                                    type="text"
                                    value={serverConfig.port}
                                    onChange={(e) => setServerConfig(prev => ({ ...prev, port: e.target.value }))}
                                    className="w-16 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                    placeholder="1234"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 cursor-pointer group select-none">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${!sendOnEnter ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                                    {!sendOnEnter && <Check size={10} className="text-white" />}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={!sendOnEnter}
                                    onChange={toggleSendOnEnter}
                                />
                                <span className="text-xs text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                    Press Enter for Newline
                                </span>
                            </label>
                            <p className="text-[10px] text-slate-400 pl-6 leading-tight mt-1">
                                {!sendOnEnter ? "Shift+Enter sends the message." : "Enter sends the message."}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="p-4 text-center border-t border-slate-200 dark:border-slate-800 shrink-0">
                    <p className="text-[10px] text-slate-400 dark:text-slate-600 uppercase tracking-wider font-bold">
                        Local AI Assistant
                    </p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full min-w-0 bg-white dark:bg-[#0b0f19] relative">
                {/* System Header */}
                <div className="h-16 shrink-0 title-drag pl-16 pr-36 flex items-center gap-3 border-b border-white/5 bg-[#0f172a]">
                    <div className="p-1 bg-indigo-500/10 rounded-lg text-indigo-400 no-drag"><Bot size={14} className="icon-glow" /></div>
                    <span className="font-bold text-xs text-slate-200 no-drag">AI Assistant</span>
                    <div className="w-px h-3 bg-white/10 mx-1"></div>
                    <div className="flex items-center gap-1 no-drag">
                        <button
                            onClick={handleExportChat}
                            className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded-md transition-colors"
                            title="Export Chat to JSON"
                        >
                            <Download size={14} />
                        </button>
                        <button
                            onClick={handleClear}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                            title="Clear Chat"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div
                    className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth pb-4"
                    onScroll={handleScroll}
                >
                    {messages.filter(m => m.role !== 'system').map((msg, idx) => (
                        <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                                    <Bot size={16} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                            )}

                            <div className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-md transition-shadow select-text ${msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-none'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'
                                }`}>
                                {msg.role === 'user' ? (
                                    <CollapsibleText text={msg.content} />
                                ) : (
                                    <FormattedText text={msg.content} />
                                )}
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                    <User size={16} className="text-slate-500 dark:text-slate-400" />
                                </div>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-4 justify-start">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                                <Bot size={16} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                                </div>
                                <span className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">
                                    Other analysis in progress. Please wait...
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area (Cleaned up) */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/5">
                    {/* Attachments Preview */}
                    {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800">
                            {attachments.map((file, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-900 pl-2 pr-1 py-1 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <FileText size={14} className="text-indigo-500" />
                                    <span className="text-xs text-slate-600 dark:text-slate-300 max-w-[150px] truncate">{file.name}</span>
                                    <button
                                        onClick={() => handleRemoveAttachment(idx)}
                                        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 rounded transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="relative group flex gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            multiple
                            onChange={handleFileSelect}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl transition-colors shrink-0"
                            title="Attach File"
                        >
                            <Paperclip size={20} />
                        </button>

                        <div className="relative">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className={`p-3 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl transition-colors shrink-0 ${showHistory ? 'bg-slate-200 dark:bg-slate-700 text-indigo-500' : 'bg-slate-100 dark:bg-slate-800'}`}
                                title="History (Last 10 prompts)"
                            >
                                <History size={20} />
                            </button>

                            {/* History Popover (Position fixed relative to parent to pop UP) */}
                            {showHistory && promptHistory.length > 0 && (
                                <div className="absolute bottom-full left-0 mb-2 w-72 max-h-[300px] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 p-1">
                                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2 py-1 uppercase tracking-wider">Recent Prompts</div>
                                    {promptHistory.map((h, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setInput(h);
                                                setShowHistory(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg truncate transition-colors"
                                            title={h}
                                        >
                                            {h}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showHistory && promptHistory.length === 0 && (
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 p-3 text-center">
                                    <span className="text-xs text-slate-400">No history yet</span>
                                </div>
                            )}
                        </div>

                        <div className="relative flex-1">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    const isEnter = e.key === 'Enter';
                                    const isShift = e.shiftKey;

                                    if (isEnter) {
                                        if (sendOnEnter) {
                                            if (!isShift) {
                                                e.preventDefault();
                                                handleSubmit();
                                            }
                                        } else {
                                            if (isShift) {
                                                e.preventDefault();
                                                handleSubmit();
                                            }
                                        }
                                    }
                                }}
                                placeholder={sendOnEnter ? "Enter to send, Shift+Enter for newline" : "Shift+Enter to send, Enter for newline"}
                                className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 shadow-sm min-h-[50px] max-h-[200px]"
                                rows={1}
                                style={{ height: 'auto', minHeight: '52px' }}
                            />
                            <button
                                onClick={isLoading ? handleStop : () => handleSubmit()}
                                disabled={(!input.trim() && attachments.length === 0) && !isLoading}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all duration-200 shadow-sm ${isLoading
                                    ? 'bg-red-500 hover:bg-red-600 text-white hover:scale-105 active:scale-95'
                                    : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white disabled:shadow-none'
                                    }`}
                                title={isLoading ? "Stop Generation" : "Send Message"}
                            >
                                {isLoading ? <StopCircle size={18} className="animate-pulse" /> : <Send size={18} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {ContextMenuComponent}
        </div>
    );
};

export default AiAssistant;
