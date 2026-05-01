import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Check, CheckCircle, Circle, FileText, Folder, MoreHorizontal, Plus, Clock, AlertCircle, RefreshCw, Upload, Image as ImageIcon, Link2, Figma, Github, Globe, Trash2, Wand2, Download, Send, Sparkles, Edit2, Save, X, File, ChevronRight, ChevronLeft, HardDrive, Rocket, Archive, Play, Copy, Palette, Type, Lock, Eye, EyeOff, ExternalLink, ArrowRight, Mail, Pizza, Droplet, Text, DollarSign, Mic, Square, History, Timer, Pause, Repeat, BarChart, Cloud, CloudUpload, Pencil, FolderOpen, ZoomIn, ZoomOut, Move, RotateCcw } from 'lucide-react';
import {
    DndContext, DragOverlay, PointerSensor, TouchSensor,
    useSensor, useSensors, DragStartEvent, DragEndEvent,
    useDroppable, MeasuringStrategy,
    pointerWithin, rectIntersection,
} from '@dnd-kit/core';
import type { CollisionDetection } from '@dnd-kit/core';
import type { Modifier } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';

/**
 * Custom modifier: snaps the center of the DragOverlay to the pointer.
 * This fixes offset issues caused by scrollable containers, flex layouts,
 * or CSS transforms in parent elements.
 */
const snapOverlayToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
    if (activatorEvent && draggingNodeRect) {
        const event = activatorEvent as MouseEvent | TouchEvent;
        let clientX: number, clientY: number;
        if ('touches' in event) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = (event as MouseEvent).clientX;
            clientY = (event as MouseEvent).clientY;
        }
        // Offset so the overlay center aligns with where the user initially clicked
        const offsetX = clientX - draggingNodeRect.left - draggingNodeRect.width / 2;
        const offsetY = clientY - draggingNodeRect.top - draggingNodeRect.height / 2;
        return {
            ...transform,
            x: transform.x + offsetX,
            y: transform.y + offsetY,
        };
    }
    return transform;
};
import { Project, WorkflowPhase, Task, Invoice, FinderItem, ProjectStatus, NotificationType, MoodboardItem, MoodboardColor, MoodboardImage, MoodboardFont, Credential, MeetingReport } from '../types';
import { formatCurrency } from '../utils';
import { MaintenanceWidget } from './MaintenanceWidget';
import { Badge, Card, Modal, Tooltip, EmptyState } from './Shared';
import { Loader2 } from 'lucide-react';
import { useUndoStore } from '../stores/useUndoStore';

// Lazy-loaded heavy components (code-splitting)
const InvoiceBuilder = React.lazy(() => import('./InvoiceBuilder').then(m => ({ default: m.InvoiceBuilder })));
const BrandCenter = React.lazy(() => import('./BrandCenter').then(m => ({ default: m.BrandCenter })));
const MeetingMode = React.lazy(() => import('./MeetingMode').then(m => ({ default: m.MeetingMode })));
const FileExplorer = React.lazy(() => import('./FileExplorer').then(m => ({ default: m.FileExplorer })));
const LogoLab = React.lazy(() => import('./LogoLab').then(m => ({ default: m.LogoLab })));
const EmailClient = React.lazy(() => import('./email/EmailWidget').then(m => ({ default: m.EmailWidget })));
const ClientPortal = React.lazy(() => import('./ClientPortal').then(m => ({ default: m.ClientPortal })));
const CompetitorAnalysis = React.lazy(() => import('./CompetitorAnalysis').then(m => ({ default: m.CompetitorAnalysis })));
const PricingIntelligence = React.lazy(() => import('./PricingIntelligence').then(m => ({ default: m.PricingIntelligence })));
const ProjectProgressReport = React.lazy(() => import('./ProjectProgressReport').then(m => ({ default: m.ProjectProgressReport })));
const CaseStudyGenerator = React.lazy(() => import('./CaseStudyGenerator').then(m => ({ default: m.CaseStudyGenerator })));

const LazyFallback = () => (
    <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-brand-orange" size={28} />
    </div>
);

import { PROSPECT_PHASE_TEMPLATES, ACTIVE_PHASE_TEMPLATES, WORKFLOW_CONFIG, WORKFLOW_STEPS } from '../constants';
import { apiFetch } from '../services/api';
import { useOAuthStatus, useConnectGoogle, queryKeys } from '../services/queries';
import { useQueryClient } from '@tanstack/react-query';
import { exportMeetingReportPdf } from '../utils/meetingReportPdf';

declare const confetti: any;

// --- PRIORITY BASED ON DUE DATE ---
/**
 * Compute the effective priority of a task.
 * If a dueDate is set and the task is not completed, the priority escalates:
 *   - Overdue or due today → High
 *   - Due within 3 days    → at least Medium (upgrades Low)
 *   - Due within 7 days    → keeps original, but Low becomes Medium
 * The returned priority is always >= the manually set priority (never downgrades).
 */
function getEffectivePriority(task: Task): 'Low' | 'Medium' | 'High' {
    if (!task.dueDate || task.completed) return task.priority;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Priority ranking for comparison: Low=0, Medium=1, High=2
    const rank = { Low: 0, Medium: 1, High: 2 };
    let computed: 'Low' | 'Medium' | 'High' = task.priority;

    if (daysLeft <= 0) {
        computed = 'High'; // Overdue or due today
    } else if (daysLeft <= 3) {
        computed = rank[task.priority] >= rank['Medium'] ? task.priority : 'Medium';
    } else if (daysLeft <= 7 && task.priority === 'Low') {
        computed = 'Medium';
    }

    // Never downgrade: return the highest between manual and computed
    return rank[computed] >= rank[task.priority] ? computed : task.priority;
}

// --- SORTABLE TASK CARD COMPONENT ---
interface SortableTaskCardProps {
    task: Task;
    isDragging: boolean;
    onEdit: (task: Task) => void;
    onDelete: (taskId: string, e: React.MouseEvent) => void;
    onMove: (taskId: string, column: 'todo' | 'doing' | 'done') => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, task: Task, columnId: 'todo' | 'doing' | 'done') => void;
    columnId: 'todo' | 'doing' | 'done';
    prevColumn: 'todo' | 'doing' | 'done' | null;
    nextColumn: 'todo' | 'doing' | 'done' | null;
    getColumnLabel: (col: string) => string;
}

