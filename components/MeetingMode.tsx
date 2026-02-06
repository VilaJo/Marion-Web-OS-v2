import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, CheckCircle, Clock, List, Target, Calendar, User, Save, X, Sparkles, BrainCircuit } from 'lucide-react';
import { Badge } from './Shared';

// Declare SpeechRecognition for TypeScript
declare global {
    interface Window {
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}

interface MeetingModeProps {
    clientName: string;
    onClose: () => void;
    onSaveNotes: (notes: any) => void;
}

export const MeetingMode: React.FC<MeetingModeProps> = ({ clientName, onClose, onSaveNotes }) => {
    const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing' | 'processing' | 'done'>('idle');
    const [duration, setDuration] = useState(0);
    const [audioData, setAudioData] = useState<number[]>(new Array(20).fill(10));
    const [liveTranscription, setLiveTranscription] = useState<string>(''); // NEW: Live transcription state
    const [finalTranscription, setFinalTranscription] = useState<string>(''); // NEW: Final raw transcription
    const [result, setResult] = useState<any>(null);
    const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState(true);
    const [showFullTranscription, setShowFullTranscription] = useState(false); // NEW: Track SR support
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationRef = useRef<number | null>(null);
    const speechRecognitionRef = useRef<any | null>(null); // NEW: SpeechRecognition ref

    // Check Speech Recognition support on mount
    useEffect(() => {
        if (! (window.SpeechRecognition || window.webkitSpeechRecognition) ) {
            setIsSpeechRecognitionSupported(false);
        }
    }, []);

    // --- Audio Visualization Logic ---
    const startVisualizer = (stream: MediaStream) => {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const tick = () => {
            analyser.getByteFrequencyData(dataArray);
            // Normalize to 0-100 range for CSS height
            const visualData = Array.from(dataArray).slice(0, 20).map(v => Math.max(10, v / 2.5));
            setAudioData(visualData);
            animationRef.current = requestAnimationFrame(tick);
        };
        tick();
    };

    const stopVisualizer = () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };

    // --- Speech Recognition Logic (NEW) ---
    const startSpeechRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech Recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true; // Get results while speaking
        recognition.lang = 'fr-FR'; // Set language to French

                                recognition.onresult = (event: any) => {
                                    let interimTranscript = '';
                                    let finalTranscript = '';
                    
                                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                                        const transcript = event.results[i][0].transcript;
                                        if (event.results[i].isFinal) {
                                            finalTranscript += transcript;
                                        } else {
                                            interimTranscript += transcript;
                                        }
                                    }
                                    setLiveTranscription(interimTranscript); 
                                    setFinalTranscription(prev => prev + finalTranscript); // Accumulate final transcription
                                };        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
        };

        recognition.onend = () => {
            console.log("Speech Recognition Ended.");
            // Restart if recording is still active (continuous recognition)
            if (status === 'recording') {
                recognition.start();
            }
        };

        speechRecognitionRef.current = recognition;
        recognition.start();
    };

    const stopSpeechRecognition = () => {
        if (speechRecognitionRef.current) {
            speechRecognitionRef.current.stop();
        }
    };

    // --- Recording Logic ---
    const startRecording = async () => {
        setLiveTranscription('');
        setFinalTranscription('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            startVisualizer(stream);
            startSpeechRecognition(); // NEW: Start speech recognition
            
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            recorder.onstop = () => {
                stopVisualizer();
                stopSpeechRecognition(); // NEW: Stop speech recognition
                stream.getTracks().forEach(track => track.stop());
                processAudio();
            };

            recorder.start();
            setStatus('recording');
            
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error accessing mic:", err);
            alert("Impossible d'accéder au micro. Vérifiez les permissions.");
            setStatus('idle');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && status === 'recording') {
            mediaRecorderRef.current.stop();
            if (timerRef.current) clearInterval(timerRef.current);
            setStatus('transcribing'); // Change status to indicate immediate transcription phase
        }
    };

    const processAudio = async () => {
        // Here, finalTranscription holds the raw text from the browser's STT
        // We still send the audio blob to Franck for structured analysis

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'meeting.webm');
        formData.append('clientName', clientName);
        formData.append('rawTranscription', finalTranscription); // NEW: Send raw transcription to backend

        try {
            setStatus('processing'); // Indicate AI analysis
            const res = await fetch('/api/meeting/analyze', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);
            
            setResult(data);
            setStatus('done');
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'analyse de la réunion par Franck.");
            setStatus('idle');
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSave = () => {
        onSaveNotes(result); // result now contains structured notes
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-xl animate-in fade-in duration-300">
            <button onClick={onClose} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors">
                <X size={32} />
            </button>

            <div className="max-w-4xl w-full mx-4">
                
                {/* IDLE & RECORDING STATE */}
                {status !== 'done' && (
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-8">
                            <h2 className="text-white text-3xl font-serif mb-2 tracking-wide">
                                {status === 'recording' ? 'Écoute Active...' : 'Assistant de Réunion'}
                            </h2>
                            <p className="text-slate-400">
                                {status === 'recording' 
                                    ? `Enregistrement en cours pour ${clientName}` 
                                    : `Prêt à capturer la réunion avec ${clientName}`}
                            </p>
                            {!isSpeechRecognitionSupported && (
                                <p className="text-red-400 text-sm mt-2 flex items-center justify-center gap-2">
                                    <AlertCircle size={16} /> La reconnaissance vocale n'est pas entièrement supportée par votre navigateur. La transcription en direct peut être limitée.
                                </p>
                            )}
                        </div>

                        {/* Visualizer Orb */}
                        <div className="relative mb-12">
                            <div className={`w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500 ${
                                status === 'recording' 
                                ? 'bg-red-500/20 shadow-[0_0_100px_rgba(239,68,68,0.4)]' 
                                : 'bg-slate-800 border border-slate-700'
                            }`}>
                                {status === 'processing' || status === 'transcribing' ? (
                                    <Loader2 size={64} className="text-brand-orange animate-spin" />
                                ) : (
                                    <Mic size={64} className={status === 'recording' ? 'text-red-500' : 'text-slate-500'} />
                                )}
                            </div>
                            
                            {/* Waveform Bars */}
                            {status === 'recording' && (
                                <div className="absolute inset-0 flex items-center justify-center gap-1.5 pointer-events-none">
                                    {audioData.map((height, i) => (
                                        <div 
                                            key={i} 
                                            className="w-1.5 bg-red-500 rounded-full transition-all duration-75 ease-linear opacity-80"
                                            style={{ height: `${height}%`, maxHeight: '120%' }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Live Transcription Display (NEW) */}
                        {status === 'recording' && liveTranscription && (
                            <div className="text-slate-300 text-lg italic max-w-lg mx-auto mb-8 p-4 bg-white/10 rounded-xl">
                                {liveTranscription}
                            </div>
                        )}

                        {/* Timer */}
                        {status === 'recording' && (
                            <div className="font-mono text-4xl text-white mb-12 tabular-nums">
                                {formatTime(duration)}
                            </div>
                        )}

                        {/* Current Status/Action */}
                        {status === 'transcribing' && (
                             <div className="text-slate-400 animate-pulse flex items-center gap-2 mb-12">
                                <Sparkles size={20} />
                                Transcription en cours...
                            </div>
                        )}
                        {status === 'processing' && (
                            <div className="text-slate-400 animate-pulse flex items-center gap-2 mb-12">
                                <BrainCircuit size={20} />
                                Franck analyse les discussions...
                            </div>
                        )}

                        {/* Controls */}
                        {status === 'idle' && (
                            <button 
                                onClick={startRecording}
                                className="group relative px-8 py-4 bg-white text-slate-900 rounded-full font-bold text-lg hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] flex items-center gap-3"
                            >
                                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                                Lancer l'enregistrement
                            </button>
                        )}

                        {status === 'recording' && (
                            <button 
                                onClick={stopRecording}
                                className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold text-lg hover:scale-105 transition-all shadow-lg flex items-center gap-3"
                            >
                                <Square fill="currentColor" size={18} />
                                Terminer la réunion
                            </button>
                        )}
                    </div>
                )}

                {/* RESULTS STATE */}
                {status === 'done' && result && (
                    <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-500 border border-slate-700/50">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-brand-orange to-purple-600 p-8 text-white">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 text-white/80 text-sm font-bold uppercase tracking-wider mb-2">
                                        <CheckCircle size={16} /> Rapport Généré avec Succès
                                    </div>
                                    <h2 className="text-3xl font-serif font-bold">Compte-rendu {clientName}</h2>
                                    {finalTranscription && (
                                        <div className="mt-2 text-white/70 text-sm italic">
                                            <p className={`${!showFullTranscription ? 'line-clamp-2' : ''}`}>
                                                {finalTranscription}
                                            </p>
                                            {finalTranscription.length > 100 && ( // Arbitrary length to show "more" button
                                                <button 
                                                    onClick={() => setShowFullTranscription(!showFullTranscription)} 
                                                    className="text-white/80 hover:text-white underline mt-1 text-xs"
                                                >
                                                    {showFullTranscription ? 'Voir moins' : 'Voir plus'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-4xl font-mono font-bold opacity-20">{formatTime(duration)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Main Content */}
                            <div className="lg:col-span-2 space-y-8">
                                <section>
                                    <h3 className="flex items-center gap-2 text-brand-orange font-bold uppercase tracking-widest text-sm mb-4">
                                        <Target size={18} /> Résumé Exécutif
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
                                        {result.summary}
                                    </p>
                                </section>

                                <section>
                                    <h3 className="flex items-center gap-2 text-purple-500 font-bold uppercase tracking-widest text-sm mb-4">
                                        <List size={18} /> Points Clés & Décisions
                                    </h3>
                                    <ul className="space-y-3">
                                        {result.keyPoints?.map((point: string, i: number) => (
                                            <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-200">
                                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0"></span>
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            </div>

                            {/* Sidebar Actions */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 space-y-6">
                                <div>
                                    <h3 className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-xs mb-4">
                                        <CheckCircle size={14} /> Action Items détectés
                                    </h3>
                                    <div className="space-y-2">
                                        {result.tasks?.map((task: any, i: number) => (
                                            <div key={i} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm shadow-sm">
                                                <div className="font-bold text-slate-800 dark:text-white mb-1">{task.title}</div>
                                                <div className="flex justify-between items-center text-xs text-slate-500">
                                                    <span className="flex items-center gap-1"><User size={10} /> {task.owner}</span>
                                                    {task.deadline && <span className="flex items-center gap-1 text-orange-500"><Calendar size={10} /> {task.deadline}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button 
                                    onClick={handleSave}
                                    className="w-full py-3 bg-brand-orange text-white rounded-xl font-bold shadow-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Save size={18} /> Enregistrer & Créer Tâches
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
