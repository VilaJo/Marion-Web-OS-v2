
import React, { useState, useEffect, useRef } from 'react';

import { Bot, Send, X, Sparkles, Calendar, FileText, DollarSign, Clock, Lightbulb, Mic, MicOff, CreditCard, AlertTriangle, Mail, Coffee, CheckSquare, Zap } from 'lucide-react';
import { QueryClient } from '@tanstack/react-query';

import { ChatMessage, Project, CalendarEvent } from '../types';

import { createChatSession, fetchFranckData, clearFranckData, fetchFranckSuggestions } from '../services/geminiService';
import { useFranckGreeting } from '../services/queries';

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



function formatFranckMessage(text: string): string {
    if (!text) return '';
    let html = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs">$1</code>');

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

export const FranckChat: React.FC<FranckChatProps> = ({ isOpen, onClose, projects = [], events = [], todos = [], onAddTodo, onAddEvent, queryClient }) => {

    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const [input, setInput] = useState('');

    const [isThinking, setIsThinking] = useState(false);
    const [thinkingLabel, setThinkingLabel] = useState('');

    const chatSession = useRef<any>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const [showQuickActions, setShowQuickActions] = useState(true);
    
    const [isListening, setIsListening] = useState(false);
    
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    const recognitionRef = useRef<any>(null);

    
    const [dynamicSuggestions, setDynamicSuggestions] = useState<Array<{
        text: string; prompt: string; priority: string; category: string; icon: string;
    }>>([]);

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

    // Static fallback quick actions
    const quickActions = [
        { icon: Calendar, label: 'Agenda', prompt: 'Comment se présente ma journée ?' },
        { icon: DollarSign, label: 'Finances', prompt: 'Comment vont mes finances ?' },
        { icon: FileText, label: 'Tâches', prompt: 'Quelles sont mes tâches prioritaires ?' },
        { icon: Lightbulb, label: 'Conseils', prompt: 'Tu as des suggestions pour moi ?' },
    ];
    
    // Function to get app context
    const getAppContext = () => ({
        projects: projects.map(p => ({
            id: p.id,
            clientName: p.clientName,
            status: p.status,
            phase: p.phase,
            invoices: p.invoices,
            tasks: p.tasks
        })),
        events: events.slice(0, 20), // Limit to avoid too much data
        todos: todos
    });

    // Initialize Speech Recognition
    useEffect(() => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'fr-FR';
            
            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                setIsListening(false);
            };
            
            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
            };
            
            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);
    
    // Text-to-Speech function
    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'fr-FR';
            utterance.rate = 0.95;
            utterance.pitch = 0.9; // Slightly lower pitch for Franck's older voice
            
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            
            window.speechSynthesis.speak(utterance);
        }
    };
    
    // Toggle voice recognition
    const toggleVoiceRecognition = () => {
        if (!recognitionRef.current) {
            alert('La reconnaissance vocale n\'est pas supportée par votre navigateur.');
            return;
        }
        
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            setIsListening(true);
            recognitionRef.current.start();
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
    
    // Update chat session when context changes
    useEffect(() => {
        chatSession.current = createChatSession(getAppContext);
    }, [projects, events, todos]);

    // Fetch proactive suggestions when chat opens
    useEffect(() => {
        if (isOpen && messages.length <= 1) {
            fetchFranckSuggestions().then(data => {
                if (data.suggestions && data.suggestions.length > 0) {
                    setDynamicSuggestions(data.suggestions);
                }
            });
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
        // Auto-send after a brief delay
        setTimeout(() => {
            setInput('');
            const userMsg: ChatMessage = { role: 'user', text: prompt, timestamp: new Date() };
            setMessages(prev => [...prev, userMsg]);
            sendMessage(prompt, [...messages, userMsg]);
        }, 100);
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

                <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={20} /></button>

            </div>



            {/* Messages */}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {messages.map((msg, idx) => (

                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                        {msg.role === 'model' && (
                            <FranckAvatar className="w-8 h-8 mr-2 self-end mb-1" />
                        )}

                        {msg.role === 'user' ? (
                            <div className="max-w-[80%] p-3 rounded-2xl text-sm whitespace-pre-wrap bg-orange-100 text-orange-900 rounded-br-none">
                                {msg.text}
                            </div>
                        ) : (
                            <div className="max-w-[85%] p-4 rounded-2xl text-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm rounded-bl-none franck-message"
                                dangerouslySetInnerHTML={{ __html: formatFranckMessage(msg.text) }}
                            />
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
                                                onClick={() => handleQuickAction(suggestion.prompt)}
                                                className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left text-xs leading-tight hover:scale-[1.02] ${colorClass}`}
                                            >
                                                <SuggIcon size={15} className="shrink-0" />
                                                <span>{suggestion.text}</span>
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

            <div className="p-4 border-t border-white/50 dark:border-white/10">

                <div className="relative">

                    <input 

                        type="text" 

                        value={input}

                        onChange={(e) => setInput(e.target.value)}

                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}

                        placeholder="Demande quelque chose à Franck..."

                        className="w-full bg-white/50 dark:bg-slate-800/50 rounded-xl py-3 pl-4 pr-24 focus:outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400"

                        autoFocus // Add autoFocus here

                    />

                    <div className="absolute right-2 top-2 flex gap-1">

                        <button 

                            onClick={toggleVoiceRecognition}

                            className={`p-1.5 rounded-lg transition-all ${
                                isListening 
                                    ? 'bg-red-500 text-white animate-pulse' 
                                    : 'bg-purple-500 text-white hover:bg-purple-600'
                            }`}

                            title={isListening ? 'Arrêter l\'écoute' : 'Parler à Franck'}

                        >

                            {isListening ? <MicOff size={16} /> : <Mic size={16} />}

                        </button>

                        <button 

                            onClick={handleSend}

                            className="p-1.5 bg-brand-orange text-white rounded-lg hover:bg-orange-600 transition-colors"

                        >

                            {input.length > 0 ? <Send size={16} /> : <Sparkles size={16} />}

                        </button>

                    </div>

                </div>

            </div>

        </div>

    );

};
