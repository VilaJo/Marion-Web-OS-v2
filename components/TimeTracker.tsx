import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Pause, Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { Project, ProjectStatus } from '../types';

interface TimeTrackerProps {
    projects?: Project[];
    client?: Project; // If provided, runs in "embedded" mode for this client only
}

export const TimeTracker: React.FC<TimeTrackerProps> = ({ projects = [], client }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isRunning, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string>(client?.id || '');
    const [elapsed, setElapsed] = useState(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    
    const timerRef = useRef<any>(null);

    // Format HH:MM:SS
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (client) setSelectedProjectId(client.id);
    }, [client]);

    useEffect(() => {
        if (isRunning && !isPaused) {
            timerRef.current = setInterval(() => {
                setElapsed(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isRunning, isPaused]);

    const handleToggle = () => {
        if (isRunning) {
            if (isPaused) {
                // Resume
                setIsPaused(false);
            } else {
                // Pause
                setIsPaused(true);
            }
        } else {
            // Start
            if (!selectedProjectId) return;
            setIsTracking(true);
            setIsPaused(false);
            setStartTime(Date.now());
        }
    };

    const handleStop = async () => {
        setIsTracking(false);
        setIsPaused(false);
        clearInterval(timerRef.current);
        
        if (!selectedProjectId || !startTime) return;

        const endTime = Date.now();
        const entry = {
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            duration: elapsed,
            description: "Session de travail"
        };

        try {
            await fetch('/api/time/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: selectedProjectId,
                    entry: entry
                })
            });
            setElapsed(0);
            setStartTime(null);
        } catch (e) {
            console.error("Failed to save logs", e);
            alert("Erreur de sauvegarde du temps.");
        }
    };

    // --- EMBEDDED MODE (Inside Client View) ---
    if (client) {
        return (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all duration-300 ${isRunning ? 'bg-slate-900 text-white border-slate-900' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                <div className={`font-mono text-sm font-bold tracking-wider tabular-nums w-20 text-center ${isPaused ? 'opacity-50' : ''}`}>
                    {formatTime(elapsed)}
                </div>
                
                {isRunning && !isPaused && (
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1"></div>
                )}

                <button 
                    onClick={handleToggle}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${isRunning ? (isPaused ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white') : 'bg-brand-orange text-white'}`}
                    title={isRunning ? (isPaused ? "Reprendre" : "Pause") : "Démarrer"}
                >
                    {isRunning ? (isPaused ? <Play size={12} fill="currentColor" className="ml-0.5" /> : <Pause size={12} fill="currentColor" />) : <Play size={12} fill="currentColor" className="ml-0.5" />}
                </button>

                {isRunning && (
                    <button 
                        onClick={handleStop}
                        className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center transition-transform hover:scale-110"
                        title="Arrêter et Enregistrer"
                    >
                        <Square size={12} fill="currentColor" />
                    </button>
                )}
            </div>
        );
    }

    // --- FLOATING MODE (Global) ---
    // Filter only active projects
    const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);

    return (
        <div 
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-out ${isExpanded ? 'w-96' : 'w-14'} h-14 rounded-full shadow-2xl flex items-center overflow-hidden border border-white/50 dark:border-slate-700 backdrop-blur-xl ${isRunning ? 'bg-slate-900 text-white shadow-orange-500/20' : 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-200'}`}
        >
            {/* Collapsed View (Icon Only) */}
            <div 
                className={`absolute left-0 top-0 w-14 h-14 flex items-center justify-center cursor-pointer z-20 hover:scale-110 transition-transform ${isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                onClick={() => setIsExpanded(true)}
            >
                {isRunning ? (
                    <div className="relative">
                        <span className="font-mono text-[10px] font-bold animate-pulse text-brand-orange">REC</span>
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                    </div>
                ) : (
                    <Clock size={24} />
                )}
            </div>

            {/* Expanded View (Controls) */}
            <div className={`w-full px-2 flex items-center gap-3 transition-all duration-500 ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                
                {/* Close/Collapse Button */}
                <button 
                    onClick={() => setIsExpanded(false)}
                    className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
                >
                    <ChevronDown size={20} />
                </button>

                {isRunning ? (
                    <div className="flex-1 flex items-center justify-between pr-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div> Enregistrement
                            </span>
                            <span className="font-mono text-xl font-bold tracking-widest tabular-nums">{formatTime(elapsed)}</span>
                        </div>
                        <button 
                            onClick={handleStop}
                            className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-red-500/30"
                        >
                            <Square size={14} fill="currentColor" />
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center gap-2 pr-2">
                        <select 
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="flex-1 bg-transparent text-sm font-medium outline-none border-none cursor-pointer truncate"
                        >
                            <option value="">SÉLECTIONNER UN PROJET</option>
                            {activeProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.clientName}</option>
                            ))}
                        </select>
                        <button 
                            onClick={handleToggle}
                            disabled={!selectedProjectId}
                            className="w-10 h-10 bg-brand-orange text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 flex-shrink-0"
                        >
                            <Play size={16} fill="currentColor" className="ml-0.5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};