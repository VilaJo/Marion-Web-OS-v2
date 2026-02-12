import React, { useState, useEffect, useRef } from 'react';
import { X, Volume2, MessageCircle, Send, Sparkles, Target, Brain, Heart, Zap, Coffee } from 'lucide-react';
import { SOUNDS } from '../constants';
import { apiFetch } from '../services/api';

// Quick prompts for Coach Franck
const COACH_PROMPTS = [
    { icon: Target, label: "Focus", prompt: "J'ai du mal à me concentrer, aide-moi à retrouver mon focus." },
    { icon: Brain, label: "Blocage", prompt: "Je suis bloquée créativement, comment débloquer la situation?" },
    { icon: Heart, label: "Stress", prompt: "Je me sens stressée et débordée, j'ai besoin de conseils." },
    { icon: Zap, label: "Motivation", prompt: "J'ai besoin d'un boost de motivation pour avancer." },
    { icon: Coffee, label: "Pause", prompt: "J'hésite à faire une pause, qu'est-ce que tu en penses?" },
];

interface FocusModeProps {
    onExit: () => void;
    currentTask?: string;
    ambientUrl: string | null;
    isAmbientPlaying: boolean;
    ambientVolume: number;
    onSetAmbientUrl: (url: string | null) => void;
    onToggleAmbient: (playing: boolean) => void;
    onSetVolume: (vol: number) => void;
}

