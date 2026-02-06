
import React, { useState, useEffect, useRef } from 'react';

import { Bot, Send, X, Sparkles, Calendar, FileText, DollarSign, Clock, Lightbulb, Mic, MicOff } from 'lucide-react';

import { ChatMessage, Project, CalendarEvent } from '../types';

import { createChatSession, fetchFranckData, clearFranckData } from '../services/geminiService';
import { apiFetch } from '../services/api';

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

}



export const FranckChat: React.FC<FranckChatProps> = ({ isOpen, onClose, projects = [], events = [], todos = [], onAddTodo, onAddEvent }) => {

    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const [input, setInput] = useState('');

    const [isThinking, setIsThinking] = useState(false);

    const chatSession = useRef<any>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const [showQuickActions, setShowQuickActions] = useState(true);
    
    const [isListening, setIsListening] = useState(false);
    
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    const recognitionRef = useRef<any>(null);

    
    // Quick actions for common tasks
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
    
    // Fetch contextual greeting on mount
    useEffect(() => {
        const fetchGreeting = async () => {
            try {
                const res = await apiFetch('/api/franck/greeting');
                const data = await res.json();
                const greeting = data.greeting;
                setMessages([{ role: 'model', text: greeting, timestamp: new Date() }]);
            } catch (e) {
                const fallbackGreeting = 'Salut ma belle ! C\'est Franck. Qu\'est-ce que je peux faire pour toi ? 👴';
                setMessages([{ role: 'model', text: fallbackGreeting, timestamp: new Date() }]);
            }
        };
        fetchGreeting();
    }, []);

    useEffect(() => {

        if (!chatSession.current) {

            chatSession.current = createChatSession(getAppContext);

        }

    }, []);
    
    // Update chat session when context changes
    useEffect(() => {
        chatSession.current = createChatSession(getAppContext);
    }, [projects, events, todos]);
    
    // Sync Franck's created data after each message
    const syncFranckData = async () => {
        const data = await fetchFranckData();
        
        if (data.todos && data.todos.length > 0 && onAddTodo) {
            data.todos.forEach((todo: any) => onAddTodo(todo));
        }
        
        if (data.events && data.events.length > 0 && onAddEvent) {
            data.events.forEach((event: any) => onAddEvent(event));
        }
        
        // Clear after syncing
        if (data.todos?.length > 0 || data.events?.length > 0) {
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
        
        try {
            const result = await chatSession.current.sendMessageStream({ history });
            
            let fullText = '';
            setMessages(prev => [...prev, { role: 'model', text: '', timestamp: new Date() }]);
            
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
            const errorMsg = "Aïe mes vieux os... J'ai eu un petit souci technique là. Réessaie ma belle ! 🔧";
            setMessages(prev => [...prev, { role: 'model', text: errorMsg, timestamp: new Date() }]);
        } finally {
            setIsThinking(false);
            await syncFranckData();
        }
    };



    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    }, [messages, isThinking]);



    const handleSend = async () => {

        if (!input.trim() || !chatSession.current) return;

        
        setShowQuickActions(false);

        const userMsg: ChatMessage = { role: 'user', text: input, timestamp: new Date() };

        const newHistory = [...messages, userMsg];

        

        setMessages(newHistory);

        setInput('');

        
        await sendMessage(input, newHistory);

    };



    if (!isOpen) return null;



    return (

        <div className="fixed bottom-6 right-6 w-96 h-[500px] glass rounded-3xl shadow-2xl flex flex-col z-40 animate-in slide-in-from-bottom-10 border border-orange-200 dark:border-orange-900">

            {/* Header */}

            <div className="p-4 bg-gradient-to-r from-brand-orange to-pink-600 rounded-t-3xl flex justify-between items-center text-white">

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

                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-orange-100 text-orange-900 rounded-br-none' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm rounded-bl-none'}`}>

                            {msg.text}

                        </div>

                    </div>

                ))}
                
                {/* Quick Actions */}
                {showQuickActions && messages.length <= 1 && !isThinking && (
                    <div className="mt-4">
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
                    </div>
                )}

                {isThinking && (

                    <div className="flex justify-start items-center">
                        <FranckAvatar className="w-8 h-8 mr-2" />
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none shadow-sm flex gap-1">

                            <span className="w-2 h-2 bg-brand-orange rounded-full animate-bounce"></span>

                            <span className="w-2 h-2 bg-brand-orange rounded-full animate-bounce delay-75"></span>

                            <span className="w-2 h-2 bg-brand-orange rounded-full animate-bounce delay-150"></span>

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