const SortableTaskCard: React.FC<SortableTaskCardProps> = ({
    task, isDragging, onEdit, onDelete, onMove, onKeyDown,
    columnId, prevColumn, nextColumn, getColumnLabel,
}) => {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging,
    } = useSortable({ id: task.id });

    const style: React.CSSProperties = {
        transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
        transition,
        // When actively dragging, hide this card — the DragOverlay shows the visual clone
        opacity: isSortableDragging ? 0.25 : 1,
        zIndex: isSortableDragging ? 0 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 group hover:shadow-lg transition-shadow relative cursor-grab active:cursor-grabbing touch-none`}
            onClick={() => !isSortableDragging && onEdit(task)}
            tabIndex={0}
            role="listitem"
            onKeyDown={(e) => onKeyDown(e, task, columnId)}
        >
            {/* Priority (auto-escalates based on due date) */}
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-1.5">
                    {(() => {
                        const ep = getEffectivePriority(task);
                        const escalated = ep !== task.priority;
                        return (
                            <Badge color={ep === 'High' ? 'red' : ep === 'Medium' ? 'yellow' : 'blue'}>
                                {ep}{escalated ? ' ⚡' : ''}
                            </Badge>
                        );
                    })()}
                </div>
                <button 
                    onClick={(e) => onDelete(task.id, e)} 
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full"
                    aria-label="Supprimer la tâche"
                >
                    <Trash2 size={12} />
                </button>
            </div>

            {/* Title */}
            <div className={`text-sm font-bold mb-1 leading-snug ${task.completed ? 'line-through opacity-50 text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                {task.title}
            </div>

            {/* Description snippet */}
            {task.description && (
                <div className="text-xs text-slate-500 line-clamp-2 mb-2 leading-relaxed">
                    {task.description}
                </div>
            )}

            {/* Inline move arrows */}
            <div className="flex justify-between items-center mb-2">
                <button
                    type="button"
                    disabled={!prevColumn}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (prevColumn) onMove(task.id, prevColumn);
                    }}
                    className={`p-1 rounded-full border text-slate-300 hover:text-slate-600 hover:border-slate-300 bg-white/60 dark:bg-slate-800/60 transition-all ${
                        !prevColumn ? 'opacity-20 cursor-default pointer-events-none' : 'opacity-70'
                    }`}
                    aria-label={prevColumn ? `Déplacer la tâche vers ${getColumnLabel(prevColumn)}` : undefined}
                >
                    <ChevronLeft size={12} />
                </button>
                <button
                    type="button"
                    disabled={!nextColumn}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (nextColumn) onMove(task.id, nextColumn);
                    }}
                    className={`p-1 rounded-full border text-slate-300 hover:text-slate-600 hover:border-slate-300 bg-white/60 dark:bg-slate-800/60 transition-all ${
                        !nextColumn ? 'opacity-20 cursor-default pointer-events-none' : 'opacity-70'
                    }`}
                    aria-label={nextColumn ? `Déplacer la tâche vers ${getColumnLabel(nextColumn)}` : undefined}
                >
                    <ChevronRight size={12} />
                </button>
            </div>

            {/* Footer (Date, Avatar placeholder) */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-700/50">
                {task.dueDate ? (
                    <div className={`text-[10px] font-medium flex items-center gap-1 ${new Date(task.dueDate) < new Date() && !task.completed ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                        <Clock size={10} /> {new Date(task.dueDate).toLocaleDateString()}
                    </div>
                ) : (
                    <div className="text-[10px] text-slate-300 italic">Pas de date</div>
                )}
                <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-500">
                    F
                </div>
            </div>
        </div>
    );
};

// --- DROPPABLE COLUMN WRAPPER ---
const DroppableColumn: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
    const { setNodeRef } = useDroppable({ id });
    return <div ref={setNodeRef} className="flex-1 flex flex-col min-h-0">{children}</div>;
};

// --- KANBAN COLUMN IDS ---
const KANBAN_COLUMNS = ['todo', 'doing', 'done'] as const;

/**
 * Custom collision detection for multi-column Kanban.
 *
 * Strategy:
 * 1. pointerWithin — exact hit-test: which droppables contain the cursor tip?
 *    - If the cursor is over a TASK card → return that task (precise insertion).
 *    - If the cursor is inside a column but not over a task → return the column
 *      (append to end, handles empty columns correctly).
 * 2. Fallback to rectIntersection for fast/edge-case drags.
 *
 * Why not closestCorners?
 *   closestCorners uses the corners of the *dragged item*, not the cursor.
 *   When columns are adjacent, a task's corners can be closer to items in a
 *   neighbouring column, causing the task to land in the wrong column.
 */
const kanbanCollisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);

    if (pointerCollisions.length > 0) {
        // Prefer a task-card collision (smaller droppable → precise position)
        const taskHit = pointerCollisions.find(
            c => !KANBAN_COLUMNS.includes(c.id as typeof KANBAN_COLUMNS[number])
        );
        if (taskHit) return [taskHit];

        // Cursor is in column space but not over a card (e.g. empty column or gap)
        const colHit = pointerCollisions.find(
            c => KANBAN_COLUMNS.includes(c.id as typeof KANBAN_COLUMNS[number])
        );
        if (colHit) return [colHit];

        return pointerCollisions;
    }

    // Fallback: geometric rect intersection for fast/edge-case drags
    return rectIntersection(args);
};

interface ClientViewProps {
    project: Project;
    onBack: () => void;
    onUpdateProject: (p: Project, oldId?: string) => void;
    onNotify: (title: string, message: string, type?: NotificationType) => void;
    onDelete?: (projectId: string) => void;
    currentTheme?: string;
}

const ClientViewInner: React.FC<ClientViewProps> = ({ project, onBack, onUpdateProject, onNotify, onDelete, currentTheme }) => {
    // Undo support
    const pushUndo = useUndoStore((s) => s.pushUndo);

    // Tabs: Tasks, Time, Finance, Files, Emails, Portal, Concurrents, Rapport IA, Case Study
    const [activeTab, setActiveTab] = useState<'tasks' | 'time' | 'finance' | 'files' | 'emails' | 'portal' | 'competitors' | 'progress' | 'casestudy'>('tasks');
    
    // --- Google OAuth status (for Drive section) ---
    const { data: oauthStatus } = useOAuthStatus();
    const connectGoogleMutation = useConnectGoogle();
    const queryClient = useQueryClient();
    
    // --- State: Modals ---
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showBrandCenter, setShowBrandCenter] = useState(false);
    const [showMeetingMode, setShowMeetingMode] = useState(false);
    const [meetingFollowUpDraft, setMeetingFollowUpDraft] = useState<{ to: string; subject: string; body: string } | null>(null);
    const [showLogoLab, setShowLogoLab] = useState(false);
    const [showLogoEditor, setShowLogoEditor] = useState(false);
    const [logoEditorTransform, setLogoEditorTransform] = useState(project.logoTransform || { x: 0, y: 0, scale: 1 });
    const [logoDragging, setLogoDragging] = useState(false);
    const [logoDragStart, setLogoDragStart] = useState({ x: 0, y: 0, tx: 0, ty: 0 });
    
    // --- State: Timer & Time Tracking ---
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timerSession, setTimerSession] = useState(0); // seconds
    const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
    const [showTimeEntryModal, setShowTimeEntryModal] = useState(false);
    const [timeEntryDesc, setTimeEntryDesc] = useState('');
    const [timeLogs, setTimeLogs] = useState<any[]>([]);
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [editingLogDesc, setEditingLogDesc] = useState('');
    const [editingLogDuration, setEditingLogDuration] = useState('');
    
    // --- State: Profile Editing ---
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [tempProfile, setTempProfile] = useState(project.profile);

    // --- State: Tasks ---
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
    const [newTaskStatus, setNewTaskStatus] = useState<'todo' | 'doing' | 'done'>('todo');
    const [newTaskDueDate, setNewTaskDueDate] = useState('');

    // --- State: Invoices ---
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    // --- State: Vault ---
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
    const [showCredentialModal, setShowCredentialModal] = useState(false);
    const [editingCredential, setEditingCredential] = useState<Credential | null>(null);

    // --- State: File Browser ---
    const [fileItems, setFileItems] = useState<FinderItem[]>([]);
    const [currentPath, setCurrentPath] = useState<string>("");
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [pathHistory, setPathHistory] = useState<string[]>([]);
    const [isSyncingToDrive, setIsSyncingToDrive] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
        try { return localStorage.getItem(`marion_drive_sync_${project.id}`); } catch { return null; }
    });

    // --- State: Links (persisted in project.links) ---
    const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
    const [links, setLinks] = useState<Record<string, string>>(() => ({
        figma: '', github: '', wordpress: '', infomaniak: '',
        ...(project.links || {}),
    }));
    const [hasVisitedFiles, setHasVisitedFiles] = useState(false);
    const localMeetingReportsKey = useMemo(() => `marion_meeting_reports_${project.id}`, [project.id]);
    const [localMeetingReports, setLocalMeetingReports] = useState<MeetingReport[]>([]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(localMeetingReportsKey);
            if (!raw) {
                setLocalMeetingReports([]);
                return;
            }
            const parsed = JSON.parse(raw);
            setLocalMeetingReports(Array.isArray(parsed) ? parsed : []);
        } catch {
            setLocalMeetingReports([]);
        }
    }, [localMeetingReportsKey]);

    useEffect(() => {
        const reports = project.meetingReports || [];
        if (!reports.length) return;
        setLocalMeetingReports(reports);
        try {
            localStorage.setItem(localMeetingReportsKey, JSON.stringify(reports));
        } catch {}
    }, [project.meetingReports, localMeetingReportsKey]);

    const mergedMeetingReports = useMemo(() => {
        const all = [...(project.meetingReports || []), ...localMeetingReports];
        const map = new Map<string, MeetingReport>();
        all.forEach((report, index) => {
            const key = report.id || `${report.generatedAt || ''}-${report.summary || ''}-${index}`;
            if (!map.has(key)) map.set(key, report);
        });
        return Array.from(map.values()).sort(
            (a, b) => new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime()
        );
    }, [project.meetingReports, localMeetingReports]);

    // Persist links to project when they change (debounced via blur/Enter)
    const saveLinks = (updated: Record<string, string>) => {
        setLinks(updated);
        // Filter out empty strings to keep project.json clean
        const cleaned: Record<string, string> = {};
        for (const [k, v] of Object.entries(updated)) {
            if (v.trim()) cleaned[k] = v.trim();
        }
        onUpdateProject({ ...project, links: cleaned });
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- DRAG & DROP STATE ---
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);


    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
        fetchTimeLogs();
    }, []);

    // --- TIME TRACKER LOGIC ---
    useEffect(() => {
        let interval: any;
        if (isTimerRunning) {
            interval = setInterval(() => {
                setTimerSession(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning]);

    const fetchTimeLogs = async () => {
        try {
            const res = await apiFetch('/api/v1/time/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: project.id })
            });
            const data = await res.json();
            if (data.logs) setTimeLogs(data.logs);
        } catch (e) { console.error("Failed to fetch logs", e); }
    };

    const handleToggleTimer = () => {
        if (isTimerRunning) {
            // Stop
            setIsTimerRunning(false);
            setShowTimeEntryModal(true);
        } else {
            // Start
            setTimerSession(0);
            setTimerStartTime(Date.now());
            setIsTimerRunning(true);
        }
    };

    const handleResumeTimer = (log: any) => {
        if (isTimerRunning) {
            if (!confirm("Arrêter le chrono en cours pour reprendre cette tâche ?")) return;
            handleToggleTimer(); // Will open save modal for current
        }
        // Ideally we start timer immediately with this desc prefilled?
        // Let's just start a new timer
        setTimerSession(0);
        setTimerStartTime(Date.now());
        setIsTimerRunning(true);
        // We could store the "resumed task" description somewhere to prefill the save modal later
        // For simplicity, we'll just start. User types description at the end.
        // OR better: Start timer and set a "current task" state.
        setTimeEntryDesc(log.description);
        onNotify("Reprise de tâche", `Chrono lancé pour : ${log.description}`, "info");
    };

    const handleSaveTimeEntry = async () => {
        if (!timeEntryDesc.trim()) { alert("Description requise !"); return; }
        
        const newEntry = {
            id: `log-${Date.now()}`,
            description: timeEntryDesc,
            duration: timerSession, // seconds
            startTime: timerStartTime || Date.now(),
            date: new Date().toISOString(),
            status: 'pending' // pending billing
        };

        try {
            await apiFetch('/api/v1/time/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: project.id, entry: newEntry })
            });
            setTimeLogs([newEntry, ...timeLogs]);
            onNotify("Temps enregistré", `${formatDuration(timerSession)} ajoutés.`, "success");
            setShowTimeEntryModal(false);
            setTimeEntryDesc('');
            setTimerSession(0);
        } catch (e) {
            alert("Erreur lors de l'enregistrement");
        }
    };

    const handleUpdateLog = async (logId: string) => {
        // Here we would implement an update endpoint API.
        // For now, let's just update local state to simulate.
        // Real implementation needs backend support for updates.
        // Assuming we can just overwrite the log list or delete/add.
        
        // Let's assume we just update locally for demo
        const updatedLogs = timeLogs.map(l => {
            if (l.id === logId) {
                // Parse duration string "HH:MM:SS" back to seconds roughly
                // Or just trust user input if we had a duration picker.
                // Simple edit: Description only for now to be safe.
                return { ...l, description: editingLogDesc };
            }
            return l;
        });
        setTimeLogs(updatedLogs);
        setEditingLogId(null);
        // Note: Ideally send to backend here.
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    };

    // --- FILE BROWSER LOGIC ---
    const fetchFiles = async (subPath: string) => {
        setIsLoadingFiles(true);
        const safeClientName = project.id;
        const fullPath = subPath ? `${safeClientName}/${subPath}` : safeClientName;

        try {
            const res = await apiFetch('/api/v1/files/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: fullPath })
            });
            const data = await res.json();
            if (data.items) {
                setFileItems(data.items);
            } else {
                setFileItems([]);
            }
        } catch (e) {
            console.error("Failed to load files", e);
            setFileItems([]);
        } finally {
            setIsLoadingFiles(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'files') {
            fetchFiles(currentPath);
        }
    }, [activeTab, currentPath]);

    const handleFileNavigate = async (item: FinderItem) => {
        if (item.type === 'folder') {
            setPathHistory([...pathHistory, currentPath]);
            const nextPath = currentPath ? `${currentPath}/${item.name}` : item.name;
            setCurrentPath(nextPath);
        } else {
            try {
                const safeClientName = project.id;
                const relativeDir = currentPath ? `${safeClientName}/${currentPath}` : safeClientName;
                const filePath = `${relativeDir}/${item.name}`;
                
                await apiFetch('/api/v1/files/open', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: filePath })
                });
            } catch (e) {
                console.error("Failed to open file", e);
            }
        }
    };

    const handleFileBack = () => {
        if (pathHistory.length > 0) {
            const prev = pathHistory[pathHistory.length - 1];
            setCurrentPath(prev);
            setPathHistory(pathHistory.slice(0, -1));
        }
    };

    const handleRenameFile = async (item: FinderItem, newName: string) => {
        try {
            const safeClientName = project.id;
            const relativeDir = currentPath ? `${safeClientName}/${currentPath}` : safeClientName;
            const oldPath = `${relativeDir}/${item.name}`;
            
            const res = await apiFetch('/api/v1/files/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPath, newName })
            });
            
            if (res.ok) {
                onNotify("Renommé", `Fichier renommé en ${newName}`, 'success');
                fetchFiles(currentPath);
            } else {
                alert("Erreur lors du renommage");
            }
        } catch (e) {
            console.error(e);
            alert("Erreur serveur");
        }
    };

    const handleDeleteFile = async (item: FinderItem) => {
        try {
            const safeClientName = project.id;
            const relativeDir = currentPath ? `${safeClientName}/${currentPath}` : safeClientName;
            const filePath = `${relativeDir}/${item.name}`;

            const res = await apiFetch('/api/v1/files/delete_item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: filePath })
            });

            if (res.ok) {
                onNotify("Supprimé", `"${item.name}" a été supprimé.`, 'warning');
                fetchFiles(currentPath);
            } else {
                alert("Erreur lors de la suppression");
            }
        } catch (e) {
            console.error(e);
            alert("Erreur serveur");
        }
    };

    // --- Google Drive Sync ---
    const handleSyncToDrive = async () => {
        setIsSyncingToDrive(true);
        try {
            // Check if connected to Google Drive
            const statusRes = await apiFetch('/api/v1/oauth/google/status');
            const statusData = await statusRes.json();
            
            if (!statusData.connected) {
                onNotify('Non connecté', 'Connecte-toi d\'abord à Google Drive dans Paramètres → Cloud & Sync', 'warning');
                setIsSyncingToDrive(false);
                return;
            }

            // Get the cloud config for folder preference
            const cloudConfig = localStorage.getItem('marion_cloud_config');
            const config = cloudConfig ? JSON.parse(cloudConfig) : {};
            const driveFolder = config.googleDrive?.folder || '';

            // Sync the client folder
            const res = await apiFetch('/api/v1/drive/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_folder: project.id,
                    drive_folder_name: driveFolder
                })
            });

            const data = await res.json();

            if (data.success) {
                const syncTime = new Date().toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                setLastSyncTime(syncTime);
                try { localStorage.setItem(`marion_drive_sync_${project.id}`, syncTime); } catch {}
                onNotify('Sync réussie', `${data.synced_files?.length || 0} fichier(s) synchronisé(s) vers Google Drive`, 'success');
            } else {
                onNotify('Erreur de sync', data.error || 'Une erreur est survenue', 'warning');
            }
        } catch (e) {
            console.error('Sync error:', e);
            onNotify('Erreur', 'Impossible de synchroniser avec Google Drive', 'warning');
        } finally {
            setIsSyncingToDrive(false);
        }
    };

    // --- Helpers: Templates ---
    const updatePhaseWithTemplates = (newPhase: WorkflowPhase) => {
        const templatesSource = project.status === ProjectStatus.PROSPECT
            ? PROSPECT_PHASE_TEMPLATES 
            : ACTIVE_PHASE_TEMPLATES;

        // @ts-ignore
        const templates = templatesSource[newPhase] || [];
        
        const existingTitles = new Set(project.tasks.map(t => t.title));
        const newTasks: Task[] = templates
            .filter(tpl => !existingTitles.has(tpl.title))
            .map(tpl => ({
                id: `t-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: tpl.title,
                description: tpl.description,
                priority: tpl.priority as any,
                dueDate: tpl.dueDate,
                completed: false,
                column: 'todo', // Default to Todo
                phase: newPhase
            }));

        const updatedProject = { 
            ...project, 
            phase: newPhase,
            tasks: [...project.tasks, ...newTasks]
        };

        onUpdateProject(updatedProject);
        
        if (newTasks.length > 0) {
             confetti({ particleCount: 40, spread: 70, colors: ['#5BBFBA', '#FFD700'] });
        }
    };

    // --- PROMOTE/ARCHIVE/DELETE ---
    const handleChangeStatus = async (newStatus: ProjectStatus, category?: string) => {
        try {
            const res = await apiFetch('/api/v1/projects/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    clientName: project.clientName, 
                    newStatus: newStatus,
                    archiveCategory: category 
                })
            });
            const data = await res.json();
            
            if (data.success) {
                if (newStatus === ProjectStatus.EN_COURS) {
                    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                }
                
                const updated = { 
                    ...project, 
                    status: newStatus, 
                    id: data.path,
                    archiveCategory: category // Can be undefined, which clears it
                };
                
                onUpdateProject(updated, project.id);
                onNotify("Statut Mis à jour", `Dossier déplacé vers ${newStatus}.`, 'success');
                setShowArchiveModal(false);
            } else {
                alert("Erreur: " + data.error);
            }
        } catch (e: any) { alert("Erreur serveur lors du déplacement"); }
    };

    const handlePromote = () => {
        if (confirm(`Passer ${project.clientName} en mode EN COURS ?`)) {
            handleChangeStatus(ProjectStatus.EN_COURS);
        }
    };

    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const ARCHIVE_CATEGORIES = ["0. Associations", "1. Corporate", "2. Avocats", "3. Médical", "4. Immobilier", "5. Mariages", "6. Autre", "Audits"];

    const handleArchive = () => {
        setShowArchiveModal(true);
    };

    const confirmArchive = (category: string) => {
        handleChangeStatus(ProjectStatus.ARCHIVED, category);
    };

    const handleDeleteClient = () => {
        if (confirm(`SUPPRIMER DÉFINITIVEMENT ${project.clientName} ?`)) {
            if (!confirm("Vraiment certaine ?")) return;
            onNotify("Client Supprimé", "Dossier effacé.", 'warning');
            if (onDelete) onDelete(project.id);
        }
    };

    // --- KANBAN TASK LOGIC ---
    const moveTask = (taskId: string, targetColumn: 'todo' | 'doing' | 'done') => {
        const updatedTasks = project.tasks.map(t => {
            if (t.id === taskId) {
                const isCompleted = targetColumn === 'done';
                if (isCompleted && !t.completed) {
                    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');
                    audio.volume = 0.2;
                    audio.play().catch(() => {});
                    confetti({ particleCount: 30, spread: 40, origin: { x: 0.7, y: 0.5 }, colors: ['#FF7E5F', '#FEB47B'] });
                }
                return { ...t, column: targetColumn, completed: isCompleted };
            }
            return t;
        });
        updateProjectTasks(updatedTasks);
    };

    const handleOpenTaskModal = (task?: Task, defaultColumn: 'todo' | 'doing' | 'done' = 'todo') => {
        if (task) {
            setEditingTask(task);
            setNewTaskTitle(task.title);
            setNewTaskDescription(task.description || '');
            setNewTaskPriority(task.priority);
            setNewTaskStatus(task.column || (task.completed ? 'done' : 'todo'));
            setNewTaskDueDate(task.dueDate || '');
        } else {
            setEditingTask(null);
            setNewTaskTitle('');
            setNewTaskDescription('');
            setNewTaskPriority('Medium');
            setNewTaskStatus(defaultColumn);
            setNewTaskDueDate('');
        }
        setShowTaskModal(true);
    };

    const handleSaveTask = () => {
        if (!newTaskTitle.trim()) return;

        let updatedTasks = [...project.tasks];

        if (editingTask) {
            // Update existing
            updatedTasks = updatedTasks.map(t => t.id === editingTask.id ? {
                ...t,
                title: newTaskTitle,
                description: newTaskDescription,
                priority: newTaskPriority,
                column: newTaskStatus,
                completed: newTaskStatus === 'done',
                dueDate: newTaskDueDate || undefined
            } : t);
        } else {
            // Create new
            const newTask: Task = {
                id: `t-${Date.now()}`,
                title: newTaskTitle,
                description: newTaskDescription,
                completed: newTaskStatus === 'done',
                column: newTaskStatus,
                priority: newTaskPriority,
                phase: project.phase,
                dueDate: newTaskDueDate || undefined
            };
            updatedTasks.push(newTask);
            confetti({ particleCount: 20, spread: 30, colors: ['#5BBFBA'] });
        }
        
        updateProjectTasks(updatedTasks);
        setShowTaskModal(false);
    };

    const handleDeleteTask = (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const task = project.tasks.find(t => t.id === taskId);
        if (!task) return;
        const previousTasks = [...project.tasks];
        updateProjectTasks(project.tasks.filter(t => t.id !== taskId));
        pushUndo({
            description: `Tâche "${task.title}" supprimée`,
            restore: () => {
                onUpdateProject({ ...project, tasks: previousTasks, progress: Math.round((previousTasks.filter(t => t.completed).length / previousTasks.length) * 100) });
            },
        });
    };

    const updateProjectTasks = (tasks: Task[]) => {
        const completed = tasks.filter(t => t.completed).length;
        const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
        onUpdateProject({ ...project, tasks, progress });
    };

    // --- DND-KIT DRAG AND DROP ---
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    );

    const getTaskColumn = (task: Task): 'todo' | 'doing' | 'done' => {
        if (task.column) return task.column;
        if (task.completed) return 'done';
        return 'todo';
    };

    const priorityRank = { High: 0, Medium: 1, Low: 2 };

    const getColumnTasks = (columnId: 'todo' | 'doing' | 'done') => {
        return project.tasks
            .filter(t => getTaskColumn(t) === columnId)
            .sort((a, b) => {
                // Primary: effective priority (High first)
                const pa = priorityRank[getEffectivePriority(a)];
                const pb = priorityRank[getEffectivePriority(b)];
                if (pa !== pb) return pa - pb;
                // Secondary: manual sort order
                return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
            });
    };

    const todoTasks = useMemo(() => getColumnTasks('todo'), [project.tasks]);
    const doingTasks = useMemo(() => getColumnTasks('doing'), [project.tasks]);
    const doneTasks = useMemo(() => getColumnTasks('done'), [project.tasks]);

    const todoIds = useMemo(() => todoTasks.map(t => t.id), [todoTasks]);
    const doingIds = useMemo(() => doingTasks.map(t => t.id), [doingTasks]);
    const doneIds = useMemo(() => doneTasks.map(t => t.id), [doneTasks]);

    const findColumnOfTask = (taskId: string): 'todo' | 'doing' | 'done' | null => {
        if (todoIds.includes(taskId)) return 'todo';
        if (doingIds.includes(taskId)) return 'doing';
        if (doneIds.includes(taskId)) return 'done';
        return null;
    };

    const handleDndDragStart = (event: DragStartEvent) => {
        setDraggedTaskId(event.active.id as string);
    };

    // No onDragOver handler — we do NOT move items between columns during drag.
    // All moves (same-column reorder + cross-column) happen in onDragEnd only.
    // This avoids DOM thrashing that breaks useSortable transforms.

    const handleDndDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setDraggedTaskId(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        const activeColumn = findColumnOfTask(activeId);
        // overId could be a task id OR a column id (when dropping on empty column)
        let overColumn = findColumnOfTask(overId);
        if (!overColumn && ['todo', 'doing', 'done'].includes(overId)) {
            overColumn = overId as 'todo' | 'doing' | 'done';
        }

        if (!activeColumn || !overColumn) return;

        if (activeColumn === overColumn) {
            // Reorder within the same column
            const columnTasksList = getColumnTasks(activeColumn);
            const oldIndex = columnTasksList.findIndex(t => t.id === activeId);
            const newIndex = columnTasksList.findIndex(t => t.id === overId);

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                const reordered = arrayMove(columnTasksList, oldIndex, newIndex);
                const reorderedWithOrder = reordered.map((t, i) => ({ ...t, sortOrder: i }));
                const otherTasks = project.tasks.filter(t => getTaskColumn(t) !== activeColumn);
                updateProjectTasks([...otherTasks, ...reorderedWithOrder]);
            }
        } else {
            // Cross-column drop
            const activeTask = project.tasks.find(t => t.id === activeId);
            if (!activeTask) return;

            const isCompleted = overColumn === 'done';
            if (isCompleted && !activeTask.completed) {
                const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');
                audio.volume = 0.2;
                audio.play().catch(() => {});
                confetti({ particleCount: 30, spread: 40, origin: { x: 0.7, y: 0.5 }, colors: ['#FF7E5F', '#FEB47B'] });
            }

            // Insert at the position of the over item, or at the end
            const targetColTasks = getColumnTasks(overColumn);
            const overIndex = targetColTasks.findIndex(t => t.id === overId);
            const insertIndex = overIndex !== -1 ? overIndex : targetColTasks.length;

            const withoutActive = targetColTasks.filter(t => t.id !== activeId);
            const movedTask = { ...activeTask, column: overColumn, completed: isCompleted };
            withoutActive.splice(insertIndex, 0, movedTask);
            const reorderedTarget = withoutActive.map((t, i) => ({ ...t, sortOrder: i }));

            const otherTasks = project.tasks.filter(t => t.id !== activeId && getTaskColumn(t) !== overColumn);
            updateProjectTasks([...otherTasks, ...reorderedTarget]);
        }
    };

    // --- MEETING NOTES LOGIC ---
    const handleSaveMeetingNotes = (notes: MeetingReport) => {
        let updatedTasks = [...project.tasks];
        const existingReports = mergedMeetingReports;
        const reportId = notes?.id || `meeting-${Date.now()}`;
        const normalizedReport: MeetingReport = {
            ...notes,
            id: reportId,
            clientName: project.clientName,
            generatedAt: notes.generatedAt || new Date().toISOString(),
            keyPoints: notes.keyPoints || [],
            decisions: notes.decisions || [],
            risks: notes.risks || [],
            objections: notes.objections || [],
            nextSteps: notes.nextSteps || [],
            tasks: notes.tasks || [],
        };

        // Add tasks identified by AI — deduplicate by normalized title
        let newTaskCount = 0;
        if (normalizedReport.tasks && normalizedReport.tasks.length > 0) {
            const existingTitles = new Set(updatedTasks.map(t => t.title.trim().toLowerCase()));
            normalizedReport.tasks.forEach(aiTask => {
                const normalizedTitle = (aiTask.title || '').trim();
                if (!normalizedTitle || existingTitles.has(normalizedTitle.toLowerCase())) return;
                existingTitles.add(normalizedTitle.toLowerCase());
                const newTask: Task = {
                    id: `t-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    title: normalizedTitle,
                    description: [
                        aiTask.owner ? `Assigné à: ${aiTask.owner}` : '',
                        aiTask.deadline ? `Échéance: ${aiTask.deadline}` : '',
                        'Issue de la réunion.',
                    ].filter(Boolean).join(' — '),
                    completed: false,
                    column: 'todo',
                    priority: aiTask.priority || 'Medium',
                    phase: project.phase,
                    dueDate: aiTask.deadline || undefined,
                };
                updatedTasks.push(newTask);
                newTaskCount++;
            });
        }

        const nextReports = [normalizedReport, ...existingReports].slice(0, 25);
        setLocalMeetingReports(nextReports);
        try {
            localStorage.setItem(localMeetingReportsKey, JSON.stringify(nextReports));
        } catch {}

        onUpdateProject({
            ...project,
            tasks: updatedTasks,
            meetingReports: nextReports,
        });
        setShowMeetingMode(false);
        const taskMsg = newTaskCount > 0
            ? `${newTaskCount} tâche(s) créée(s) dans le Kanban.`
            : 'Aucune nouvelle tâche.';
        onNotify('Compte-rendu enregistré', `Le rapport a été ajouté au projet. ${taskMsg}`, 'ai');
    };

    const handleOpenMeetingEmail = (draft: { to: string; subject: string; body: string }) => {
        setMeetingFollowUpDraft(draft);
        setShowMeetingMode(false);
        setActiveTab('emails');
    };

    const handleExportMeetingReport = async (report: MeetingReport, variant: 'internal' | 'client' = 'internal') => {
        try {
            await exportMeetingReportPdf(report, variant);
            onNotify('PDF généré', 'Le compte-rendu a été exporté en PDF.', 'success');
        } catch (_e) {
            onNotify('Export PDF impossible', "Le PDF du compte-rendu n'a pas pu être généré.", 'error');
        }
    };

    const handleCopyFollowUp = async (report: MeetingReport) => {
        if (!report.followUpDraft) {
            onNotify('Aucun brouillon', "Ce compte-rendu n'a pas de follow-up prêt.", 'warning');
            return;
        }
        try {
            await navigator.clipboard.writeText(report.followUpDraft);
            onNotify('Follow-up copié', 'Le brouillon a été copié dans le presse-papiers.', 'success');
        } catch (_e) {
            onNotify('Copie impossible', 'Le navigateur a refusé la copie.', 'error');
        }
    };

    // --- PROFILE & BRAND ---
    const handleEditProfileSave = () => {
        onUpdateProject({ ...project, profile: tempProfile });
        setIsEditingProfile(false);
    };

    const handleEditProfileCancel = () => {
        setTempProfile(project.profile); // Reset to original profile
        setIsEditingProfile(false);
    };

    const handleRandomizeAvatar = () => {
        const gradients = ['from-purple-400 to-indigo-500', 'from-green-400 to-teal-500', 'from-yellow-400 to-orange-500', 'from-pink-400 to-rose-500'];
        onUpdateProject({ ...project, avatarColor: gradients[Math.floor(Math.random() * gradients.length)], avatarImage: undefined });
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onUpdateProject({ ...project, avatarImage: reader.result as string });
                onNotify("Logo mis à jour", "La nouvelle identité visuelle est enregistrée.", "success");
            };
            reader.readAsDataURL(file);
        }
    };

    // --- LOGO EDITOR ---
    const handleLogoEditorOpen = () => {
        if (!project.avatarImage) return;
        setLogoEditorTransform(project.logoTransform || { x: 0, y: 0, scale: 1 });
        setShowLogoEditor(true);
    };

    const handleLogoEditorSave = () => {
        onUpdateProject({ ...project, logoTransform: logoEditorTransform });
        setShowLogoEditor(false);
        onNotify("Logo ajusté", "La position du logo est enregistrée.", "success");
    };

    const handleLogoEditorReset = () => {
        setLogoEditorTransform({ x: 0, y: 0, scale: 1 });
    };

    const handleLogoDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setLogoDragging(true);
        setLogoDragStart({ x: clientX, y: clientY, tx: logoEditorTransform.x, ty: logoEditorTransform.y });
    }, [logoEditorTransform]);

    const handleLogoDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!logoDragging) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const dx = clientX - logoDragStart.x;
        const dy = clientY - logoDragStart.y;
        setLogoEditorTransform(prev => ({ ...prev, x: logoDragStart.tx + dx, y: logoDragStart.ty + dy }));
    }, [logoDragging, logoDragStart]);

    const handleLogoDragEnd = useCallback(() => {
        setLogoDragging(false);
    }, []);

    const handleLogoWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        setLogoEditorTransform(prev => ({ ...prev, scale: Math.max(0.5, Math.min(4, prev.scale + delta)) }));
    }, []);

    // --- CREDENTIALS LOGIC ---
    const handleAddCredential = (newCred: Credential) => {
        onUpdateProject({ ...project, credentials: [...(project.credentials || []), newCred] });
        onNotify("Identifiant ajouté !", "Le nouvel accès est enregistré.", "success");
        setShowCredentialModal(false);
    };

    const handleEditCredential = (updatedCred: Credential) => {
        onUpdateProject({ 
            ...project, 
            credentials: (project.credentials || []).map(cred => cred.id === updatedCred.id ? updatedCred : cred) 
        });
        onNotify("Identifiant mis à jour !", "Les modifications ont été sauvegardées.", "info");
        setShowCredentialModal(false);
    };

    const handleDeleteCredential = (credId: string) => {
        const cred = (project.credentials || []).find(c => c.id === credId);
        if (!cred) return;
        const previousCredentials = [...(project.credentials || [])];
        onUpdateProject({ ...project, credentials: previousCredentials.filter(c => c.id !== credId) });
        pushUndo({
            description: `Identifiant "${cred.service}" supprimé`,
            restore: () => {
                onUpdateProject({ ...project, credentials: previousCredentials });
            },
        });
    };

    // --- INVOICE LOGIC ---
    const handleOpenInvoiceModal = (invoice?: Invoice) => {
        if (invoice) setSelectedInvoice(invoice);
        else setSelectedInvoice({ id: `inv-${Date.now()}`, number: `F${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`, date: new Date().toISOString().split('T')[0], amount: 0, status: 'Draft', type: 'Invoice', items: [], clientAddress: '' });
        setShowInvoiceModal(true);
    }

    const handleSaveInvoice = (invoice: Invoice) => {
        let updatedInvoices = [...project.invoices];
        if (project.invoices.find(i => i.id === invoice.id)) updatedInvoices = updatedInvoices.map(i => i.id === invoice.id ? invoice : i);
        else updatedInvoices.push(invoice);
        onUpdateProject({ ...project, invoices: updatedInvoices });
    };

    const handleDeleteInvoice = (invId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const invoice = project.invoices.find(i => i.id === invId);
        if (!invoice) return;
        const previousInvoices = [...project.invoices];
        onUpdateProject({ ...project, invoices: project.invoices.filter(i => i.id !== invId) });
        pushUndo({
            description: `Facture ${invoice.number || invId.slice(0, 8)} supprimée`,
            restore: () => {
                onUpdateProject({ ...project, invoices: previousInvoices });
            },
        });
    }

    // --- WORKFLOW HELPERS ---
    const getPhaseBg = (phase: string) => {
        // @ts-ignore
        return WORKFLOW_CONFIG[phase]?.bg || 'bg-slate-100';
    }

    const handleCopy = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        onNotify("Copié !", "", 'success');
    };

    // --- KANBAN RENDER HELPERS ---
    const getColumnLabel = (column: 'todo' | 'doing' | 'done') => {
        switch (column) {
            case 'todo':
                return 'À Faire';
            case 'doing':
                return 'En Cours';
            case 'done':
                return 'Terminé';
            default:
                return column;
        }
    };

    const handleTaskKeyDown = (
        e: React.KeyboardEvent<HTMLDivElement>,
        task: Task,
        columnId: 'todo' | 'doing' | 'done',
    ) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleOpenTaskModal(task);
        } else if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            const targetColumn: 'todo' | 'doing' | 'done' =
                task.completed || columnId === 'done' ? 'todo' : 'done';
            moveTask(task.id, targetColumn);
        }
    };

    const renderKanbanColumn = (columnId: 'todo' | 'doing' | 'done', title: string, columnTasks: Task[], taskIds: string[]) => {
        const kanbanOrder: Array<'todo' | 'doing' | 'done'> = ['todo', 'doing', 'done'];
        const currentIndex = kanbanOrder.indexOf(columnId);
        const prevColumn = currentIndex > 0 ? kanbanOrder[currentIndex - 1] : null;
        const nextColumn = currentIndex < kanbanOrder.length - 1 ? kanbanOrder[currentIndex + 1] : null;

        const bgColor = columnId === 'todo' ? 'bg-slate-50 dark:bg-slate-800/50' : 
                       columnId === 'doing' ? 'bg-blue-50 dark:bg-blue-900/10' : 
                       'bg-green-50 dark:bg-green-900/10';
        
        const titleColor = columnId === 'todo' ? 'text-slate-500' : 
                          columnId === 'doing' ? 'text-blue-500' : 
                          'text-green-500';

        return (
            <DroppableColumn id={columnId}>
                <div 
                    className={`flex-1 rounded-2xl ${bgColor} p-3 flex flex-col min-h-[150px] md:min-h-[400px] md:h-full transition-colors ${draggedTaskId ? 'border-2 border-dashed border-slate-300 dark:border-slate-700' : 'border border-transparent'}`}
                    role="list"
                    aria-label={title}
                >
                    <div className="flex justify-between items-center mb-3">
                        <h4 className={`text-xs font-bold uppercase tracking-widest ${titleColor} flex items-center gap-2`}>
                            {title} <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-700 text-slate-500 text-[10px] shadow-sm">{columnTasks.length}</span>
                        </h4>
                        <button 
                            onClick={() => handleOpenTaskModal(undefined, columnId)} 
                            className="p-1 rounded-full hover:bg-white/50 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
                            aria-label={`Ajouter une tâche dans la colonne ${getColumnLabel(columnId)}`}
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                        <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar pb-10">
                            {columnTasks.map(task => (
                                <SortableTaskCard
                                    key={task.id}
                                    task={task}
                                    isDragging={draggedTaskId === task.id}
                                    onEdit={handleOpenTaskModal}
                                    onDelete={handleDeleteTask}
                                    onMove={moveTask}
                                    onKeyDown={handleTaskKeyDown}
                                    columnId={columnId}
                                    prevColumn={prevColumn}
                                    nextColumn={nextColumn}
                                    getColumnLabel={getColumnLabel}
                                />
                            ))}
                            {columnTasks.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-300 text-xs">
                                    <Archive size={20} className="mb-2 opacity-50" />
                                    <span>Vide</span>
                                </div>
                            )}
                        </div>
                    </SortableContext>
                </div>
            </DroppableColumn>
        );
    };

    return (
        <div className="animate-in fade-in slide-in-from-right-8 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 md:gap-6 mb-4 md:mb-8">
                <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                    <button 
                        onClick={onBack} 
                        className="p-2.5 rounded-full hover:bg-white/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                        aria-label="Revenir à la liste des clients"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>

                    <div className="flex-1 min-w-0">
                        <h1 className="text-3xl md:text-6xl font-sans text-slate-800 dark:text-white tracking-wide pt-2 truncate">{project.clientName}</h1>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                        <span className="tabular-nums bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">{project.status.toUpperCase()}/{project.clientName.toUpperCase()}</span>
                        <span>•</span>
                        <select 
                            value={project.status}
                            onChange={(e) => {
                                const newStatus = e.target.value as ProjectStatus;
                                if (newStatus === ProjectStatus.ARCHIVED) {
                                    setShowArchiveModal(true);
                                } else {
                                    handleChangeStatus(newStatus);
                                }
                            }}
                            className="bg-transparent border-b border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider outline-none cursor-pointer hover:text-brand-orange hover:border-brand-orange transition-all py-0.5"
                        >
                            {Object.values(ProjectStatus).map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        {project.status === ProjectStatus.ARCHIVED && project.archiveCategory && (
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                - {project.archiveCategory}
                            </span>
                        )}
                        <span>•</span>
                        <span>Créé le {new Date(project.createdAt).toLocaleDateString()}</span>
                    </div>
                    </div>
                </div>
                
                {/* TIMER BUTTON IN HEADER – à droite du nom */}
                <div className="flex gap-3 items-center">
                    {project.tasks.length === 0 && (
                        <button onClick={() => updatePhaseWithTemplates(WorkflowPhase.DISCOVERY)} className="px-6 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 text-white rounded-full font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all duration-300 flex items-center gap-2 shadow-lg shadow-emerald-200/50 dark:shadow-none animate-pulse">
                            <Play size={16} /> Commencer
                        </button>
                    )}
                    {project.status === ProjectStatus.PROSPECT && (
                        <button onClick={handlePromote} className="px-5 py-2 bg-gradient-to-r from-brand-orange to-rose-500 text-white rounded-full font-bold text-sm hover:scale-105 transition-all flex items-center gap-2">
                            <Rocket size={16} /> Passer en cours
                        </button>
                    )}
                    {project.status === ProjectStatus.EN_COURS && (
                        <button 
                            onClick={handleToggleTimer}
                            className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wider uppercase shadow-sm transition-all duration-300 border ${
                                isTimerRunning 
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-400/60 shadow-emerald-200/60' 
                                    : 'bg-white/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white shadow-sm">
                                {isTimerRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                            </span>
                            <span className="tabular-nums text-sm">{formatDuration(timerSession)}</span>
                        </button>
                    )}
                    {project.status !== ProjectStatus.ARCHIVED && (
                        <button onClick={handleArchive} className="group flex items-center gap-2 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                            <Archive size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Creative Workflow Timeline */}
            {(() => {
                const currentIdx = WORKFLOW_STEPS.indexOf(project.phase);
                const progressPct = Math.round(((currentIdx + 1) / WORKFLOW_STEPS.length) * 100);
                return (
                <div className="mb-8 relative rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/60 dark:border-white/5 shadow-lg shadow-slate-200/30 dark:shadow-none">
                    {/* Decorative gradient top strip */}
                    <div className="h-1 rounded-t-3xl" style={{ background: 'linear-gradient(90deg, #facc15, #38bdf8, #ec4899, #8b5cf6, #f97316, #10b981)' }} />

                    <div className="p-6 pb-8 pt-5">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Workflow</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Phase actuelle : <span className={`font-bold ${WORKFLOW_CONFIG[project.phase]?.color || 'text-slate-700'}`}>{WORKFLOW_CONFIG[project.phase]?.label || project.phase}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500">{progressPct}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-8">
                            <div
                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                style={{
                                    width: `${progressPct}%`,
                                    background: 'linear-gradient(90deg, #facc15 0%, #38bdf8 20%, #ec4899 40%, #8b5cf6 60%, #f97316 80%, #10b981 100%)',
                                }}
                            />
                        </div>

                        {/* Phase nodes */}
                        <div className="relative flex justify-between items-start">
                            {/* Connecting line - aligned to center of node circles (22px badge + 6px margin + 24px half-node = ~52px) */}
                            <div className="absolute top-[46px] left-0 right-0" style={{ left: `${100 / (WORKFLOW_STEPS.length * 2)}%`, right: `${100 / (WORKFLOW_STEPS.length * 2)}%` }}>
                                <div className="w-full h-[3px] bg-slate-100 dark:bg-slate-700 rounded-full" />
                                <div
                                    className="absolute top-0 left-0 h-[3px] rounded-full transition-all duration-1000 ease-out"
                                    style={{
                                        width: currentIdx === 0 ? '0%' : `${(currentIdx / (WORKFLOW_STEPS.length - 1)) * 100}%`,
                                        background: 'linear-gradient(90deg, #facc15, #38bdf8, #ec4899, #8b5cf6, #f97316, #10b981)',
                                    }}
                                />
                            </div>

                            {WORKFLOW_STEPS.map((step, idx) => {
                                // @ts-ignore
                                const config = WORKFLOW_CONFIG?.[step] || { label: step, icon: Circle, color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200', gradient: 'from-slate-400 to-slate-500', desc: '' };
                                const Icon = config.icon || Circle;
                                const isCurrent = idx === currentIdx;
                                const isPast = idx < currentIdx;
                                const isFuture = idx > currentIdx;

                                return (
                                    <div key={step} onClick={() => updatePhaseWithTemplates(step)}
                                         className={`flex flex-col items-center flex-1 cursor-pointer transition-all duration-500 group relative z-10 ${isCurrent ? '' : 'hover:-translate-y-1'}`}>

                                        {/* "En cours" badge */}
                                        {isCurrent && (
                                            <div className="mb-1.5 whitespace-nowrap">
                                                <span className="text-[8px] font-bold text-white bg-gradient-to-r from-orange-500 to-pink-500 px-2.5 py-0.5 rounded-full shadow-md shadow-orange-200/50 dark:shadow-none">
                                                    En cours
                                                </span>
                                            </div>
                                        )}
                                        {/* Spacer for non-current phases to align nodes */}
                                        {!isCurrent && <div className="h-[22px]" />}

                                        {/* Node */}
                                        <div className={`relative flex items-center justify-center rounded-full transition-all duration-500 ${
                                            isCurrent
                                                ? `w-16 h-16 bg-gradient-to-br ${config.gradient} text-white shadow-xl scale-110`
                                                : isPast
                                                ? `w-12 h-12 bg-gradient-to-br ${config.gradient} text-white shadow-md`
                                                : 'w-12 h-12 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-600 text-slate-300 dark:text-slate-600'
                                        }`}>
                                            {/* Glow ring */}
                                            {isCurrent && (
                                                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${config.gradient} opacity-25 animate-ping`}
                                                     style={{ animationDuration: '2.5s' }} />
                                            )}

                                            <Icon size={isCurrent ? 26 : 18} strokeWidth={isCurrent ? 2.5 : 2} className="relative z-10" />

                                            {/* Check badge for completed */}
                                            {isPast && (
                                                <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow border-2 border-emerald-500">
                                                    <Check size={12} className="text-emerald-500" strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Label + description */}
                                        <div className={`text-center mt-3 transition-all duration-300 ${isFuture ? 'opacity-40 group-hover:opacity-100' : ''}`}>
                                            <div className={`text-[10px] font-bold uppercase tracking-wider leading-tight ${
                                                isCurrent ? config.color
                                                : isPast ? 'text-slate-600 dark:text-slate-300'
                                                : 'text-slate-400 dark:text-slate-500'
                                            }`}>
                                                {config.label}
                                            </div>
                                            <div className={`text-[8px] mt-0.5 leading-tight ${
                                                isCurrent ? 'text-slate-500 dark:text-slate-400'
                                                : isFuture ? 'text-slate-300 dark:text-slate-600'
                                                : 'text-slate-400 dark:text-slate-500'
                                            }`}>
                                                {config.desc}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-start">
                {/* Left Col: Info - collapsed on mobile */}
                <div className="space-y-4 md:space-y-6">
                    {/* Visual Identity */}
                    <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border-white/50 dark:border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex gap-1">
                             {project.avatarImage && (
                                <button onClick={handleLogoEditorOpen} className="p-2 bg-white/50 rounded-full hover:bg-white transition-colors" title="Ajuster le logo">
                                    <Move size={14} />
                                </button>
                             )}
                             <button onClick={handleRandomizeAvatar} className="p-2 bg-white/50 rounded-full hover:bg-white transition-colors"><RefreshCw size={14} /></button>
                        </div>
                        <div className="relative z-10 flex flex-col items-center gap-6 py-4">
                             <h3 className="text-lg font-serif opacity-60 w-full text-center dark:text-white">Identité Visuelle</h3>
                             <div className="relative cursor-pointer transition-transform hover:scale-105" onClick={() => fileInputRef.current?.click()}>
                                {project.avatarImage ? (
                                    <div className="w-32 h-32 rounded-full overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none border-4 border-white dark:border-slate-700">
                                        <img 
                                            src={project.avatarImage} 
                                            alt="Client Avatar" 
                                            className="w-full h-full object-cover"
                                            style={project.logoTransform ? {
                                                transform: `translate(${project.logoTransform.x}px, ${project.logoTransform.y}px) scale(${project.logoTransform.scale})`,
                                            } : undefined}
                                        />
                                    </div>
                                ) : (
                                    <div className={`w-32 h-32 rounded-full flex items-center justify-center shadow-2xl shadow-slate-200/50 dark:shadow-none bg-gradient-to-br ${project.avatarColor || 'from-brand-primary to-brand-secondary'} text-white text-5xl font-serif`}>
                                        {project.avatarInitials}
                                    </div>
                                )}
                                <div className="absolute bottom-0 right-0 p-2.5 bg-slate-900 text-white rounded-full shadow-lg hover:bg-brand-orange transition-colors">
                                    <Upload size={16} />
                                </div>
                             </div>
                             <div className="flex items-center gap-3">
                                {project.avatarImage && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleLogoEditorOpen(); }}
                                        className="text-xs font-bold text-slate-400 hover:text-blue-500 flex items-center gap-1 transition-colors"
                                    >
                                        <Move size={12} /> Ajuster
                                    </button>
                                )}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setShowLogoLab(true); }}
                                    className="text-xs font-bold text-slate-400 hover:text-brand-orange flex items-center gap-1 transition-colors"
                                >
                                    <Wand2 size={12} /> Ouvrir Logo Lab
                                </button>
                             </div>
                             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/jpg, image/gif" />
                        </div>
                    </Card>

                    {/* Logo Editor Modal */}
                    {showLogoEditor && project.avatarImage && (
                        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowLogoEditor(false)}>
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700">
                                    <h3 className="font-bold text-sm dark:text-white flex items-center gap-2">
                                        <Move size={14} className="text-brand-orange" /> Ajuster le logo
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button onClick={handleLogoEditorReset} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                                            <RotateCcw size={12} /> Réinitialiser
                                        </button>
                                        <button onClick={() => setShowLogoEditor(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                                            <X size={16} className="text-slate-400" />
                                        </button>
                                    </div>
                                </div>

                                {/* Preview area - drag to reposition */}
                                <div className="p-6 flex flex-col items-center gap-4 bg-slate-50 dark:bg-slate-900/50">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Glissez pour déplacer • Molette pour zoomer</p>
                                    <div 
                                        className={`w-48 h-48 rounded-full overflow-hidden border-4 border-white dark:border-slate-700 shadow-2xl relative select-none ${logoDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                                        onMouseDown={handleLogoDragStart}
                                        onMouseMove={handleLogoDragMove}
                                        onMouseUp={handleLogoDragEnd}
                                        onMouseLeave={handleLogoDragEnd}
                                        onTouchStart={handleLogoDragStart}
                                        onTouchMove={handleLogoDragMove}
                                        onTouchEnd={handleLogoDragEnd}
                                        onWheel={handleLogoWheel}
                                    >
                                        <img 
                                            src={project.avatarImage} 
                                            alt="Logo preview" 
                                            className="w-full h-full object-cover pointer-events-none"
                                            draggable={false}
                                            style={{
                                                transform: `translate(${logoEditorTransform.x}px, ${logoEditorTransform.y}px) scale(${logoEditorTransform.scale})`,
                                            }}
                                        />
                                        {/* Center crosshair guide */}
                                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-20">
                                            <div className="w-px h-full bg-slate-400 absolute" />
                                            <div className="h-px w-full bg-slate-400 absolute" />
                                        </div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="px-5 py-4 space-y-3">
                                    {/* Scale slider */}
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => setLogoEditorTransform(prev => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.1) }))}
                                            className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            <ZoomOut size={14} className="text-slate-500" />
                                        </button>
                                        <input 
                                            type="range" 
                                            min="0.5" 
                                            max="4" 
                                            step="0.05" 
                                            value={logoEditorTransform.scale}
                                            onChange={e => setLogoEditorTransform(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                                            className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-brand-orange"
                                        />
                                        <button 
                                            onClick={() => setLogoEditorTransform(prev => ({ ...prev, scale: Math.min(4, prev.scale + 0.1) }))}
                                            className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            <ZoomIn size={14} className="text-slate-500" />
                                        </button>
                                        <span className="text-xs text-slate-400 w-10 text-right tabular-nums">{Math.round(logoEditorTransform.scale * 100)}%</span>
                                    </div>

                                    {/* Position display */}
                                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span>X: {Math.round(logoEditorTransform.x)}px • Y: {Math.round(logoEditorTransform.y)}px</span>
                                        <span>Zoom: {Math.round(logoEditorTransform.scale * 100)}%</span>
                                    </div>
                                </div>

                                {/* Footer actions */}
                                <div className="flex gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-700">
                                    <button 
                                        onClick={() => setShowLogoEditor(false)}
                                        className="flex-1 px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                    >
                                        Annuler
                                    </button>
                                    <button 
                                        onClick={handleLogoEditorSave}
                                        className="flex-1 px-4 py-2 text-sm bg-brand-orange text-white font-bold rounded-xl hover:bg-orange-600 transition-colors"
                                    >
                                        Enregistrer
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Client Profile */}
                    <Card>
                        <h3 className="text-xl font-serif mb-4 flex items-center justify-between">
                            Profil Client
                            {isEditingProfile ? (
                                <div className="flex gap-2">
                                    <button onClick={handleEditProfileCancel} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><X size={16} /></button>
                                    <button onClick={handleEditProfileSave} className="p-1.5 rounded-full bg-brand-orange text-white"><Save size={16} /></button>
                                </div>
                            ) : (
                                <button onClick={() => setIsEditingProfile(true)} className="text-xs text-brand-orange hover:underline flex items-center gap-1"><Edit2 size={12} /> Modifier</button>
                            )}
                        </h3>
                        <div className="space-y-4">
                             {['email', 'phone', 'website', 'address'].map(field => (
                                 <div key={field} className="group">
                                    <label className="text-xs text-slate-400 uppercase font-bold block mb-1">{field === 'address' ? 'Adresse' : field}</label>
                                    {isEditingProfile ? (
                                        field === 'address' ? (
                                            <textarea 
                                                className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:text-white resize-none h-20"
                                                value={(tempProfile as any)[field] || ''}
                                                onChange={(e) => setTempProfile({...tempProfile, [field]: e.target.value})}
                                                placeholder="Adresse complète..."
                                            />
                                        ) : (
                                            <input 
                                                className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                                                value={(tempProfile as any)[field] || ''}
                                                onChange={(e) => setTempProfile({...tempProfile, [field]: e.target.value})}
                                            />
                                        )
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate whitespace-pre-line">{(project.profile as any)[field] || '-'}</div>
                                            {(project.profile as any)[field] && <button onClick={() => handleCopy((project.profile as any)[field])} className="text-slate-300 hover:text-brand-orange"><Copy size={14} /></button>}
                                        </div>
                                    )}
                                 </div>
                             ))}
                        </div>
                    </Card>

                    <MaintenanceWidget 
                        project={project} 
                        onUpdateProject={onUpdateProject}
                    />

                    {/* Brand Center Trigger */}
                    <Card className="relative overflow-hidden group cursor-pointer hover:border-brand-orange transition-all" onClick={() => setShowBrandCenter(true)}>
                        <h3 className="text-xl font-serif mb-4 flex items-center gap-2 relative z-10">
                            <Palette size={20} className="text-brand-orange" /> Brand Center
                        </h3>
                        <div className="space-y-4 relative z-10">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <div className="flex -space-x-2">
                                    {(project.brandKit?.colors?.length ?? 0) > 0 ? (
                                        project.brandKit!.colors.slice(0, 4).map((c, i) => (
                                            <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-800" style={{ backgroundColor: c.hex }}></div>
                                        ))
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800"></div>
                                    )}
                                </div>
                                <span className="font-bold">{(project.brandKit?.colors?.length ?? 0)} couleurs</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <Type size={16} className="text-slate-400" />
                                <span className="font-bold">{(project.brandKit?.fonts?.length ?? 0)} polices</span>
                            </div>
                            <button className="w-full py-2 mt-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold group-hover:bg-brand-orange group-hover:text-white transition-colors flex items-center justify-center gap-2">
                                <Wand2 size={14} /> Ouvrir le Studio
                            </button>
                        </div>
                    </Card>

                    {/* Vault */}
                    <Card>
                        <h3 className="text-xl font-serif mb-4 flex items-center justify-between">
                            <Lock size={20} className="text-brand-orange" /> Coffre-fort
                            <button 
                                onClick={() => { setEditingCredential(null); setShowCredentialModal(true); }}
                                className="text-xs text-brand-orange hover:underline flex items-center gap-1"
                            >
                                <Plus size={12} /> Ajouter Identifiant
                            </button>
                        </h3>
                        {project.credentials && project.credentials.length > 0 ? (
                            <div className="space-y-3">
                                {project.credentials.map((cred) => (
                                    <div key={cred.id} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{cred.service}</div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setEditingCredential(cred); setShowCredentialModal(true); }} className="text-slate-400 hover:text-brand-orange"><Edit2 size={14} /></button>
                                                <button onClick={() => handleDeleteCredential(cred.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                                                <button onClick={() => setShowPasswords(prev => ({ ...prev, [cred.id]: !prev[cred.id] }))} className="text-slate-400 hover:text-brand-orange">
                                                    {showPasswords[cred.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                            <span className="font-bold">Utilisateur:</span> <span className="select-all flex-1 truncate">{cred.username}</span>
                                            <Tooltip content="Copier">
                                                <button type="button" onClick={() => { navigator.clipboard.writeText(cred.username); onNotify('Copié', 'Identifiant copié dans le presse-papiers.', 'success'); }} className="shrink-0 p-1 rounded text-slate-400 hover:text-brand-orange hover:bg-orange-50 dark:hover:bg-slate-700">
                                                    <Copy size={12} />
                                                </button>
                                            </Tooltip>
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                            <span className="font-bold">Mot de passe:</span> <span className="select-all flex-1 truncate">{showPasswords[cred.id] ? cred.password : '********'}</span>
                                            <Tooltip content="Copier">
                                                <button type="button" onClick={() => { navigator.clipboard.writeText(cred.password); onNotify('Copié', 'Mot de passe copié dans le presse-papiers.', 'success'); }} className="shrink-0 p-1 rounded text-slate-400 hover:text-brand-orange hover:bg-orange-50 dark:hover:bg-slate-700">
                                                    <Copy size={12} />
                                                </button>
                                            </Tooltip>
                                        </div>
                                        {cred.url && (
                                            <div className="text-xs text-slate-500 mt-1">
                                                <span className="font-bold">URL:</span> <a href={cred.url} target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline">{cred.url}</a>
                                            </div>
                                        )}
                                        {cred.notes && (
                                            <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                                                <span className="font-bold">Notes:</span> <span className="whitespace-pre-wrap">{cred.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 italic">Aucun mot de passe enregistré. Cliquez sur "Ajouter Identifiant" pour commencer.</p>
                        )}
                    </Card>
                </div>

                {/* Right Col: Tasks & Files */}
                <div className="lg:col-span-2 space-y-4 md:space-y-6">
                    <Card className="min-h-[300px] md:min-h-[600px] flex flex-col">
                        <div className="flex items-center gap-3 md:gap-6 mb-4 md:mb-6 border-b border-slate-100 dark:border-slate-700 pb-3 md:pb-4 overflow-x-auto no-scrollbar -mx-2 px-2">
                            {(() => {
                                // Case Study tab only appears when project is finished or archived
                                // (no point generating a case study mid-project)
                                const projectFinished =
                                    project.status === ProjectStatus.ARCHIVED
                                    || project.status === ProjectStatus.MAINTENANCE
                                    || (project.tasks?.length > 0 && project.tasks.every(t => t.completed));

                                const tabs = [
                                    { id: 'tasks', label: 'Tâches' },
                                    { id: 'time', label: 'Temps' },
                                    { id: 'finance', label: 'Finances' },
                                    { id: 'files', label: 'Fichiers' },
                                    { id: 'emails', label: 'E-mails' },
                                    { id: 'portal', label: 'Portail' },
                                    { id: 'competitors', label: '🔍 Concurrents' },
                                    { id: 'progress', label: '📊 Rapport IA' },
                                    ...(projectFinished ? [{ id: 'casestudy', label: '📄 Case Study' }] : []),
                                ];
                                return tabs;
                            })().map(tab => (
                                <button 
                                    key={tab.id}
                                    onClick={() => { setActiveTab(tab.id as any); if (tab.id !== 'emails') setMeetingFollowUpDraft(null); }}
                                    className={`text-sm md:text-lg font-serif transition-colors relative whitespace-nowrap px-2 py-1 ${activeTab === tab.id ? 'text-brand-orange' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                >
                                    {tab.label}
                                    {activeTab === tab.id && <div className="absolute -bottom-[13px] md:-bottom-[17px] left-0 w-full h-0.5 bg-brand-orange"></div>}
                                </button>
                            ))}
                            <button 
                                onClick={() => setShowMeetingMode(true)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-colors whitespace-nowrap"
                            >
                                <Mic size={16} /> Meeting Copilot
                            </button>
                        </div>

                        {activeTab === 'tasks' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 h-full flex flex-col">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        Phase: 
                                        <span className={`px-2 py-0.5 rounded-full text-xs text-white ${getPhaseBg(project.phase).replace('bg-', 'bg-').replace('100', '500')}`}>
                                            {project.phase}
                                        </span>
                                    </h4>
                                    <button 
                                        onClick={() => handleOpenTaskModal()}
                                        className="flex items-center gap-1 text-sm bg-orange-50 dark:bg-orange-900/30 text-brand-orange px-3 py-1 rounded-full hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
                                    >
                                        <Plus size={14} /> Ajouter Tâche
                                    </button>
                                </div>

                                {/* KANBAN BOARD */}
                                {project.tasks.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <EmptyState
                                            title="Aucune tâche pour l'instant"
                                            message="Créez votre première tâche pour organiser ce projet."
                                            icon={CheckCircle}
                                            actionLabel="Ajouter une tâche"
                                            onAction={() => handleOpenTaskModal()}
                                        />
                                    </div>
                                ) : (
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={kanbanCollisionDetection}
                                        onDragStart={handleDndDragStart}
                                        onDragEnd={handleDndDragEnd}
                                        measuring={{
                                            droppable: { strategy: MeasuringStrategy.Always },
                                        }}
                                    >
                                        <div className="flex-1 flex flex-col md:flex-row gap-3 md:gap-4 overflow-x-auto pb-2">
                                            {renderKanbanColumn('todo', 'À Faire', todoTasks, todoIds)}
                                            {renderKanbanColumn('doing', 'En Cours', doingTasks, doingIds)}
                                            {renderKanbanColumn('done', 'Terminé', doneTasks, doneIds)}
                                        </div>
                                        <DragOverlay dropAnimation={null} modifiers={[snapOverlayToCursor]}>
                                            {draggedTaskId ? (() => {
                                                const t = project.tasks.find(t => t.id === draggedTaskId);
                                                if (!t) return null;
                                                const ep = getEffectivePriority(t);
                                                return (
                                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-2xl border-2 border-brand-orange/40 rotate-[2deg] w-[220px] pointer-events-none">
                                                        <div className="flex items-center gap-1.5 mb-2">
                                                            <Badge color={ep === 'High' ? 'red' : ep === 'Medium' ? 'yellow' : 'blue'}>{ep}</Badge>
                                                        </div>
                                                        <div className="text-sm font-bold text-slate-800 dark:text-white leading-snug">{t.title}</div>
                                                        {t.description && <div className="text-xs text-slate-500 line-clamp-1 mt-1">{t.description}</div>}
                                                    </div>
                                                );
                                            })() : null}
                                        </DragOverlay>
                                    </DndContext>
                                )}

                                {/* NEXT PHASE BUTTON */}
                                {(() => {
                                    const currentIndex = WORKFLOW_STEPS.indexOf(project.phase);
                                    const nextPhase = WORKFLOW_STEPS[currentIndex + 1];
                                    
                                    if (nextPhase && project.tasks.length > 0) {
                                        return (
                                            <div className="flex justify-center pt-4">
                                                <button 
                                                    onClick={() => updatePhaseWithTemplates(nextPhase)}
                                                    className="group relative px-6 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-2 border-slate-100 dark:border-slate-700 rounded-full font-bold text-xs uppercase tracking-wider hover:border-brand-orange hover:text-brand-orange transition-all shadow-sm hover:shadow-md flex items-center gap-3 overflow-hidden"
                                                >
                                                    <span className="relative z-10">Passer à : {WORKFLOW_CONFIG[nextPhase]?.label || nextPhase}</span>
                                                    <ArrowRight size={16} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                                                    <div className="absolute inset-0 bg-orange-50 dark:bg-orange-900/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                                </button>
                                            </div>
                                        )
                                    }
                                    return null;
                                })()}
                            </div>
                        )}

                        {activeTab === 'time' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                {/* Top Stats */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-5 rounded-2xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 group">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Clock size={18} className="text-orange-600 group-hover:rotate-12 transition-transform" />
                                                <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Non Facturé</span>
                                            </div>
                                            <Badge color="yellow">{timeLogs.filter(l => l.status === 'pending').length} sessions</Badge>
                                        </div>
                                        <div className="text-3xl tabular-nums font-bold text-orange-700 dark:text-orange-300">
                                            {formatDuration(timeLogs.filter(l => l.status === 'pending').reduce((acc, l) => acc + l.duration, 0))}
                                        </div>
                                        <div className="mt-2 text-xs font-medium text-orange-600/60 dark:text-orange-400/60">
                                            ~ {formatCurrency(timeLogs.filter(l => l.status === 'pending').reduce((acc, l) => acc + l.duration, 0) / 3600 * 120, 0)} CHF (est.)
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                        <div className="flex items-center gap-2 mb-2">
                                            <History size={18} className="text-slate-500" />
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Projet</span>
                                        </div>
                                        <div className="text-3xl tabular-nums font-bold text-slate-700 dark:text-slate-300">
                                            {formatDuration(timeLogs.reduce((acc, l) => acc + l.duration, 0))}
                                        </div>
                                        <div className="mt-2 text-xs font-medium text-slate-400">
                                            Depuis le {new Date(project.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                {/* Main List */}
                                <div>
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <BarChart size={16} /> Historique Détaillé
                                    </h4>
                                    
                                    {timeLogs.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 italic bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                            <Timer size={32} className="mx-auto mb-3 opacity-50" />
                                            Aucune activité enregistrée. Lancez le chronomètre pour commencer !
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 uppercase">
                                                    <tr>
                                                        <th className="p-4 w-32">Date</th>
                                                        <th className="p-4">Activité</th>
                                                        <th className="p-4 text-right w-32">Durée</th>
                                                        <th className="p-4 text-center w-32">Statut</th>
                                                        <th className="p-4 w-20"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                    {timeLogs.map(log => (
                                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm group">
                                                            <td className="p-4 text-slate-500 tabular-nums text-xs">{new Date(log.date).toLocaleDateString()}</td>
                                                            <td className="p-4">
                                                                {editingLogId === log.id ? (
                                                                    <div className="flex gap-2">
                                                                        <input 
                                                                            autoFocus
                                                                            value={editingLogDesc}
                                                                            onChange={(e) => setEditingLogDesc(e.target.value)}
                                                                            className="flex-1 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-sm outline-none border border-brand-orange"
                                                                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateLog(log.id)}
                                                                        />
                                                                        <button onClick={() => handleUpdateLog(log.id)} className="p-1 bg-brand-orange text-white rounded"><CheckCircle size={14}/></button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="font-medium text-slate-800 dark:text-white flex items-center gap-2">
                                                                        {log.description}
                                                                        <button onClick={() => { setEditingLogId(log.id); setEditingLogDesc(log.description); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-brand-orange transition-opacity"><Edit2 size={12} /></button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-bold">{formatDuration(log.duration)}</td>
                                                            <td className="p-4 text-center">
                                                                <Badge color={log.status === 'billed' ? 'green' : 'yellow'}>
                                                                    {log.status === 'billed' ? 'Facturé' : 'À faire'}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button 
                                                                        onClick={() => handleResumeTimer(log)}
                                                                        className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 transition-colors"
                                                                        title="Reprendre cette tâche"
                                                                    >
                                                                        <Play size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'finance' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30">
                                        <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Encaissé</div>
                                        <div className="text-2xl font-serif font-bold text-emerald-700 dark:text-emerald-300">
                                            {formatCurrency(project.invoices.filter(i => i.status === 'Paid' && i.type === 'Invoice').reduce((sum, i) => sum + i.amount, 0), 2)} CHF
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30">
                                        <div className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">En Attente</div>
                                        <div className="text-2xl font-serif font-bold text-orange-700 dark:text-orange-300">
                                            {formatCurrency(project.invoices.filter(i => i.status !== 'Paid' && i.type === 'Invoice').reduce((sum, i) => sum + i.amount, 0), 2)} CHF
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Factures</h4>
                                        <button onClick={() => handleOpenInvoiceModal()} className="px-4 py-2 bg-brand-orange text-white rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                                            <Plus size={16} /> Facture +
                                        </button>
                                    </div>
                                    {project.invoices.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400 italic">Aucun document financier.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {project.invoices.map(inv => (
                                                <div key={inv.id} onClick={() => handleOpenInvoiceModal(inv)} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors border border-slate-100 dark:border-slate-700">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${inv.type === 'Invoice' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                                            {inv.type === 'Invoice' ? <DollarSign size={16} /> : <FileText size={16} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{inv.number}</div>
                                                            <div className="text-xs text-slate-400">{inv.date}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="tabular-nums font-bold text-slate-700 dark:text-slate-200">{formatCurrency(inv.amount, 2)} CHF</div>
                                                        <Badge color={inv.status === 'Paid' ? 'green' : inv.status === 'Partial' ? 'blue' : 'yellow'}>{inv.status === 'Partial' ? 'Acompte' : inv.status}</Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* AI Pricing Intelligence — at the bottom of Finance */}
                                <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
                                    <React.Suspense fallback={<LazyFallback />}>
                                        <PricingIntelligence
                                            defaultCountry="France"
                                            defaultIndustry={project.profile?.customFields?.find(f => f.key === 'Secteur')?.value}
                                        />
                                    </React.Suspense>
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'files' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">

                                {/* ========== SECTION 1 : LIENS DU PROJET ========== */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Link2 size={16} className="text-brand-orange" />
                                        <h3 className="font-bold text-sm text-slate-800 dark:text-white">Liens du projet</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        {[
                                            { id: 'figma', label: 'Figma', icon: Figma, color: 'bg-[#F24E1E]', textColor: 'text-white' },
                                            { id: 'github', label: 'GitHub', icon: Github, color: 'bg-black dark:bg-white', textColor: 'text-white dark:text-black' },
                                            { id: 'wordpress', label: 'WordPress', icon: Globe, color: 'bg-[#21759B]', textColor: 'text-white' },
                                            { id: 'infomaniak', label: 'Infomaniak', icon: HardDrive, color: 'bg-[#0098FF]', textColor: 'text-white' },
                                        ].map((link) => {
                                            const hasUrl = !!links[link.id]?.trim();
                                            const isEditing = editingLinkId === link.id;
                                            return (
                                                <div
                                                    key={link.id}
                                                    className={`group p-3 rounded-xl border flex items-center gap-3 transition-all ${
                                                        hasUrl
                                                            ? 'border-slate-200 dark:border-slate-700 hover:border-brand-orange/40 dark:hover:border-brand-orange/40 cursor-pointer'
                                                            : 'border-dashed border-slate-200 dark:border-slate-700'
                                                    }`}
                                                    onClick={() => {
                                                        if (isEditing) return;
                                                        if (hasUrl) window.open(links[link.id].startsWith('http') ? links[link.id] : `https://${links[link.id]}`, '_blank');
                                                    }}
                                                >
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${link.color} ${link.textColor}`}>
                                                        <link.icon size={18} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-xs text-slate-800 dark:text-white">{link.label}</span>
                                                            {hasUrl && !isEditing && (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Lien défini" />
                                                            )}
                                                        </div>
                                                        {isEditing ? (
                                                            <input
                                                                autoFocus
                                                                value={links[link.id] || ''}
                                                                placeholder="https://..."
                                                                onClick={e => e.stopPropagation()}
                                                                onChange={e => setLinks({ ...links, [link.id]: e.target.value })}
                                                                onBlur={() => { setEditingLinkId(null); saveLinks({ ...links }); }}
                                                                onKeyDown={e => { if (e.key === 'Enter') { setEditingLinkId(null); saveLinks({ ...links }); } if (e.key === 'Escape') setEditingLinkId(null); }}
                                                                className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-lg mt-0.5 outline-none focus:ring-1 focus:ring-brand-orange"
                                                            />
                                                        ) : (
                                                            <div className="text-[11px] text-slate-400 truncate">
                                                                {hasUrl ? links[link.id].replace(/^https?:\/\//, '') : 'Non défini'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!isEditing && (
                                                        <button
                                                            onClick={e => { e.stopPropagation(); setEditingLinkId(link.id); }}
                                                            className="p-1.5 rounded-lg text-slate-300 hover:text-brand-orange hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Modifier le lien"
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                    )}
                                                    {hasUrl && !isEditing && (
                                                        <ExternalLink size={13} className="text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* ========== SECTION 2 : FICHIERS DU PROJET ========== */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <FolderOpen size={16} className="text-brand-orange" />
                                        <h3 className="font-bold text-sm text-slate-800 dark:text-white">Fichiers du projet</h3>
                                        {currentPath && (
                                            <div className="flex items-center gap-1 ml-2 text-xs text-slate-400">
                                                <button onClick={() => { setPathHistory([]); setCurrentPath(''); }} className="hover:text-brand-orange transition-colors">root</button>
                                                {currentPath.split('/').map((seg, i, arr) => {
                                                    const partial = arr.slice(0, i + 1).join('/');
                                                    return (
                                                        <React.Fragment key={i}>
                                                            <ChevronRight size={10} className="text-slate-300" />
                                                            <button
                                                                onClick={() => {
                                                                    setPathHistory(prev => prev.slice(0, i + 1));
                                                                    setCurrentPath(partial);
                                                                }}
                                                                className={`hover:text-brand-orange transition-colors ${i === arr.length - 1 ? 'text-slate-700 dark:text-slate-200 font-medium' : ''}`}
                                                            >
                                                                {seg}
                                                            </button>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <React.Suspense fallback={<LazyFallback />}>
                                        <FileExplorer
                                            items={fileItems}
                                            currentPath={currentPath}
                                            onNavigate={handleFileNavigate}
                                            onBack={handleFileBack}
                                            isLoading={isLoadingFiles}
                                            onRename={handleRenameFile}
                                            onDelete={handleDeleteFile}
                                        />
                                    </React.Suspense>
                                </div>

                                {/* ========== SECTION 3 : GOOGLE DRIVE ========== */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Cloud size={16} className="text-blue-500" />
                                        <h3 className="font-bold text-sm text-slate-800 dark:text-white">Google Drive</h3>
                                    </div>
                                    <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 rounded-xl border border-blue-100 dark:border-blue-800/50">
                                        {oauthStatus?.connected ? (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 bg-white dark:bg-slate-800 rounded-lg shadow-sm flex items-center justify-center">
                                                        <CloudUpload size={18} className="text-blue-500" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            {oauthStatus.email}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                                            {lastSyncTime ? `Sync: ${lastSyncTime}` : 'Jamais synchronisé'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleSyncToDrive}
                                                    disabled={isSyncingToDrive}
                                                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                                                >
                                                    {isSyncingToDrive ? (
                                                        <><RefreshCw size={14} className="animate-spin" /> Sync...</>
                                                    ) : (
                                                        <><CloudUpload size={14} /> Synchroniser</>
                                                    )}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 bg-white dark:bg-slate-800 rounded-lg shadow-sm flex items-center justify-center">
                                                        <Cloud size={18} className="text-slate-400" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm text-slate-700 dark:text-slate-300">Non connecté</div>
                                                        <div className="text-[11px] text-slate-400">Connectez Google pour synchroniser les fichiers</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        connectGoogleMutation.mutate(undefined, {
                                                            onSuccess: (data: any) => {
                                                                const popup = window.open(data.auth_url, 'Google Auth', 'width=500,height=600,left=200,top=100');
                                                                const handleMessage = (event: MessageEvent) => {
                                                                    if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
                                                                        queryClient.invalidateQueries({ queryKey: queryKeys.oauthStatus });
                                                                        queryClient.invalidateQueries({ queryKey: queryKeys.calendarSync });
                                                                        onNotify('Google connecté', `Connecté à ${event.data.email}`, 'success');
                                                                        window.removeEventListener('message', handleMessage);
                                                                    }
                                                                    if (event.data.type === 'GOOGLE_AUTH_ERROR') {
                                                                        window.removeEventListener('message', handleMessage);
                                                                    }
                                                                };
                                                                window.addEventListener('message', handleMessage);
                                                                const checkClosed = setInterval(() => {
                                                                    if (popup?.closed) { clearInterval(checkClosed); window.removeEventListener('message', handleMessage); }
                                                                }, 1000);
                                                            },
                                                        });
                                                    }}
                                                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
                                                >
                                                    <Cloud size={14} /> Connecter
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>
                        )}

                        {activeTab === 'emails' && (
                            <div className="h-full min-h-[500px] animate-in fade-in slide-in-from-bottom-2">
                                <React.Suspense fallback={<LazyFallback />}>
                                    <EmailClient
                                        clientEmail={project.profile.email}
                                        initialCompose={meetingFollowUpDraft ?? undefined}
                                        key={meetingFollowUpDraft ? `compose-${meetingFollowUpDraft.subject}` : 'email'}
                                    />
                                </React.Suspense>
                            </div>
                        )}

                        {activeTab === 'portal' && (
                            <div className="h-full min-h-[500px] animate-in fade-in slide-in-from-bottom-2">
                                <React.Suspense fallback={<LazyFallback />}>
                                    <ClientPortal 
                                        project={project}
                                        onUpdateProject={onUpdateProject}
                                        onNotify={onNotify}
                                    />
                                </React.Suspense>
                            </div>
                        )}

                        {activeTab === 'competitors' && (
                            <div className="min-h-[400px] animate-in fade-in slide-in-from-bottom-2">
                                <React.Suspense fallback={<LazyFallback />}>
                                    <CompetitorAnalysis
                                        projectId={project.id}
                                        clientName={project.clientName}
                                        clientDescription={project.profile?.customFields?.find(f => f.key === 'Secteur')?.value}
                                    />
                                </React.Suspense>
                            </div>
                        )}

                        {activeTab === 'progress' && (
                            <div className="min-h-[400px] animate-in fade-in slide-in-from-bottom-2">
                                <React.Suspense fallback={<LazyFallback />}>
                                    <ProjectProgressReport project={project} />
                                </React.Suspense>
                            </div>
                        )}

                        {activeTab === 'casestudy' && (
                            <div className="min-h-[400px] animate-in fade-in slide-in-from-bottom-2">
                                <React.Suspense fallback={<LazyFallback />}>
                                    <CaseStudyGenerator project={project} />
                                </React.Suspense>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Task Creation Modal */}
            <Modal isOpen={showTaskModal} onClose={() => setShowTaskModal(false)} title={editingTask ? "Modifier la Tâche" : "Nouvelle Tâche"} width="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Titre de la tâche</label>
                        <input autoFocus value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveTask()} className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white" />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Description</label>
                        <textarea 
                            value={newTaskDescription} 
                            onChange={(e) => setNewTaskDescription(e.target.value)} 
                            className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange h-24 resize-none dark:text-white"
                            placeholder="Détails supplémentaires..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Statut</label>
                            <div className="flex gap-2">
                                {['todo', 'doing', 'done'].map((status) => (
                                    <button 
                                        key={status}
                                        onClick={() => setNewTaskStatus(status as any)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all border-2 ${newTaskStatus === status ? 'border-brand-orange bg-orange-50 text-brand-orange' : 'border-transparent bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        {status === 'todo' ? 'À Faire' : status === 'doing' ? 'En Cours' : 'Fait'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Priorité</label>
                            <select 
                                value={newTaskPriority}
                                onChange={(e) => setNewTaskPriority(e.target.value as any)}
                                className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 outline-none dark:text-white h-[42px]"
                            >
                                <option value="Low">Basse</option>
                                <option value="Medium">Moyenne</option>
                                <option value="High">Haute</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Échéance</label>
                        <input 
                            type="date"
                            value={newTaskDueDate} 
                            onChange={(e) => setNewTaskDueDate(e.target.value)} 
                            className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                        />
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button onClick={handleSaveTask} disabled={!newTaskTitle.trim()} className="bg-brand-orange text-white px-6 py-2.5 rounded-full font-bold shadow-lg hover:bg-orange-600 transition-colors disabled:opacity-50">
                            {editingTask ? 'Mettre à jour' : 'Créer'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Smart Invoice Builder Modal */}
            <Modal isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="" width="max-w-6xl">
                {selectedInvoice && <React.Suspense fallback={<LazyFallback />}><InvoiceBuilder invoice={selectedInvoice} project={project} onClose={() => setShowInvoiceModal(false)} onSave={handleSaveInvoice} currentTheme={currentTheme} allProjects={[]} /></React.Suspense>}
            </Modal>

            {/* Brand Center Modal */}
            <React.Suspense fallback={<LazyFallback />}>
                <BrandCenter isOpen={showBrandCenter} onClose={() => setShowBrandCenter(false)} project={project} onUpdate={onUpdateProject} />
            </React.Suspense>

            {/* Danger Zone */}
            <div className="mt-20 pt-10 border-t border-red-100 dark:border-red-900/30 opacity-60 hover:opacity-100 transition-opacity">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-4">Zone de Danger</h4>
                <button onClick={handleDeleteClient} className="flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors text-sm font-bold"><Trash2 size={16} /> Supprimer ce client</button>
            </div>

            {/* Meeting Mode Modal */}
            <Modal isOpen={showMeetingMode} onClose={() => setShowMeetingMode(false)} title="" width="max-w-6xl" showCloseButton={false}>
                <React.Suspense fallback={<LazyFallback />}>
                    <MeetingMode 
                        clientName={project.clientName} 
                        clientProfile={project.profile}
                        clientAvatarImage={project.avatarImage}
                        meetingHistory={mergedMeetingReports}
                        openTasks={project.tasks.filter((t) => !t.completed)}
                        onClose={() => setShowMeetingMode(false)}
                        onSaveNotes={handleSaveMeetingNotes}
                        onOpenEmail={handleOpenMeetingEmail}
                    />
                </React.Suspense>
            </Modal>

            {/* Credential Modal */}
            <Modal isOpen={showCredentialModal} onClose={() => setShowCredentialModal(false)} title={editingCredential ? "Modifier l'Identifiant" : "Ajouter un Identifiant"} width="max-w-md">
                <CredentialModalContent 
                    credential={editingCredential}
                    onSave={editingCredential ? handleEditCredential : handleAddCredential}
                    onClose={() => setShowCredentialModal(false)}
                />
            </Modal>

            {/* Archive Modal */}
            <Modal isOpen={showArchiveModal} onClose={() => setShowArchiveModal(false)} title="Archiver le projet" width="max-w-md">
                <div className="p-6">
                    <p className="text-sm text-slate-500 mb-4">Sélectionnez la catégorie d'archive pour <strong>{project.clientName}</strong> :</p>
                    <div className="grid grid-cols-2 gap-3">
                        {ARCHIVE_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => confirmArchive(cat)}
                                className="p-3 rounded-xl border border-slate-200 hover:border-brand-orange hover:bg-orange-50 dark:border-slate-700 dark:hover:bg-slate-800 transition-all text-xs font-bold text-slate-600 dark:text-slate-300 text-left"
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* Logo Lab Modal */}
            <Modal isOpen={showLogoLab} onClose={() => setShowLogoLab(false)} title="Laboratoire de Logo (IA)" width="max-w-4xl">
                <React.Suspense fallback={<LazyFallback />}>
                    <LogoLab 
                        clientName={project.clientName} 
                        initialData={project.logoLabData}
                        onClose={() => setShowLogoLab(false)}
                        onSave={(svgDataUrl, logoData) => onUpdateProject({ ...project, avatarImage: svgDataUrl, logoLabData: logoData })}
                    />
                </React.Suspense>
            </Modal>

            {/* Time Entry Modal */}
            <Modal isOpen={showTimeEntryModal} onClose={() => setShowTimeEntryModal(false)} title="Enregistrer l'activité" width="max-w-sm">
                <div className="space-y-4">
                    <div className="flex justify-center mb-4">
                        <div className="text-4xl tabular-nums font-bold text-brand-orange">
                            {formatDuration(timerSession)}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Qu'avez-vous fait ?</label>
                        <input 
                            autoFocus
                            value={timeEntryDesc}
                            onChange={(e) => setTimeEntryDesc(e.target.value)}
                            placeholder="Ex: Retouche page contact..."
                            className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveTimeEntry()}
                        />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button onClick={handleSaveTimeEntry} className="bg-brand-orange text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-orange-600 transition-colors">
                            Enregistrer
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export const ClientView = React.memo(ClientViewInner);

interface CredentialModalContentProps {
    credential: Credential | null;
    onSave: (cred: Credential) => void;
    onClose: () => void;
}

const CredentialModalContent: React.FC<CredentialModalContentProps> = ({ credential, onSave, onClose }) => {
    const [service, setService] = useState(credential?.service || '');
    const [username, setUsername] = useState(credential?.username || '');
    const [password, setPassword] = useState(credential?.password || '');
    const [url, setUrl] = useState(credential?.url || '');
    const [notes, setNotes] = useState(credential?.notes || '');
    const [showPasswordField, setShowPasswordField] = useState(false);

    const handleSave = () => {
        if (!service || !username || !password) {
            alert("Service, Nom d'utilisateur et Mot de passe sont requis.");
            return;
        }
        onSave({
            id: credential?.id || `cred-${Date.now()}`,
            service,
            username,
            password,
            url: url || undefined,
            notes: notes.trim() || undefined
        });
    };

    return (
        <div className="space-y-4 p-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Service</label>
                <input 
                    value={service} onChange={e => setService(e.target.value)}
                    placeholder="Ex: WordPress Admin, FTP, Base de données..."
                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom d'utilisateur</label>
                <input 
                    value={username} onChange={e => setUsername(e.target.value)}
                    placeholder="Nom d'utilisateur ou Email"
                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mot de passe</label>
                <div className="relative">
                    <input 
                        type={showPasswordField ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Mot de passe"
                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPasswordField(prev => !prev)}
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-brand-orange"
                        tabIndex={-1}
                    >
                        {showPasswordField ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL (Optionnel)</label>
                <input 
                    value={url} onChange={e => setUrl(e.target.value)}
                    placeholder="URL de connexion (ex: https://admin.site.com)"
                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes privées (Optionnel)</label>
                <textarea 
                    value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Infos complémentaires, codes 2FA, etc."
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange dark:text-white resize-none"
                />
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Annuler</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm bg-brand-orange text-white rounded-xl hover:bg-orange-600">Enregistrer</button>
            </div>
        </div>
    );
};