export const FocusMode: React.FC<FocusModeProps> = ({ 
    onExit, 
    currentTask,
    ambientUrl,
    isAmbientPlaying,
    ambientVolume,
    onSetAmbientUrl,
    onToggleAmbient,
    onSetVolume
}) => {
    // Determine current sound ID based on URL
    const currentSoundId = SOUNDS.find(s => s.url === ambientUrl)?.id || null;

    const handleSoundToggle = (soundId: string) => {
        const sound = SOUNDS.find(s => s.id === soundId);
        if (!sound) return;

        if (currentSoundId === soundId) {
            onToggleAmbient(!isAmbientPlaying);
        } else {
            onSetAmbientUrl(sound.url);
            onToggleAmbient(true);
        }
    };

    // Chat State (Local)
    const [showChat, setShowChat] = useState(false);
    const [chatHistory, setChatHistory] = useState<{role: 'user'|'model', text: string}[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom
    useEffect(() => {
        if (showChat) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatHistory, isTyping, showChat]);

    const handleSendMessage = async (directMessage?: string) => {
        const userMsg = directMessage || chatInput;
        if (!userMsg.trim()) return;
        
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatInput('');
        setIsTyping(true);

        // Prepare context for Coach Franck
        const context = chatHistory.map(msg => ({ role: msg.role, parts: [msg.text] }));
        
        try {
             const response = await apiFetch('/api/v1/chat/zen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: context, message: userMsg })
            });
            
            if (!response.ok) {
                setChatHistory(prev => [...prev, { role: 'model', text: "Oups, petit souci technique. Respire et réessaie dans quelques secondes. 🔧" }]);
                setIsTyping(false);
                return;
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            
            let fullText = "";
            setChatHistory(prev => [...prev, { role: 'model', text: "" }]);

            if(reader) {
                while(true) {
                    const {done, value} = await reader.read();
                    if(done) break;
                    const chunk = decoder.decode(value);
                    fullText += chunk;
                    setChatHistory(prev => {
                        const newHist = [...prev];
                        newHist[newHist.length - 1].text = fullText;
                        return newHist;
                    });
                }
            }

        } catch (e) {
            console.error(e);
            setChatHistory(prev => [...prev, { role: 'model', text: "Connexion interrompue. Prends une grande respiration et réessaie. 🌿" }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900 text-white flex flex-col items-center justify-center animate-in fade-in duration-700">
            {/* Background Ambience */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-orange/10 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="relative z-10 text-center max-w-2xl w-full px-4">
                
                <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-slate-400 mb-4 md:mb-8 animate-in slide-in-from-top-8 duration-1000">Mode Focus</h2>
                
                <div className="mb-8 md:mb-12">
                    <h1 className="text-3xl sm:text-5xl md:text-7xl font-serif font-bold mb-4 md:mb-6 leading-tight animate-in zoom-in-95 duration-1000">
                        {currentTask || "Créer. Respirer. Avancer."}
                    </h1>
                    {!currentTask && (
                        <p className="text-slate-400 text-sm md:text-lg italic">"La simplicité est la sophistication suprême."</p>
                    )}
                </div>

                {/* Sound Controls */}
                <div className="grid grid-cols-3 md:flex md:items-center md:justify-center gap-4 md:gap-6 mb-8 md:mb-12">
                    {SOUNDS.map(sound => (
                        <button 
                            key={sound.id}
                            onClick={() => handleSoundToggle(sound.id)}
                            className={`flex flex-col items-center gap-2 group transition-all duration-300 ${currentSoundId === sound.id ? 'scale-110' : 'opacity-50 hover:opacity-100'}`}
                        >
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all ${
                                currentSoundId === sound.id && isAmbientPlaying 
                                ? 'border-brand-orange bg-brand-orange/20 text-brand-orange shadow-[0_0_20px_rgba(255,126,95,0.3)]' 
                                : 'border-slate-700 bg-slate-800 text-slate-400 group-hover:border-slate-500'
                            }`}>
                                <sound.icon size={24} className={currentSoundId === sound.id && isAmbientPlaying ? 'animate-pulse' : ''} />
                            </div>
                            <span className="text-xs font-medium tracking-wide">{sound.label}</span>
                        </button>
                    ))}
                </div>

                {/* Volume Slider */}
                {currentSoundId && (
                    <div className="w-56 md:w-48 mx-auto flex items-center gap-3 text-slate-500 mb-8 md:mb-12 animate-in fade-in slide-in-from-bottom-4">
                        <Volume2 size={16} />
                        <input 
                            type="range" min="0" max="1" step="0.01" 
                            value={ambientVolume}
                            onChange={(e) => onSetVolume(parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-orange"
                        />
                    </div>
                )}

                <button onClick={onExit} className="group flex items-center gap-3 px-8 py-3 rounded-full border border-white/10 hover:bg-white/10 transition-all mx-auto text-sm font-bold uppercase tracking-wider text-slate-300 hover:text-white">
                    <X size={18} className="group-hover:rotate-90 transition-transform" />
                    Quitter le mode Focus
                </button>
            </div>

            {/* Zen Chat Button */}
            {!showChat && (
                <button 
                    onClick={() => setShowChat(true)}
                    className="absolute bottom-6 right-4 md:bottom-8 md:right-8 flex items-center gap-3 px-5 py-3 md:px-6 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold backdrop-blur-sm transition-all animate-in fade-in slide-in-from-bottom-4 border border-white/5 hover:border-white/20 shadow-lg z-20"
                >
                    <MessageCircle size={18} className="text-brand-orange" /> <span className="hidden sm:inline">Discuter avec Franck</span><span className="sm:hidden">Franck</span>
                </button>
            )}

            {/* Coach Franck Chat Window */}
            {showChat && (
                <div className="absolute inset-0 md:inset-auto md:bottom-8 md:right-8 md:w-[420px] md:h-[550px] bg-slate-900 border-0 md:border md:border-slate-700/50 md:rounded-3xl flex flex-col overflow-hidden shadow-2xl shadow-black/50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 z-20">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-gradient-to-r from-orange-500/10 to-purple-500/10">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-white font-serif text-lg shadow-lg shadow-orange-500/30">
                                    F
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-800"></div>
                            </div>
                            <div>
                                <div className="font-bold text-sm text-white flex items-center gap-2">
                                    Coach Franck
                                    <Sparkles size={12} className="text-orange-400" />
                                </div>
                                <div className="text-[10px] text-slate-400">Mode Focus • Coaching actif</div>
                            </div>
                        </div>
                        <button onClick={() => setShowChat(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                        {chatHistory.length === 0 && (
                            <div className="space-y-6 pt-4">
                                {/* Welcome Message */}
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-white font-serif text-sm shrink-0 mt-1">F</div>
                                    <div className="bg-slate-800 p-4 rounded-2xl rounded-bl-none border border-slate-700/50 text-sm text-slate-200 leading-relaxed">
                                        <p className="mb-2">Hey Marion ! 🎯</p>
                                        <p className="mb-2">Mode Focus activé, je suis là en tant que coach. Pas de blabla, que du concret pour t'aider à avancer.</p>
                                        <p className="text-slate-400 text-xs">Dis-moi ce qui te bloque ou choisis un sujet ci-dessous.</p>
                                    </div>
                                </div>
                                
                                {/* Quick Prompts */}
                                <div className="flex flex-wrap gap-2 pl-11">
                                    {COACH_PROMPTS.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSendMessage(item.prompt)}
                                            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-orange-500/50 rounded-xl text-xs text-slate-300 hover:text-white transition-all group"
                                        >
                                            <item.icon size={14} className="text-orange-400 group-hover:scale-110 transition-transform" />
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                {msg.role === 'model' && (
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-white font-serif text-sm shrink-0 mt-1">F</div>
                                )}
                                <div className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                                    msg.role === 'user' 
                                    ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-br-none shadow-lg shadow-orange-500/20' 
                                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/50'
                                }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        
                        {isTyping && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-white font-serif text-sm shrink-0">F</div>
                                <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-none flex gap-1.5 border border-slate-700/50">
                                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-slate-700/50 bg-slate-900">
                        <div className="relative">
                            <input 
                                className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-4 pr-12 py-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500/50 focus:bg-slate-750 transition-all"
                                placeholder="Qu'est-ce qui te préoccupe ?"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(chatInput)}
                                autoFocus
                            />
                            <button 
                                onClick={() => handleSendMessage(chatInput)}
                                disabled={!chatInput.trim() || isTyping}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-orange-500 to-rose-500 rounded-xl text-white hover:scale-105 transition-transform disabled:opacity-40 disabled:scale-100 shadow-lg shadow-orange-500/20"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};