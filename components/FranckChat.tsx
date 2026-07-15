
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Bot, Send, X, Sparkles, Calendar, FileText, DollarSign, Clock, Lightbulb, Mic, MicOff, CreditCard, AlertTriangle, Mail, Coffee, CheckSquare, Zap, Code2, ChevronDown, Copy, CheckCircle2, Users } from 'lucide-react';
import { QueryClient } from '@tanstack/react-query';

import { ChatMessage, Project, CalendarEvent } from '../types';

import { createChatSession, fetchFranckData, clearFranckData, fetchFranckSuggestions, transcribeAudioBlob, type FranckSuggestion } from '../services/geminiService';
import { useFranckGreeting } from '../services/queries';
import { wpGlossaryLookup } from './WpGlossary';
import { CodeReviewPanel } from './CodeReviewPanel';

// @ts-ignore
import franckAvatar from '../assets/franck-avatar.png';

// Franck Avatar Component
const FranckAvatar: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
    <img src={franckAvatar} alt="Franck" className={`${className} rounded-full object-cover`} />
);



interface FranckChatProps {

    isOpen: boolean;

    onClose: () => void;

    projects?: Project[];

    events?: CalendarEvent[];

    todos?: any[];

    onAddTodo?: (todo: any) => void;

    onAddEvent?: (event: CalendarEvent) => void;

    queryClient?: QueryClient;

}



function formatFranckMessage(text: string, codeMode = false): string {
    if (!text) return '';

    // Handle fenced code blocks first (before escaping)
    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
    const parts: { type: 'text' | 'code'; content: string; lang: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.slice(lastIndex, match.index), lang: '' });
        }
        parts.push({ type: 'code', content: match[2] || '', lang: match[1] || '' });
        lastIndex = codeBlockRegex.lastIndex;
    }
    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.slice(lastIndex), lang: '' });
    }

    if (parts.length === 0 || (parts.length === 1 && parts[0].type === 'text')) {
        // No code blocks — use standard formatting
        let html = text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code class="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs font-mono">$1</code>');

        const lines = html.split('\n');
        const result: string[] = [];
        let inList = false;

        for (const line of lines) {
            const bulletMatch = line.match(/^(\s*)[•\-\*]\s+(.+)/);
            const numberMatch = line.match(/^(\s*)\d+[\.\)]\s+(.+)/);
            if (bulletMatch || numberMatch) {
                if (!inList) { result.push('<ul class="space-y-1 my-1.5">'); inList = true; }
                const content = bulletMatch ? bulletMatch[2] : numberMatch![2];
                result.push(`<li class="flex items-start gap-1.5"><span class="text-brand-orange mt-0.5 shrink-0">•</span><span>${content}</span></li>`);
            } else {
                if (inList) { result.push('</ul>'); inList = false; }
                if (line.trim() === '') {
                    result.push('<div class="h-2"></div>');
                } else {
                    result.push(`<p class="leading-relaxed">${line}</p>`);
                }
            }
        }
        if (inList) result.push('</ul>');
        return result.join('');
    }

    // Mixed content with code blocks
    return parts.map(part => {
        if (part.type === 'code') {
            const escaped = part.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const lang = part.lang ? `<span class="text-[10px] text-slate-400 ml-auto">${part.lang}</span>` : '';
            return `<div class="my-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                <div class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <span class="text-[10px] font-bold text-slate-500">CODE</span>${lang}
                </div>
                <pre class="p-3 overflow-x-auto text-xs font-mono bg-slate-950 text-slate-100 dark:text-slate-200 leading-relaxed">${escaped}</pre>
            </div>`;
        }
        // Text part
        let html = part.content
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code class="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs font-mono">$1</code>');
        return `<p class="leading-relaxed">${html.replace(/\n/g, '<br/>')}</p>`;
    }).join('');
}

const CODE_COMMANDS = [
    { cmd: '/review', label: '🔍 Review', prompt: 'Analyse ce code, identifie les problèmes et suggère des améliorations :\n\n' },
    { cmd: '/optimize', label: '⚡ Optimize', prompt: 'Optimise ce code pour de meilleures performances et lisibilité :\n\n' },
    { cmd: '/tailwind', label: '🎨 Tailwind', prompt: 'Convertis ce code CSS en classes Tailwind CSS. Garde les mêmes effets visuels :\n\n' },
    { cmd: '/component', label: '🧩 Component', prompt: 'Transforme ce code en un composant React réutilisable avec TypeScript et Tailwind :\n\n' },
];

