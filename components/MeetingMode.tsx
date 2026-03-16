import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Square, Loader2, CheckCircle, List, Target, Save, X, BrainCircuit, AlertCircle, Download, Mail, Globe, History, Pause, Play } from 'lucide-react';
import { ClientProfile, MeetingReport, MeetingReportTask, Task } from '../types';
import { exportMeetingReportPdf } from '../utils/meetingReportPdf';
import { apiFetch } from '../services/api';
import { StatusRail } from './meeting/StatusRail';
import { CoachingCard } from './meeting/CoachingCard';
import { TranscriptTimeline } from './meeting/TranscriptTimeline';
import { ActionTable } from './meeting/ActionTable';

// Declare SpeechRecognition for TypeScript
declare global {
    interface Window {
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}

interface MeetingModeProps {
    clientName: string;
    clientProfile?: ClientProfile;
    clientAvatarImage?: string;
    meetingHistory?: MeetingReport[];
    openTasks?: Task[];
    onClose: () => void;
    onSaveNotes: (notes: MeetingReport) => void;
    onOpenEmail?: (draft: { to: string; subject: string; body: string }) => void;
}

export const MeetingMode: React.FC<MeetingModeProps> = ({ clientName, clientProfile, clientAvatarImage, meetingHistory = [], openTasks = [], onClose, onSaveNotes, onOpenEmail }) => {
    const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'processing' | 'done' | 'error'>('idle');
    const [duration, setDuration] = useState(0);
    const [audioData, setAudioData] = useState<number[]>(new Array(20).fill(10));
    const [liveTranscription, setLiveTranscription] = useState<string>('');
    const [finalTranscription, setFinalTranscription] = useState<string>('');
    const [transcriptSegments, setTranscriptSegments] = useState<string[]>([]);
    const [result, setResult] = useState<MeetingReport | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [meetingObjective, setMeetingObjective] = useState<string>('');
    const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState(true);
    const [showFullTranscription, setShowFullTranscription] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);
    const [selectedHistoryReportId, setSelectedHistoryReportId] = useState<string | null>(null);
    const [showHistoryDetail, setShowHistoryDetail] = useState(false);
    const [reviewTasks, setReviewTasks] = useState<MeetingReportTask[]>([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [liveCues, setLiveCues] = useState<Array<{ cue: string; rationale?: string; priority: 'low' | 'medium' | 'high' }>>([]);
    const [isCoaching, setIsCoaching] = useState(false);
    const [silenceDetected, setSilenceDetected] = useState(false);
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [retentionDays, setRetentionDays] = useState<number>(() => Number(localStorage.getItem('marion_meeting_retention_days') || 30));
    const [requireConsent, setRequireConsent] = useState(true);
    const [savedTaskCount, setSavedTaskCount] = useState<number | null>(null);
    const [transcriptEdited, setTranscriptEdited] = useState(false);
    const [isReanalyzing, setIsReanalyzing] = useState(false);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationRef = useRef<number | null>(null);
    const speechRecognitionRef = useRef<any | null>(null);
    const coachingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const statusRef = useRef(status);
    const lastSegmentTimestampRef = useRef<number>(Date.now());
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (! (window.SpeechRecognition || window.webkitSpeechRecognition) ) {
            setIsSpeechRecognitionSupported(false);
        }
    }, []);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Silence detection: flag if no new transcript segment in 30s during recording
    useEffect(() => {
        if (status !== 'recording') {
            setSilenceDetected(false);
            if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
            return;
        }
        lastSegmentTimestampRef.current = Date.now();
        silenceTimerRef.current = setInterval(() => {
            if (Date.now() - lastSegmentTimestampRef.current > 30_000) {
                setSilenceDetected(true);
            }
        }, 5_000);
        return () => {
            if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
        };
    }, [status]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (coachingTimerRef.current) clearTimeout(coachingTimerRef.current);
            if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
            stopSpeechRecognition();
            stopVisualizer();
        };
    }, []);

    useEffect(() => {
        apiFetch('/api/v1/meeting/policy')
            .then((r) => (r.ok ? r.json() : null))
            .then((p) => {
                if (!p) return;
                if (typeof p.retentionDays === 'number') setRetentionDays(p.retentionDays);
                if (typeof p.requireConsent === 'boolean') setRequireConsent(p.requireConsent);
            })
            .catch(() => null);
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
            const visualData = Array.from(dataArray).slice(0, 20).map(v => Math.max(10, v / 2.5));
            setAudioData(visualData);
            animationRef.current = requestAnimationFrame(tick);
        };
        tick();
    };

    const stopVisualizer = () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };

    const startSpeechRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech Recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'fr-FR';

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
            if (finalTranscript.trim()) {
                    setFinalTranscription(prev => `${prev} ${finalTranscript}`.trim());
                    setTranscriptSegments(prev => [...prev, finalTranscript.trim()]);
                    lastSegmentTimestampRef.current = Date.now();
                    setSilenceDetected(false);
                }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setErrorMessage("La transcription live a rencontré une erreur, l'enregistrement continue.");
        };

        recognition.onend = () => {
            if (statusRef.current === 'recording') {
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

    const getAiRoutingPayload = () => {
        const aiMode = (localStorage.getItem('marion_ai_mode') || 'cloud') as 'local' | 'cloud' | 'hybrid';
        const localModel = localStorage.getItem('marion_ai_local_model') || 'qwen2.5:7b-instruct';
        const fallbackEnabled = localStorage.getItem('marion_ai_fallback_enabled') !== 'false';
        return { ai_mode: aiMode, local_model: localModel, fallback_enabled: fallbackEnabled };
    };

    const rollingTranscript = useMemo(() => {
        const recent = transcriptSegments.slice(-8).join(' ');
        return `${recent} ${liveTranscription}`.trim();
    }, [transcriptSegments, liveTranscription]);

    useEffect(() => {
        if (status !== 'recording') return;
        if (coachingTimerRef.current) clearTimeout(coachingTimerRef.current);
        if (rollingTranscript.length < 80) return;

        coachingTimerRef.current = setTimeout(async () => {
            try {
                setIsCoaching(true);
                const res = await apiFetch('/api/v1/meeting/coach', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transcript: rollingTranscript,
                        objective: meetingObjective,
                        consentAccepted,
                        retentionDays,
                        ...getAiRoutingPayload(),
                    }),
                });
                if (!res.ok) return;
                const data = await res.json();
                setLiveCues(Array.isArray(data?.cues) ? data.cues : []);
            } catch (_e) {
                // Keep recording flow smooth; no blocking error for coach.
            } finally {
                setIsCoaching(false);
            }
        }, 3500);

        return () => {
            if (coachingTimerRef.current) clearTimeout(coachingTimerRef.current);
        };
    }, [rollingTranscript, meetingObjective, status, consentAccepted, retentionDays]);

    const startRecording = async () => {
        if (requireConsent && !consentAccepted) {
            setErrorMessage("Confirmez le consentement avant de demarrer l'enregistrement.");
            setStatus('error');
            return;
        }
        localStorage.setItem('marion_meeting_retention_days', String(retentionDays));
        apiFetch('/api/v1/meeting/policy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ retentionDays, requireConsent }),
        }).catch(() => null);
        setLiveTranscription('');
        setFinalTranscription('');
        setTranscriptSegments([]);
        setLiveCues([]);
        setDuration(0);
        setErrorMessage('');
        setResult(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            startVisualizer(stream);
            startSpeechRecognition();
            
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            recorder.onstop = () => {
                stopVisualizer();
                stopSpeechRecognition();
                stream.getTracks().forEach(track => track.stop());
                processAudio();
            };

            recorder.start();
            setStatus('recording');
            apiFetch('/api/v1/meeting/audit/lifecycle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'start', clientName }),
            }).catch(() => null);
            
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error accessing mic:", err);
            setErrorMessage("Impossible d'accéder au micro. Vérifiez les permissions navigateur.");
            setStatus('error');
        }
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && status === 'recording') {
            try { mediaRecorderRef.current.pause(); } catch (_) {}
            stopSpeechRecognition();
            if (timerRef.current) clearInterval(timerRef.current);
            setSilenceDetected(false);
            setStatus('paused');
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && status === 'paused') {
            try { mediaRecorderRef.current.resume(); } catch (_) {}
            startSpeechRecognition();
            timerRef.current = setInterval(() => setDuration(prev => prev + 1), 1000);
            lastSegmentTimestampRef.current = Date.now();
            setStatus('recording');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && (status === 'recording' || status === 'paused')) {
            if (status === 'paused') {
                try { mediaRecorderRef.current.resume(); } catch (_) {}
            }
            mediaRecorderRef.current.stop();
            if (timerRef.current) clearInterval(timerRef.current);
            setStatus('processing');
            apiFetch('/api/v1/meeting/audit/lifecycle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'stop', clientName, metadata: { duration } }),
            }).catch(() => null);
        }
    };

    const goBackToPreCall = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setStatus('idle');
        setErrorMessage('');
        setLiveTranscription('');
        setLiveCues([]);
    };

    const processAudio = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'meeting.webm');
        formData.append('clientName', clientName);
        formData.append('rawTranscription', (finalTranscription || rollingTranscript).trim());
        formData.append('durationSeconds', String(duration));
        if (meetingObjective.trim()) {
            formData.append('objective', meetingObjective.trim());
        }
        formData.append('consentAccepted', String(consentAccepted));
        formData.append('retentionDays', String(retentionDays));
        const routing = getAiRoutingPayload();
        formData.append('ai_mode', routing.ai_mode);
        formData.append('local_model', routing.local_model);
        formData.append('fallback_enabled', String(routing.fallback_enabled));

        // Inject the last 3 meeting summaries so the AI has continuity context
        if (meetingHistory && meetingHistory.length > 0) {
            const last3 = meetingHistory.slice(0, 3).map((r) => ({
                date: r.generatedAt,
                summary: r.summary,
                nextSteps: r.nextSteps || [],
                decisions: r.decisions || [],
            }));
            formData.append('meetingContext', JSON.stringify(last3));
        }

        try {
            const res = await apiFetch('/api/v1/meeting/analyze', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);
            
            setResult(data);
            setStatus('done');
        } catch (e) {
            console.error(e);
            setErrorMessage("Erreur lors de l'analyse de la réunion. Vérifiez la connexion IA.");
            setStatus('error');
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleOpenFollowUpEmail = () => {
        if (!result?.followUpDraft || !onOpenEmail) return;
        const draft = result.followUpDraft;
        // Format from backend: "Sujet: ...\n\nBody..." or plain body
        const subjectMatch = draft.match(/^Sujet:\s*(.+)/i);
        const subject = subjectMatch ? subjectMatch[1].trim() : `Suivi réunion – ${clientName}`;
        const body = subjectMatch
            ? draft.replace(/^Sujet:\s*.+\n*/i, '').trim()
            : draft.trim();
        onOpenEmail({
            to: clientProfile?.email || '',
            subject,
            body,
        });
    };

    const handleSave = () => {
        if (!result) return;
        const selectedTasks = reviewTasks
            .filter((task) => selectedTaskIds.includes(task.id || ''))
            .map((task) => ({ ...task, title: (task.title || '').trim() }))
            .filter((task) => task.title.length > 0);
        const payload: MeetingReport = {
            ...result,
            tasks: selectedTasks,
        };
        setSavedTaskCount(selectedTasks.length);
        apiFetch('/api/v1/meeting/audit/lifecycle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'save', clientName, metadata: { reportId: result.id, taskCount: selectedTasks.length } }),
        }).catch(() => null);
        onSaveNotes(payload);
        onClose();
    };

    const handleExportPdf = async (variant: 'internal' | 'client') => {
        if (!result) return;
        await exportMeetingReportPdf(result, variant);
        await apiFetch('/api/v1/meeting/audit/export', {
            method: 'POST',
            body: JSON.stringify({ clientName, reportId: result.id, variant }),
            headers: { 'Content-Type': 'application/json' },
        }).catch(() => null);
    };
    const uiStage = status === 'done' ? 'post' : (status === 'recording' || status === 'paused' || status === 'processing') ? 'in' : 'pre';
    const recentCalls = [...meetingHistory]
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
        .slice(0, 4);
    const selectedHistoryReport = useMemo(
        () => recentCalls.find((call) => call.id === selectedHistoryReportId) || null,
        [recentCalls, selectedHistoryReportId]
    );

    useEffect(() => {
        if (!recentCalls.length) {
            setSelectedHistoryReportId(null);
            return;
        }
        if (!selectedHistoryReportId || !recentCalls.some((call) => call.id === selectedHistoryReportId)) {
            setSelectedHistoryReportId(recentCalls[0].id);
        }
    }, [recentCalls, selectedHistoryReportId]);

    useEffect(() => {
        if (!result?.tasks) {
            setReviewTasks([]);
            setSelectedTaskIds([]);
            return;
        }
        const hydratedTasks = result.tasks.map((task, index) => ({
            ...task,
            id: task.id || `rt-${index}-${Date.now().toString(36)}`,
        }));
        setReviewTasks(hydratedTasks);
        setSelectedTaskIds(hydratedTasks.map((task) => task.id || '').filter(Boolean));
    }, [result?.id]);

    const handleToggleTask = (taskId: string, checked: boolean) => {
        setSelectedTaskIds((prev) => {
            if (checked) return prev.includes(taskId) ? prev : [...prev, taskId];
            return prev.filter((id) => id !== taskId);
        });
    };

    const handleTaskChange = (taskId: string, patch: Partial<MeetingReportTask>) => {
        setReviewTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
    };

    const handleSegmentsChange = (updated: string[]) => {
        setTranscriptSegments(updated);
        setFinalTranscription(updated.join(' '));
        setTranscriptEdited(true);
    };

    const handleReanalyze = async () => {
        if (!finalTranscription) return;
        setIsReanalyzing(true);
        setResult(null);
        setStatus('processing');
        setTranscriptEdited(false);
        await processAudio();
        setIsReanalyzing(false);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#f6f8fc] dark:bg-slate-950 animate-in fade-in duration-200">
            <div className="h-full flex flex-col">
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Meeting Copilot</h2>
                        <StatusRail stage={uiStage} />
                    </div>
                    <div className="flex items-center gap-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Client: {clientName}</p>
                        <button onClick={onClose} className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
                            <X size={16} className="mx-auto" />
                        </button>
                    </div>
                </header>

                {status !== 'done' && (
                    <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-0">
                        <section className="xl:col-span-8 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
                                    {status === 'recording' ? 'In-call assistant actif' : status === 'paused' ? 'Enregistrement en pause' : 'Assistant de Réunion'}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    {status === 'recording' ? `Enregistrement en cours pour ${clientName}` : status === 'paused' ? 'Reprends quand tu es prêt(e)' : `Prépare l'appel avec ${clientName}`}
                                </p>
                                {!isSpeechRecognitionSupported && (
                                    <p className="text-red-500 text-xs mt-2 flex items-center gap-2">
                                        <AlertCircle size={14} /> La reconnaissance vocale live peut être limitée sur ce navigateur.
                                    </p>
                                )}
                            </div>

                            <div className="flex-1 min-h-0 p-6 overflow-y-auto space-y-6">
                                {(status === 'idle' || status === 'error') && (
                                    <div className="space-y-3 max-w-3xl">
                                        <input
                                            value={meetingObjective}
                                            onChange={(e) => setMeetingObjective(e.target.value)}
                                            placeholder="Objectif de l'appel (optionnel) : ex. valider planning et budget"
                                            className="w-full rounded-lg px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand-orange"
                                        />
                                        {/* Dynamic pre-call briefing */}
                                        {meetingHistory.length > 0 && meetingHistory[0] && (
                                            <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-4 space-y-2">
                                                <p className="text-xs uppercase tracking-wider text-purple-500 dark:text-purple-400 mb-1">Dernier appel — {new Date(meetingHistory[0].generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                                <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-3">{meetingHistory[0].summary}</p>
                                                {meetingHistory[0].nextSteps && meetingHistory[0].nextSteps.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-wider text-purple-400 mt-2 mb-1">Points à re-vérifier</p>
                                                        <ul className="space-y-1">
                                                            {meetingHistory[0].nextSteps.slice(0, 3).map((step, i) => (
                                                                <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                                                                    <span className="mt-1 w-1 h-1 rounded-full bg-purple-400 flex-shrink-0" />
                                                                    {step}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {openTasks.length > 0 && (
                                            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                                                <p className="text-xs uppercase tracking-wider text-amber-500 dark:text-amber-400 mb-2">Tâches ouvertes ({openTasks.length})</p>
                                                <ul className="space-y-1">
                                                    {openTasks.slice(0, 4).map((task) => (
                                                        <li key={task.id} className="text-xs text-slate-700 dark:text-slate-200 flex items-start gap-1.5">
                                                            <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.priority === 'High' ? 'bg-rose-400' : task.priority === 'Medium' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                                                            {task.title}
                                                        </li>
                                                    ))}
                                                    {openTasks.length > 4 && (
                                                        <li className="text-xs text-slate-400 dark:text-slate-500">+ {openTasks.length - 4} autre(s)…</li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                        {meetingHistory.length === 0 && openTasks.length === 0 && (
                                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
                                                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Checklist pre-call</p>
                                                <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-1">
                                                    <li>- Objectif principal formulé en 1 phrase</li>
                                                    <li>- Décisionnaire identifié</li>
                                                    <li>- Risque principal à clarifier</li>
                                                </ul>
                                            </div>
                                        )}
                                        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                                            <label className="text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                                <input type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} />
                                                Consentement de l'appel confirmé
                                            </label>
                                            <select
                                                value={retentionDays}
                                                onChange={(e) => setRetentionDays(Number(e.target.value))}
                                                className="rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 text-sm"
                                            >
                                                <option value={7}>Rétention 7j</option>
                                                <option value={30}>Rétention 30j</option>
                                                <option value={90}>Rétention 90j</option>
                                                <option value={365}>Rétention 365j</option>
                                            </select>
                                            <label className="text-xs text-slate-500 dark:text-slate-300 flex items-center gap-2">
                                                <input type="checkbox" checked={requireConsent} onChange={(e) => setRequireConsent(e.target.checked)} />
                                                Exiger consentement (workspace)
                                            </label>
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 max-w-3xl">
                                    <div className="flex items-start gap-4">
                                        {clientAvatarImage ? (
                                            <img src={clientAvatarImage} alt={clientName} className="w-14 h-14 rounded-full object-cover border border-slate-200 dark:border-slate-600" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-orange to-pink-500 text-white font-bold flex items-center justify-center">
                                                {(clientName || 'CL').slice(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2">
                                                <p className="text-[10px] uppercase tracking-wider text-slate-400">Client</p>
                                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{clientName}</p>
                                            </div>
                                            <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2">
                                                <p className="text-[10px] uppercase tracking-wider text-slate-400 inline-flex items-center gap-1"><Mail size={11} /> Email</p>
                                                <p className="text-sm text-slate-700 dark:text-slate-100 truncate">{clientProfile?.email || 'Non renseigné'}</p>
                                            </div>
                                            <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2">
                                                <p className="text-[10px] uppercase tracking-wider text-slate-400 inline-flex items-center gap-1"><Globe size={11} /> Site</p>
                                                <p className="text-sm text-slate-700 dark:text-slate-100 truncate">{clientProfile?.website || 'Non renseigné'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1"><History size={12} /> {recentCalls.length} appel(s) précédent(s)</p>
                                        {(status === 'recording' || status === 'paused') ? (
                                            <div className={`text-2xl tabular-nums font-semibold ${status === 'paused' ? 'text-amber-500 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                                                {formatTime(duration)}{status === 'paused' ? ' ⏸' : ''}
                                            </div>
                                        ) : status === 'processing' ? (
                                            <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400"><Loader2 size={16} className="animate-spin" /> Analyse en cours</div>
                                        ) : null}
                                    </div>
                                </div>

                                {status === 'recording' && liveTranscription && (
                                    <div className="max-w-3xl rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 text-slate-700 dark:text-slate-200">
                                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Live transcript</p>
                                        <p className="text-lg">{liveTranscription}</p>
                                    </div>
                                )}

                                {status === 'processing' && (
                                    <div className="text-slate-500 dark:text-slate-400 animate-pulse flex items-center gap-2">
                                        <BrainCircuit size={18} />
                                        Franck génère le compte-rendu structuré...
                                    </div>
                                )}

                                {status === 'error' && (
                                    <div className="text-red-600 dark:text-red-300 flex items-center justify-between gap-4 max-w-3xl">
                                        <div className="flex items-center gap-2">
                                        <AlertCircle size={18} />
                                        {errorMessage || 'Erreur inconnue.'}
                                        </div>
                                        <button
                                            onClick={goBackToPreCall}
                                            className="text-xs px-3 py-1.5 rounded-md border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            Retour pre-call
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                {(status === 'idle' || status === 'error') && (
                                    <>
                                        {status === 'error' && (
                                            <button
                                                onClick={goBackToPreCall}
                                                className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                                            >
                                                Retour pre-call
                                            </button>
                                        )}
                                        <button
                                            onClick={startRecording}
                                            className="px-6 py-3 bg-gradient-to-r from-brand-orange to-pink-500 text-white rounded-lg font-semibold hover:brightness-105 transition-all shadow-sm"
                                        >
                                            {status === 'error' ? "Relancer l'enregistrement" : "Lancer l'enregistrement"}
                                        </button>
                                    </>
                                )}
                                {(status === 'recording' || status === 'paused') && (
                                    <div className="flex items-center gap-2">
                                        {status === 'recording' ? (
                                            <button
                                                onClick={pauseRecording}
                                                className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                                            >
                                                <Pause size={16} /> Pause
                                            </button>
                                        ) : (
                                            <button
                                                onClick={resumeRecording}
                                                className="px-4 py-3 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-400 rounded-lg font-semibold hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all flex items-center gap-2"
                                            >
                                                <Play size={16} /> Reprendre
                                            </button>
                                        )}
                                        <button
                                            onClick={stopRecording}
                                            className="px-6 py-3 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-lg font-semibold hover:brightness-105 transition-all shadow-sm flex items-center gap-2"
                                        >
                                            <Square fill="currentColor" size={16} />
                                            Terminer
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>

                        <aside className="xl:col-span-4 bg-[#f8fafc] dark:bg-slate-950 p-5 overflow-y-auto space-y-4">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                                <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Historique des appels</p>
                                {recentCalls.length ? (
                                    <div className="space-y-2">
                                        {recentCalls.map((call) => (
                                            <button
                                                key={call.id}
                                                onClick={() => {
                                                    setSelectedHistoryReportId(call.id);
                                                    setShowHistoryDetail(true);
                                                }}
                                                className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                                                    selectedHistoryReportId === call.id
                                                        ? 'border-brand-orange/50 bg-orange-50 dark:bg-slate-800'
                                                        : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                                                }`}
                                            >
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {new Date(call.generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </p>
                                                <p className="text-sm text-slate-700 dark:text-slate-100 line-clamp-2">{call.summary || 'Compte-rendu disponible'}</p>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Aucun appel précédent enregistré pour ce client.</p>
                                )}
                            </div>
                            {selectedHistoryReport ? (
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Aperçu appel sélectionné</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        {new Date(selectedHistoryReport.generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </p>
                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 line-clamp-4">
                                        {selectedHistoryReport.summary || 'Compte-rendu sans résumé.'}
                                    </p>
                                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2">
                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Points</p>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{selectedHistoryReport.keyPoints?.length || 0}</p>
                                        </div>
                                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2">
                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Décisions</p>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{selectedHistoryReport.decisions?.length || 0}</p>
                                        </div>
                                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2">
                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Actions</p>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{selectedHistoryReport.tasks?.length || 0}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowHistoryDetail(true)}
                                        className="mt-3 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        Consulter le contenu de l'appel
                                    </button>
                                </div>
                            ) : null}
                            <CoachingCard cues={liveCues} loading={isCoaching} silenceDetected={silenceDetected} />
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                <button
                                    onClick={() => setShowTimeline((v) => !v)}
                                    className="text-xs uppercase tracking-wider text-slate-500 hover:text-brand-orange transition-colors"
                                >
                                    {showTimeline ? 'Masquer timeline' : 'Afficher timeline'}
                                </button>
                                {showTimeline ? <div className="mt-3"><TranscriptTimeline segments={transcriptSegments} editable={status === 'done'} onSegmentsChange={handleSegmentsChange} /></div> : null}
                            </div>
                        </aside>
                    </div>
                )}

                {status === 'done' && result && (
                    <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-0">
                        <section className="xl:col-span-8 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto">
                            <div className="bg-gradient-to-r from-brand-orange to-purple-600 p-6 text-white">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-wider mb-2">
                                            <CheckCircle size={14} /> Rapport généré
                                        </div>
                                        <h2 className="text-2xl font-serif font-bold">Compte-rendu {clientName}</h2>
                                        {result.meetingScore && (
                                            <div className="mt-2 inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
                                                <span className={`text-sm font-bold ${result.meetingScore.score >= 7 ? 'text-emerald-200' : result.meetingScore.score >= 4 ? 'text-amber-200' : 'text-rose-200'}`}>
                                                    {result.meetingScore.score}/10
                                                </span>
                                                <span className="text-xs text-white/80">{result.meetingScore.rationale}</span>
                                            </div>
                                        )}
                                        {finalTranscription && (
                                            <div className="mt-2 text-white/80 text-sm italic">
                                                <p className={`${!showFullTranscription ? 'line-clamp-2' : ''}`}>{finalTranscription}</p>
                                                {finalTranscription.length > 100 && (
                                                    <button onClick={() => setShowFullTranscription(!showFullTranscription)} className="underline mt-1 text-xs">
                                                        {showFullTranscription ? 'Voir moins' : 'Voir plus'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-3xl tabular-nums font-bold opacity-20">{formatTime(duration)}</div>
                                </div>
                            </div>

                            <div className="p-6 space-y-8">
                                <section>
                                    <h3 className="flex items-center gap-2 text-brand-orange font-bold uppercase tracking-widest text-xs mb-3">
                                        <Target size={16} /> Résumé Exécutif
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{result.summary}</p>
                                </section>

                                <section>
                                    <h3 className="flex items-center gap-2 text-purple-500 font-bold uppercase tracking-widest text-xs mb-3">
                                        <List size={16} /> Points Clés & Décisions
                                    </h3>
                                    <ul className="space-y-2">
                                        {result.keyPoints?.map((point: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0"></span>
                                                {point}
                                            </li>
                                        ))}
                                        {result.decisions?.map((point: string, i: number) => (
                                            <li key={`decision-${i}`} className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-widest text-xs mb-3">
                                        <CheckCircle size={16} /> Plan d'actions
                                    </h3>
                                    <p className="text-xs text-slate-500 mb-3">
                                        Sélectionne et édite les tâches avant création dans le Kanban.
                                    </p>
                                    <ActionTable
                                        tasks={reviewTasks}
                                        editable
                                        selectedTaskIds={selectedTaskIds}
                                        onToggleTask={handleToggleTask}
                                        onTaskChange={handleTaskChange}
                                    />
                                </section>

                                {(result.risks?.length || result.objections?.length) ? (
                                    <section>
                                        <h3 className="flex items-center gap-2 text-rose-500 font-bold uppercase tracking-widest text-xs mb-3">
                                            <AlertCircle size={16} /> Risques & Objections
                                        </h3>
                                        <ul className="space-y-1">
                                            {(result.risks || []).map((risk: string, i: number) => <li key={`risk-${i}`} className="text-slate-700 dark:text-slate-200">- {risk}</li>)}
                                            {(result.objections || []).map((obj: string, i: number) => <li key={`obj-${i}`} className="text-slate-700 dark:text-slate-200">- {obj}</li>)}
                                        </ul>
                                    </section>
                                ) : null}
                            </div>
                        </section>

                        <aside className="xl:col-span-4 bg-[#f8fafc] dark:bg-slate-950 p-5 overflow-y-auto space-y-4">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                                <h3 className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-widest text-xs mb-3">
                                    <CheckCircle size={14} /> Actions détectées
                                </h3>
                                <p className="text-sm text-slate-500">{reviewTasks.length || 0} action(s) proposées</p>
                                <p className="text-xs text-slate-400 mt-1">{selectedTaskIds.length} sélectionnée(s) pour création</p>
                                {result.followUpDraft ? (
                                    <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-2">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Brouillon follow-up</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-4">{result.followUpDraft}</p>
                                        {onOpenEmail && (
                                            <button
                                                onClick={handleOpenFollowUpEmail}
                                                className="w-full mt-1 py-2 bg-brand-orange/10 hover:bg-brand-orange/20 text-brand-orange rounded-lg text-xs font-semibold transition-colors inline-flex items-center justify-center gap-2"
                                            >
                                                <Mail size={13} /> Envoyer le suivi
                                            </button>
                                        )}
                                    </div>
                                ) : null}
                            </div>

                            {transcriptSegments.length > 0 && (
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Transcript</p>
                                        {transcriptEdited && (
                                            <button
                                                onClick={handleReanalyze}
                                                disabled={isReanalyzing}
                                                className="text-xs px-3 py-1 rounded-full bg-brand-orange text-white font-semibold hover:brightness-105 disabled:opacity-50 inline-flex items-center gap-1"
                                            >
                                                {isReanalyzing ? <><Loader2 size={11} className="animate-spin" /> Analyse…</> : <><BrainCircuit size={11} /> Ré-analyser</>}
                                            </button>
                                        )}
                                    </div>
                                    <TranscriptTimeline
                                        segments={transcriptSegments}
                                        editable
                                        onSegmentsChange={handleSegmentsChange}
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <button onClick={handleSave} className="w-full py-3 bg-gradient-to-r from-brand-orange to-pink-500 text-white rounded-lg font-semibold shadow-sm">
                                    <span className="inline-flex items-center gap-2"><Save size={16} /> Enregistrer & Créer {selectedTaskIds.length} tâche(s)</span>
                                </button>
                                {savedTaskCount !== null && (
                                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-2">
                                        <CheckCircle size={13} />
                                        {savedTaskCount > 0
                                            ? `${savedTaskCount} tâche(s) créée(s) dans le Kanban`
                                            : 'Rapport enregistré — aucune tâche sélectionnée'}
                                    </div>
                                )}
                                <button onClick={() => handleExportPdf('internal')} className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-lg font-semibold">
                                    <span className="inline-flex items-center gap-2"><Download size={16} /> PDF interne</span>
                                </button>
                                <button onClick={() => handleExportPdf('client')} className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-lg font-semibold">
                                    <span className="inline-flex items-center gap-2"><Download size={16} /> PDF client</span>
                                </button>
                            </div>
                        </aside>
                    </div>
                )}
            </div>
            {showHistoryDetail && selectedHistoryReport ? (
                <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
                        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500">Historique d'appel</p>
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                                    {new Date(selectedHistoryReport.generatedAt).toLocaleString('fr-FR')}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowHistoryDetail(false)}
                                className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                            >
                                <X size={16} className="mx-auto" />
                            </button>
                        </div>

                        <div className="p-5 space-y-5">
                            <section>
                                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Résumé</p>
                                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{selectedHistoryReport.summary || 'Aucun résumé.'}</p>
                            </section>

                            {!!selectedHistoryReport.keyPoints?.length && (
                                <section>
                                    <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Points clés</p>
                                    <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                        {selectedHistoryReport.keyPoints.map((point, idx) => <li key={`hk-${idx}`}>- {point}</li>)}
                                    </ul>
                                </section>
                            )}

                            {!!selectedHistoryReport.decisions?.length && (
                                <section>
                                    <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Décisions</p>
                                    <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                        {selectedHistoryReport.decisions.map((item, idx) => <li key={`hd-${idx}`}>- {item}</li>)}
                                    </ul>
                                </section>
                            )}

                            {!!selectedHistoryReport.nextSteps?.length && (
                                <section>
                                    <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Prochaines étapes</p>
                                    <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                        {selectedHistoryReport.nextSteps.map((step, idx) => <li key={`hs-${idx}`}>- {step}</li>)}
                                    </ul>
                                </section>
                            )}

                            <section>
                                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Tâches</p>
                                <ActionTable tasks={selectedHistoryReport.tasks || []} />
                            </section>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