export const FranckChat: React.FC<FranckChatProps> = ({ isOpen, onClose, projects = [], events = [], todos = [], onAddTodo, onAddEvent, queryClient }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const routeClientContext = useMemo(() => {
        const m = location.pathname.match(/^\/client\/([^/]+)/);
        if (!m) return null;
        const id = decodeURIComponent(m[1]);
        const p = projects.find((pr) => pr.id === id);
        if (!p) return null;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return {
            projectId: p.id,
            clientName: p.clientName,
            openInvoices: p.invoices.filter((i) => i.status !== 'Paid' && i.type === 'Invoice').length,
            overdueInvoices: p.invoices.filter(
                (i) =>
                    i.status !== 'Paid' &&
                    i.dueDate &&
                    new Date(i.dueDate + 'T12:00:00') < todayStart,
            ).length,
            urgentTasks: p.tasks.filter((t) => !t.completed && t.priority === 'High').length,
        };
    }, [location.pathname, projects]);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [thinkingLabel, setThinkingLabel] = useState('');
    const [codeMode, setCodeModeState] = useState<boolean>(() => {
        try { return localStorage.getItem('franck_code_mode') === 'true'; } catch { return false; }
    });
    const [showClaudeReview, setShowClaudeReview] = useState(false);
    const setCodeMode = (updater: boolean | ((prev: boolean) => boolean)) => {
        setCodeModeState(prev => {
            const next = typeof updater === 'function' ? (updater as (p: boolean) => boolean)(prev) : updater;
            try { localStorage.setItem('franck_code_mode', String(next)); } catch {}
            return next;
        });
    };
    const [showCodeCommands, setShowCodeCommands] = useState(false);
    const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);

    const chatSession = useRef<any>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const [showQuickActions, setShowQuickActions] = useState(true);
    
    const [isListening, setIsListening] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const silenceTimerRef = useRef<number | null>(null);
    const voiceMonitorRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const recordingStartedAtRef = useRef(0);
    const stoppingVoiceRef = useRef(false);

    
    const [dynamicSuggestions, setDynamicSuggestions] = useState<FranckSuggestion[]>([]);

    const isMenuCommand = (value: string) => {
        const v = value.trim().toLowerCase();
        return v === 'menu' || v === '/menu';
    };

    const suggestionIconMap: Record<string, any> = {
        'credit-card': CreditCard,
        'alert-triangle': AlertTriangle,
        'file-text': FileText,
        'mail': Mail,
        'calendar': Calendar,
        'coffee': Coffee,
        'check-square': CheckSquare,
    };

    const suggestionColorMap: Record<string, string> = {
        'high': 'border-red-300 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
        'medium': 'border-orange-300 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
        'low': 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    };

    const quickActions = useMemo(() => {
        const base: { icon: typeof Calendar; label: string; prompt: string }[] = [
            { icon: Calendar, label: 'Agenda', prompt: 'Comment se présente ma journée ?' },
            { icon: DollarSign, label: 'Finances', prompt: 'Comment vont mes finances ?' },
            { icon: FileText, label: 'Tâches', prompt: 'Quelles sont mes tâches prioritaires ?' },
            { icon: Lightbulb, label: 'Conseils', prompt: 'Tu as des suggestions pour moi ?' },
        ];
        if (routeClientContext) {
            return [
                {
                    icon: Users,
                    label: 'Ce client',
                    prompt: `Tu es sur la fiche client "${routeClientContext.clientName}". Résume la situation : factures ouvertes ${routeClientContext.openInvoices}, factures en retard ${routeClientContext.overdueInvoices}, tâches urgentes ${routeClientContext.urgentTasks}. Propose une prochaine action concrète.`,
                },
                ...base,
            ];
        }
        return base;
    }, [routeClientContext]);

    const getAppContext = () => ({
        projects: projects.map((p) => ({
            id: p.id,
            clientName: p.clientName,
            status: p.status,
            phase: p.phase,
            invoices: p.invoices,
            tasks: p.tasks,
        })),
        events: events.slice(0, 20),
        todos: todos,
        routePath: location.pathname,
        routeSearch: location.search,
        activeClient: routeClientContext,
    });

    const stopMicStream = () => {
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((t) => t.stop());
            micStreamRef.current = null;
        }
        if (voiceMonitorRef.current != null) {
            window.clearInterval(voiceMonitorRef.current);
            voiceMonitorRef.current = null;
        }
        if (silenceTimerRef.current != null) {
            window.clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (audioContextRef.current) {
            void audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            try {
                if (mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
            } catch {
                // ignore
            }
            stopMicStream();
        };
    }, []);

    // Text-to-Speech function
    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'fr-FR';
            utterance.rate = 0.95;
            utterance.pitch = 0.9;

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);

            window.speechSynthesis.speak(utterance);
        }
    };

    const submitVoiceText = (cleaned: string) => {
        setShowQuickActions(false);
        setInput('');
        const userMsg: ChatMessage = { role: 'user', text: cleaned, timestamp: new Date() };
        setMessages((prev) => {
            const next = [...prev, userMsg];
            queueMicrotask(() => {
                void sendMessage(cleaned, next);
            });
            return next;
        });
    };

    const processVoiceBlob = async (blob: Blob, mimeType: string) => {
        setIsListening(false);
        setVoiceStatus('Je transcris ta voix…');
        try {
            if (blob.size < 400) {
                setVoiceStatus('Trop court — maintiens le micro et parle 1–2 secondes.');
                return;
            }
            const text = await transcribeAudioBlob(blob, mimeType);
            setVoiceStatus(null);
            setInput(text);
            submitVoiceText(text);
        } catch (err: any) {
            console.error('Voice transcription failed:', err);
            setVoiceStatus(err?.message || 'Transcription impossible — réessaie.');
        } finally {
            stopMicStream();
            mediaRecorderRef.current = null;
            stoppingVoiceRef.current = false;
        }
    };

    const stopVoiceRecording = () => {
        if (stoppingVoiceRef.current) return;
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === 'inactive') {
            setIsListening(false);
            stopMicStream();
            return;
        }
        stoppingVoiceRef.current = true;
        setVoiceStatus('Je transcris ta voix…');
        try {
            recorder.stop();
        } catch (err) {
            console.error(err);
            stoppingVoiceRef.current = false;
            setIsListening(false);
            stopMicStream();
            setVoiceStatus('Erreur micro — réessaie.');
        }
    };

    const pickRecorderMime = (): string => {
        const candidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
        ];
        for (const type of candidates) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return '';
    };

    const startSilenceMonitor = (stream: MediaStream) => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            const data = new Uint8Array(analyser.fftSize);
            let heardSpeech = false;

            voiceMonitorRef.current = window.setInterval(() => {
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i++) {
                    const v = (data[i] - 128) / 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / data.length);
                const elapsed = Date.now() - recordingStartedAtRef.current;

                if (rms > 0.045) {
                    heardSpeech = true;
                    if (silenceTimerRef.current != null) {
                        window.clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                    }
                    setVoiceStatus('Je t’écoute… (reclique le micro pour envoyer)');
                } else if (heardSpeech && elapsed > 900 && silenceTimerRef.current == null) {
                    // Auto-stop ~1.2s after silence once speech was detected
                    silenceTimerRef.current = window.setTimeout(() => {
                        stopVoiceRecording();
                    }, 1200);
                } else if (!heardSpeech && elapsed > 10000) {
                    stopVoiceRecording();
                }
            }, 120);
        } catch (err) {
            console.warn('Silence monitor unavailable:', err);
        }
    };

    const toggleVoiceRecognition = async () => {
        if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            setVoiceStatus('Dictée non supportée ici — ouvre Marion dans Chrome.');
            return;
        }

        if (isListening || mediaRecorderRef.current?.state === 'recording') {
            stopVoiceRecording();
            return;
        }

        setVoiceStatus('Autorisation micro…');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            micStreamRef.current = stream;

            const mimeType = pickRecorderMime();
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            stoppingVoiceRef.current = false;
            recordingStartedAtRef.current = Date.now();

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onerror = () => {
                setIsListening(false);
                stopMicStream();
                setVoiceStatus('Erreur d’enregistrement micro.');
                mediaRecorderRef.current = null;
                stoppingVoiceRef.current = false;
            };

            recorder.onstop = () => {
                const usedType = recorder.mimeType || mimeType || 'audio/webm';
                const blob = new Blob(audioChunksRef.current, { type: usedType });
                audioChunksRef.current = [];
                void processVoiceBlob(blob, usedType);
            };

            recorder.start(250);
            setIsListening(true);
            setVoiceStatus('Écoute… parle maintenant');
            startSilenceMonitor(stream);
        } catch (err: any) {
            const name = String(err?.name || err?.message || 'not-allowed');
            stopMicStream();
            if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
                setVoiceStatus('Micro bloqué — autorise le micro pour ce site (127.0.0.1).');
            } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
                setVoiceStatus('Aucun micro détecté sur ce Mac.');
            } else {
                setVoiceStatus('Impossible d’accéder au micro.');
            }
        }
    };
    
    // Fetch contextual greeting via React Query
    const { data: greetingData } = useFranckGreeting();
    
    useEffect(() => {
        if (greetingData?.greeting) {
            setMessages(prev => {
                // Only set greeting if we don't have messages yet or just have the initial one
                if (prev.length <= 1) {
                    return [{ role: 'model', text: greetingData.greeting, timestamp: new Date() }];
                }
                return prev;
            });
        }
    }, [greetingData]);

    useEffect(() => {

        if (!chatSession.current) {

            chatSession.current = createChatSession(getAppContext);

        }

    }, []);
    
    useEffect(() => {
        chatSession.current = createChatSession(getAppContext);
    }, [projects, events, todos, location.pathname, location.search, routeClientContext]);

    // Fetch proactive suggestions when chat opens (live app context)
    useEffect(() => {
        if (isOpen && messages.length <= 1) {
            fetchFranckSuggestions({
                projects: projects.map((p) => ({
                    id: p.id,
                    clientName: p.clientName,
                    status: p.status,
                    phase: p.phase,
                    invoices: p.invoices,
                    tasks: p.tasks,
                    profile: (p as any).profile,
                    email: (p as any).email,
                })),
                events: events.slice(0, 40),
                todos,
            }).then((data) => {
                if (data.suggestions && data.suggestions.length > 0) {
                    setDynamicSuggestions(data.suggestions);
                }
            });
        }
    }, [isOpen, projects, events, todos, messages.length]);

    // Seed prompt from Today page / external CTA
    useEffect(() => {
        if (!isOpen) return;
        try {
            const seed = sessionStorage.getItem('franck_seed_prompt');
            if (seed) {
                sessionStorage.removeItem('franck_seed_prompt');
                setShowQuickActions(false);
                setTimeout(() => {
                    const userMsg: ChatMessage = { role: 'user', text: seed, timestamp: new Date() };
                    setMessages((prev) => {
                        const next = [...prev, userMsg];
                        queueMicrotask(() => {
                            void sendMessage(seed, next);
                        });
                        return next;
                    });
                }, 200);
            }
        } catch {
            // ignore
        }
    }, [isOpen]);
    
    // Sync Franck's created data after each message + invalidate React Query caches
    const syncFranckData = async () => {
        const data = await fetchFranckData();
        
        if (data.todos && data.todos.length > 0 && onAddTodo) {
            data.todos.forEach((todo: any) => onAddTodo(todo));
        }
        
        if (data.events && data.events.length > 0 && onAddEvent) {
            data.events.forEach((event: any) => onAddEvent(event));
        }

        const actions = data.actions_performed || [];
        if (queryClient && actions.length > 0) {
            await new Promise(r => setTimeout(r, 1500));
            if (actions.includes('projects')) {
                await queryClient.refetchQueries({ queryKey: ['projects'] });
            }
            if (actions.includes('events')) {
                await queryClient.refetchQueries({ queryKey: ['events'] });
                await queryClient.refetchQueries({ queryKey: ['calendar', 'sync'] });
            }
        }
        
        const hasData = (data.todos?.length > 0 || data.events?.length > 0 || actions.length > 0);
        if (hasData) {
            await clearFranckData();
        }
    };
    
    // Handle quick action click
    const handleQuickAction = (prompt: string) => {
        setInput(prompt);
        setShowQuickActions(false);
        setTimeout(() => {
            setInput('');
            const userMsg: ChatMessage = { role: 'user', text: prompt, timestamp: new Date() };
            setMessages(prev => [...prev, userMsg]);
            sendMessage(prompt, [...messages, userMsg]);
        }, 100);
    };

    const handleSuggestionClick = (suggestion: FranckSuggestion) => {
        if (suggestion.action === 'remind') {
            const amount = suggestion.amount != null ? String(suggestion.amount) : '';
            const currency = suggestion.currency || 'CHF';
            navigate('/emails', {
                state: {
                    compose: {
                        to: suggestion.toEmail || '',
                        subject: `Relance facture ${suggestion.invoiceNumber || ''} — ${suggestion.clientName || ''}`.trim(),
                        body:
                            `Bonjour,\n\n` +
                            `Sauf erreur de ma part, la facture ${suggestion.invoiceNumber || ''} ` +
                            `(${amount} ${currency}) échue le ${suggestion.dueDate || '—'} ` +
                            `est toujours en attente de règlement.\n\n` +
                            `Merci de faire le nécessaire.\n\nCordialement,\nMarion`,
                        invoiceHint: {
                            projectId: suggestion.projectId,
                            invoiceId: suggestion.invoiceId,
                            invoiceNumber: suggestion.invoiceNumber,
                            clientName: suggestion.clientName,
                            amount: suggestion.amount,
                            currency,
                            dueDate: suggestion.dueDate,
                        },
                    },
                },
            });
            onClose();
            return;
        }
        handleQuickAction(suggestion.prompt);
    };
    
    // Extracted send logic for reuse
    const sendMessage = async (text: string, history: ChatMessage[]) => {
        if (!chatSession.current) return;
        
        setIsThinking(true);
        setThinkingLabel('');

        const workingTimer = setTimeout(() => {
            setThinkingLabel('Franck travaille...');
        }, 2500);
        
        try {
            const result = await chatSession.current.sendMessageStream({ history });
            
            let fullText = '';
            setMessages(prev => [...prev, { role: 'model', text: '', timestamp: new Date() }]);
            clearTimeout(workingTimer);
            setThinkingLabel('');
            
            for await (const chunk of result) {
                const chunkText = chunk.text;
                if (chunkText) {
                    fullText += chunkText;
                    setMessages(prev => {
                        const newArr = [...prev];
                        newArr[newArr.length - 1].text = fullText;
                        return newArr;
                    });
                }
            }
        } catch (error) {
            clearTimeout(workingTimer);
            const errorMsg = "Aïe mes vieux os... J'ai eu un petit souci technique là. Réessaie ma belle ! 🔧";
            setMessages(prev => [...prev, { role: 'model', text: errorMsg, timestamp: new Date() }]);
        } finally {
            clearTimeout(workingTimer);
            setIsThinking(false);
            setThinkingLabel('');
            await syncFranckData();
        }
    };

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    }, [messages, isThinking]);



    const handleSend = async () => {

        if (!input.trim() || !chatSession.current) return;

        // Local slash command: /wp <terme> -> WP glossary lookup
        const wpMatch = input.trim().match(/^\/wp\s+(.+)$/i);
        if (wpMatch) {
            const term = wpMatch[1].trim();
            const userMsg: ChatMessage = { role: 'user', text: input, timestamp: new Date() };
            setMessages(prev => [...prev, userMsg]);
            setInput('');
            try {
                const entry = await wpGlossaryLookup(term);
                const reply = `**${entry.wp_term}** → ${entry.modern_equivalent}\n\n${entry.wp_definition}\n\n\`\`\`${entry.code_lang || 'tsx'}\n${entry.code_example}\n\`\`\`\n\n💡 **Piège** : ${entry.pitfall}${entry.doc_url ? `\n\n📖 [Documentation](${entry.doc_url})` : ''}`;
                setMessages(prev => [...prev, { role: 'model', text: reply, timestamp: new Date() }]);
            } catch (e: any) {
                setMessages(prev => [...prev, {
                    role: 'model',
                    text: `Désolé, je n'ai pas pu trouver "${term}" dans le glossaire WP. ${e?.message || ''}`,
                    timestamp: new Date(),
                }]);
            }
            return;
        }

        // Local command: show Franck menu again without resetting history.
        if (isMenuCommand(input)) {
            const userMsg: ChatMessage = { role: 'user', text: input, timestamp: new Date() };
            setMessages(prev => [...prev, userMsg]);
            setInput('');
            setShowQuickActions(true);
            fetchFranckSuggestions().then(data => {
                if (data.suggestions && data.suggestions.length > 0) {
                    setDynamicSuggestions(data.suggestions);
                }
            }).catch(() => {});
            return;
        }

        setShowQuickActions(false);

        const userMsg: ChatMessage = { role: 'user', text: input, timestamp: new Date() };

        const newHistory = [...messages, userMsg];

        

        setMessages(newHistory);

        setInput('');

        
        await sendMessage(input, newHistory);

    };



    if (!isOpen) return null;



    return (

        <div className="fixed inset-0 md:inset-auto md:top-[105px] md:bottom-4 md:right-4 md:w-[600px] glass md:rounded-3xl shadow-2xl flex flex-col z-40 animate-in slide-in-from-bottom-10 border-0 md:border border-orange-200 dark:border-orange-900">

            {/* Header */}

            <div className="p-4 bg-gradient-to-r from-brand-orange to-pink-600 md:rounded-t-3xl flex justify-between items-center text-white">

                <div className="flex items-center gap-4">

                    <div className="bg-white/20 p-1 rounded-full overflow-hidden shrink-0 border-2 border-white/30">

                        <FranckAvatar className="w-14 h-14" />

                    </div>

                    <div>

                        <h3 className="font-serif text-xl font-bold leading-none">Franck</h3>

                        <span className="text-xs opacity-90 font-medium">63 ans, chauve et fier 👴</span>

                    </div>

                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCodeMode(m => !m)}
                        title={codeMode ? 'Passer en mode chat' : 'Passer en mode Code Review'}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            codeMode ? 'bg-violet-600 text-white shadow-inner' : 'bg-white/20 text-white/80 hover:bg-white/30'
                        }`}
                    >
                        <Code2 size={13} /> {codeMode ? 'Code' : '</>'}
                    </button>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={20} /></button>
                </div>

            </div>



            {/* Messages */}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {messages.map((msg, idx) => (

                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                        {msg.role === 'model' && (
                            <FranckAvatar className="w-8 h-8 mr-2 self-end mb-1" />
                        )}

                        {msg.role === 'user' ? (
                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm bg-orange-100 text-orange-900 rounded-br-none ${codeMode ? 'font-mono text-xs whitespace-pre-wrap' : 'whitespace-pre-wrap'}`}>
                                {msg.text}
                            </div>
                        ) : (
                            <div className="relative group max-w-[85%]">
                                <div className="p-4 rounded-2xl text-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm rounded-bl-none franck-message"
                                    dangerouslySetInnerHTML={{ __html: formatFranckMessage(msg.text, codeMode) }}
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(msg.text);
                                        setCopiedMsgIdx(idx);
                                        setTimeout(() => setCopiedMsgIdx(null), 2000);
                                    }}
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-slate-600 transition-all"
                                >
                                    {copiedMsgIdx === idx ? <CheckCircle2 size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                </button>
                            </div>
                        )}

                    </div>

                ))}
                
                {/* Dynamic Suggestions or Static Quick Actions */}
                {showQuickActions && !isThinking && (
                    <div className="mt-4">
                        {dynamicSuggestions.length > 0 ? (
                            <>
                                <p className="text-xs text-slate-400 mb-2 text-center flex items-center justify-center gap-1">
                                    <Zap size={12} /> Suggestions de Franck
                                </p>
                                <div className="flex flex-col gap-2">
                                    {dynamicSuggestions.map((suggestion, idx) => {
                                        const SuggIcon = suggestionIconMap[suggestion.icon] || Lightbulb;
                                        const colorClass = suggestionColorMap[suggestion.priority] || suggestionColorMap.low;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => handleSuggestionClick(suggestion)}
                                                className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left text-xs leading-tight hover:scale-[1.02] ${colorClass}`}
                                            >
                                                <SuggIcon size={15} className="shrink-0" />
                                                <span className="flex-1">{suggestion.text}</span>
                                                {suggestion.action === 'remind' && (
                                                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide opacity-80">Email</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="grid grid-cols-4 gap-1.5 mt-3">
                                    {quickActions.map((action, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleQuickAction(action.prompt)}
                                            className="flex flex-col items-center gap-1 p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-orange transition-all text-[10px] text-slate-500"
                                        >
                                            <action.icon size={14} className="text-brand-orange" />
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-xs text-slate-400 mb-2 text-center">Actions rapides</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {quickActions.map((action, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleQuickAction(action.prompt)}
                                            className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-orange hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all text-sm text-slate-600 dark:text-slate-300"
                                        >
                                            <action.icon size={16} className="text-brand-orange" />
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {isThinking && (

                    <div className="flex justify-start items-center">
                        <FranckAvatar className="w-8 h-8 mr-2" />
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-brand-orange rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-brand-orange rounded-full animate-bounce delay-75"></span>
                                <span className="w-2 h-2 bg-brand-orange rounded-full animate-bounce delay-150"></span>
                            </div>
                            {thinkingLabel && (
                                <span className="text-xs text-slate-400 ml-1 animate-pulse">{thinkingLabel}</span>
                            )}
                        </div>

                    </div>

                )}

                <div ref={messagesEndRef} />

            </div>



            {/* Input */}
            <div className="p-4 border-t border-white/50 dark:border-white/10 space-y-2">
                {/* Code commands bar */}
                {codeMode && (
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                        {CODE_COMMANDS.map(cc => (
                            <button
                                key={cc.cmd}
                                onClick={() => setInput(prev => cc.prompt + prev)}
                                className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-bold hover:bg-violet-200 dark:hover:bg-violet-900/60 transition-colors"
                                title={cc.cmd}
                            >
                                {cc.label}
                            </button>
                        ))}
                        <button
                            onClick={() => setShowClaudeReview(true)}
                            className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[10px] font-bold hover:brightness-110 transition-all"
                            title="Review approfondie via Claude Opus 4.7"
                        >
                            🦾 Claude Opus
                        </button>
                    </div>
                )}

                <div className="relative">
                    {codeMode ? (
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
                            }}
                            placeholder="Colle ton code ici... (Ctrl+Entrée pour envoyer)"
                            rows={5}
                            className="w-full bg-slate-950 text-slate-100 dark:bg-slate-900 rounded-xl py-3 pl-4 pr-14 focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-500 text-xs font-mono resize-none"
                            autoFocus
                        />
                    ) : (
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Demande quelque chose à Franck..."
                            className="w-full bg-white/50 dark:bg-slate-800/50 rounded-xl py-3 pl-4 pr-24 focus:outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400"
                            autoFocus
                        />
                    )}

                    <div className={`absolute right-2 flex gap-1 ${codeMode ? 'bottom-2' : 'top-2'}`}>
                        {!codeMode && (
                            <button
                                onClick={() => { void toggleVoiceRecognition(); }}
                                disabled={isThinking}
                                className={`p-1.5 rounded-lg transition-all ${
                                    isListening
                                        ? 'bg-red-500 text-white animate-pulse'
                                        : 'bg-purple-500 text-white hover:bg-purple-600'
                                } disabled:opacity-50`}
                                title={isListening ? 'Arrêter et envoyer' : 'Parler à Franck (enregistre ta voix)'}
                            >
                                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                            </button>
                        )}
                        <button
                            onClick={handleSend}
                            className={`p-1.5 text-white rounded-lg transition-colors ${codeMode ? 'bg-violet-600 hover:bg-violet-700' : 'bg-brand-orange hover:bg-orange-600'}`}
                        >
                            {input.length > 0 ? <Send size={16} /> : <Sparkles size={16} />}
                        </button>
                    </div>
                </div>
                {voiceStatus && !codeMode && (
                    <p className={`text-[11px] text-center font-medium ${
                        isListening ? 'text-purple-600 dark:text-purple-300' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                        {voiceStatus}
                    </p>
                )}
                {codeMode && (
                    <p className="text-[10px] text-slate-400 text-center">Mode Code Review actif · Ctrl+Entrée pour envoyer</p>
                )}
            </div>

            {showClaudeReview && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <h3 className="font-bold text-sm text-slate-800 dark:text-white">Code Review (Claude Opus 4.7)</h3>
                            <button onClick={() => setShowClaudeReview(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                        </div>
                        <div className="p-4">
                            <CodeReviewPanel initialCode={input} compact />
                        </div>
                    </div>
                </div>
            )}

        </div>

    );

};
