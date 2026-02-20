/**
 * React Query hooks for data fetching
 * Centralized query definitions for all API endpoints
 * 
 * This module provides:
 * - Query hooks (useQuery) for all read operations
 * - Mutation hooks (useMutation) for all write operations
 * - Centralized query key management
 * - Optimistic updates for a smooth UX
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiGet, apiPost, apiDelete } from './api';
import { Project, CalendarEvent, Expense, WorkflowPhase } from '../types';

// ============================================================================
// QUERY KEYS - Centralized key management
// ============================================================================

export const queryKeys = {
    projects: ['projects'] as const,
    project: (id: string) => ['projects', id] as const,
    events: ['events'] as const,
    calendarSync: ['calendar', 'sync'] as const,
    expenses: ['expenses'] as const,
    notes: ['notes'] as const,
    version: ['version'] as const,
    franckGreeting: ['franck', 'greeting'] as const,
    franckData: ['franck', 'data'] as const,
    oauthStatus: ['oauth', 'status'] as const,
    checkStatus: ['check-status'] as const,
    checkUpdates: ['updates', 'check'] as const,
    workspace: ['workspace'] as const,
    workspaces: ['workspaces'] as const,
    workspaceMembers: ['workspace', 'members'] as const,
    workspaceBranding: ['workspace', 'branding'] as const,
    analytics: ['analytics'] as const,
    backupStatus: ['backup', 'status'] as const,
    cloudBackupConfig: ['backup', 'cloud', 'config'] as const,
};

// ============================================================================
// EMAIL QUERY KEYS & HOOKS (Phase 4.1)
// ============================================================================

export const emailKeys = {
    status: ['email', 'status'] as const,
    unseen: ['email', 'unseen'] as const,
    list: (folder: string) => ['email', 'list', folder] as const,
    body: (id: string) => ['email', 'body', id] as const,
};

export interface EmailAttachment {
    partIndex: number;
    filename: string;
    contentType: string;
    size: number;
}

export interface EmailMessage {
    id: string;
    subject: string;
    from: string;
    to?: string;
    cc?: string;
    bcc?: string;
    date: string;
    snippet: string;
    body?: string;
    isUnread?: boolean;
    isStarred?: boolean;
    hasAttachments?: boolean;
    attachments?: EmailAttachment[];
}

/**
 * Check email connection status.
 */
export function useEmailStatus() {
    return useQuery({
        queryKey: emailKeys.status,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/email/status');
            if (!res.ok) return { connected: false, username: null };
            return res.json();
        },
        staleTime: 30 * 1000,
    });
}

/**
 * Quick unseen count check for email notifications.
 * Polls every 60s. Only runs when connected.
 */
export interface UnseenData {
    count: number;
    connected: boolean;
    newest?: { subject: string; from: string } | null;
    error?: string;
}

export function useEmailUnseen(enabled: boolean) {
    return useQuery<UnseenData>({
        queryKey: emailKeys.unseen,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/email/unseen');
            if (!res.ok) return { count: 0, connected: false };
            return res.json();
        },
        enabled,
        refetchInterval: 60_000,  // poll every 60s
        staleTime: 30_000,
    });
}

/**
 * Fetch email list for a folder. Only runs when connected and enabled.
 */
export function useEmails(folder: string, enabled: boolean) {
    return useQuery({
        queryKey: emailKeys.list(folder),
        queryFn: async () => {
            const res = await apiFetch('/api/v1/email/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder, limit: 30, offset: 0 }),
            });
            if (!res.ok) throw new Error('Failed to fetch emails');
            const data = await res.json();
            const emails = (data.emails || []) as EmailMessage[];
            // Sort by date descending so newest emails always appear first
            emails.sort((a, b) => {
                const da = new Date(a.date).getTime();
                const db = new Date(b.date).getTime();
                // Handle invalid dates: push them to the bottom
                if (isNaN(da) && isNaN(db)) return 0;
                if (isNaN(da)) return 1;
                if (isNaN(db)) return -1;
                return db - da;
            });
            return emails;
        },
        enabled,
        staleTime: 30 * 1000,
        refetchInterval: 60 * 1000,
    });
}

/**
 * Connect to email (login).
 */
export function useEmailConnect() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ username, password }: { username: string; password: string }) => {
            const res = await apiFetch('/api/v1/email/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Identifiants invalides');
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: emailKeys.status });
        },
    });
}

/**
 * Disconnect from email.
 */
export function useEmailDisconnect() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            await apiFetch('/api/v1/email/disconnect', { method: 'POST' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: emailKeys.status });
            queryClient.removeQueries({ queryKey: ['email', 'list'] });
        },
    });
}

/**
 * Send an email.
 */
export function useSendEmail() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ to, subject, body, signatureHtml, attachments }: {
            to: string; subject: string; body: string; signatureHtml?: string; attachments?: File[];
        }) => {
            if (attachments && attachments.length > 0) {
                const formData = new FormData();
                formData.append('to', to);
                formData.append('subject', subject);
                formData.append('body', body);
                if (signatureHtml) formData.append('signature_html', signatureHtml);
                attachments.forEach((f, i) => formData.append(`file_${i}`, f));
                const res = await apiFetch('/api/v1/email/send', {
                    method: 'POST',
                    body: formData,
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error || "Erreur d'envoi");
                return data;
            } else {
                const res = await apiFetch('/api/v1/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to, subject, body, signature_html: signatureHtml }),
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error || "Erreur d'envoi");
                return data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: emailKeys.list('sent') });
        },
    });
}

/**
 * Delete an email.
 */
export function useDeleteEmail() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, folder }: { id: string; folder: string }) => {
            const res = await apiFetch('/api/v1/email/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, folder }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Erreur suppression');
            return data;
        },
        onMutate: async ({ id, folder }) => {
            await queryClient.cancelQueries({ queryKey: emailKeys.list(folder) });
            const prev = queryClient.getQueryData<EmailMessage[]>(emailKeys.list(folder));
            if (prev) {
                queryClient.setQueryData(
                    emailKeys.list(folder),
                    prev.filter(e => e.id !== id)
                );
            }
            return { prev, folder };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) {
                queryClient.setQueryData(emailKeys.list(ctx.folder), ctx.prev);
            }
        },
        onSettled: (_data, _err, vars) => {
            queryClient.invalidateQueries({ queryKey: emailKeys.list(vars.folder) });
        },
    });
}

/**
 * Mark an email as read.
 */
export function useMarkRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, folder }: { id: string; folder: string }) => {
            const res = await apiFetch('/api/v1/email/mark_read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, folder }),
            });
            return res.json();
        },
        onMutate: async ({ id, folder }) => {
            await queryClient.cancelQueries({ queryKey: emailKeys.list(folder) });
            const prev = queryClient.getQueryData<EmailMessage[]>(emailKeys.list(folder));
            if (prev) {
                queryClient.setQueryData(
                    emailKeys.list(folder),
                    prev.map(e => e.id === id ? { ...e, isUnread: false } : e)
                );
            }
            return { prev, folder };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) {
                queryClient.setQueryData(emailKeys.list(ctx.folder), ctx.prev);
            }
        },
    });
}

/**
 * Save a draft.
 */
export function useSaveDraft() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
            const res = await apiFetch('/api/v1/email/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, subject, body }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Erreur sauvegarde');
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: emailKeys.list('drafts') });
        },
    });
}

/**
 * Generate an AI reply to an email (Phase 5.1).
 */
export function useEmailAIReply() {
    return useMutation({
        mutationFn: async (params: {
            originalBody: string;
            originalFrom: string;
            originalSubject: string;
            clientName?: string;
            userName?: string;
            tone?: string;
        }) => {
            const res = await apiFetch('/api/v1/email/ai/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Erreur IA');
            return data.reply as string;
        },
    });
}

/**
 * Summarize an email with AI (Phase 5.2).
 */
export function useEmailAISummarize() {
    return useMutation({
        mutationFn: async (params: { body: string; subject: string }) => {
            const res = await apiFetch('/api/v1/email/ai/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Erreur IA');
            return data.summary as string;
        },
    });
}

/**
 * Mark an email as unread.
 */
export function useMarkUnread() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, folder }: { id: string; folder: string }) => {
            const res = await apiFetch('/api/v1/email/mark_unread', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, folder }),
            });
            return res.json();
        },
        onMutate: async ({ id, folder }) => {
            await queryClient.cancelQueries({ queryKey: emailKeys.list(folder) });
            const prev = queryClient.getQueryData<EmailMessage[]>(emailKeys.list(folder));
            if (prev) {
                queryClient.setQueryData(
                    emailKeys.list(folder),
                    prev.map(e => e.id === id ? { ...e, isUnread: true } : e)
                );
            }
            return { prev, folder };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) {
                queryClient.setQueryData(emailKeys.list(ctx.folder), ctx.prev);
            }
        },
    });
}

/**
 * Star an email.
 */
export function useStarEmail() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, folder }: { id: string; folder: string }) => {
            const res = await apiFetch('/api/v1/email/star', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, folder }),
            });
            return res.json();
        },
        onMutate: async ({ id, folder }) => {
            await queryClient.cancelQueries({ queryKey: emailKeys.list(folder) });
            const prev = queryClient.getQueryData<EmailMessage[]>(emailKeys.list(folder));
            if (prev) {
                queryClient.setQueryData(
                    emailKeys.list(folder),
                    prev.map(e => e.id === id ? { ...e, isStarred: true } : e)
                );
            }
            return { prev, folder };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) {
                queryClient.setQueryData(emailKeys.list(ctx.folder), ctx.prev);
            }
        },
    });
}

/**
 * Unstar an email.
 */
export function useUnstarEmail() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, folder }: { id: string; folder: string }) => {
            const res = await apiFetch('/api/v1/email/unstar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, folder }),
            });
            return res.json();
        },
        onMutate: async ({ id, folder }) => {
            await queryClient.cancelQueries({ queryKey: emailKeys.list(folder) });
            const prev = queryClient.getQueryData<EmailMessage[]>(emailKeys.list(folder));
            if (prev) {
                queryClient.setQueryData(
                    emailKeys.list(folder),
                    prev.map(e => e.id === id ? { ...e, isStarred: false } : e)
                );
            }
            return { prev, folder };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) {
                queryClient.setQueryData(emailKeys.list(ctx.folder), ctx.prev);
            }
        },
    });
}

/**
 * Move an email to another folder.
 */
export function useMoveEmail() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, fromFolder, toFolder }: { id: string; fromFolder: string; toFolder: string }) => {
            const res = await apiFetch('/api/v1/email/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, fromFolder, toFolder }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Erreur deplacement');
            return data;
        },
        onMutate: async ({ id, fromFolder }) => {
            await queryClient.cancelQueries({ queryKey: emailKeys.list(fromFolder) });
            const prev = queryClient.getQueryData<EmailMessage[]>(emailKeys.list(fromFolder));
            if (prev) {
                queryClient.setQueryData(
                    emailKeys.list(fromFolder),
                    prev.filter(e => e.id !== id)
                );
            }
            return { prev, fromFolder };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) {
                queryClient.setQueryData(emailKeys.list(ctx.fromFolder), ctx.prev);
            }
        },
        onSettled: (_data, _err, vars) => {
            queryClient.invalidateQueries({ queryKey: emailKeys.list(vars.fromFolder) });
            queryClient.invalidateQueries({ queryKey: emailKeys.list(vars.toFolder) });
        },
    });
}

/**
 * Search emails in a folder.
 */
export function useSearchEmails(query: string, folder: string, enabled: boolean) {
    return useQuery({
        queryKey: ['email', 'search', folder, query],
        queryFn: async () => {
            const res = await apiFetch('/api/v1/email/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, folder, limit: 30, offset: 0 }),
            });
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();
            return (data.emails || []) as EmailMessage[];
        },
        enabled: enabled && query.length > 0,
        staleTime: 15 * 1000,
    });
}

/**
 * List IMAP folders with unseen counts.
 */
export function useEmailFolders(enabled: boolean) {
    return useQuery({
        queryKey: ['email', 'folders'],
        queryFn: async () => {
            const res = await apiFetch('/api/v1/email/folders');
            if (!res.ok) return [];
            const data = await res.json();
            return (data.folders || []) as { name: string; unseen: number }[];
        },
        enabled,
        staleTime: 60 * 1000,
        refetchInterval: 2 * 60 * 1000,
    });
}

// ============================================================================
// HELPER - Transform raw API folder data into a Project
// ============================================================================

function mapFolderToProject(folder: any): Project {
    return {
        id: folder.id,
        clientName: folder.name,
        avatarInitials: folder.name.substring(0, 2).toUpperCase(),
        status: folder.status,
        phase: folder.phase || WorkflowPhase.DISCOVERY,
        progress: folder.progress || 10,
        createdAt: folder.createdAt || new Date().toISOString(),
        profile: folder.profile || { email: '', phone: '', website: '', customFields: [] },
        tasks: folder.tasks || [],
        invoices: folder.invoices || [],
        brandKit: folder.brandKit || { colors: [], fonts: [] },
        credentials: folder.credentials || [],
        moodboard: folder.moodboard || [],
        unreadEmailCount: 0,
        archiveCategory: folder.archiveCategory,
        maintenance: folder.maintenance,
        avatarColor: folder.avatarColor,
        avatarImage: folder.avatarImage,
        logoLabData: folder.logoLabData,
        portalSettings: folder.portalSettings,
        portalComments: folder.portalComments,
    } as Project;
}

// ============================================================================
// PROJECTS
// ============================================================================

/**
 * Fetches all projects from the backend.
 * Includes data transformation from raw API folders to Project objects.
 * Also enriches projects with unread email counts when IMAP credentials are available.
 */
export function useProjects() {
    return useQuery({
        queryKey: queryKeys.projects,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/projects/scan');
            if (!res.ok) throw new Error('Failed to load projects');
            const data = await res.json();
            const folders = data.projects || [];
            
            // Map raw folders to Project objects
            const projects: Project[] = folders.map(mapFolderToProject);

            // Enrich with email counts via batch endpoint (credentials stored server-side)
            const clientEmails = projects
                .filter(p => p.profile?.email)
                .map(p => p.profile!.email!);

            if (clientEmails.length > 0) {
                try {
                    const r = await apiFetch('/api/v1/email/count_batch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clientEmails }),
                    });
                    const d = await r.json();
                    if (d.success && d.counts) {
                        for (const project of projects) {
                            if (project.profile?.email && d.counts[project.profile.email] !== undefined) {
                                project.unreadEmailCount = d.counts[project.profile.email];
                            }
                        }
                    }
                } catch { /* ignore email count errors */ }
            }

            return projects;
        },
    });
}

/**
 * Save (create or update) a project.
 * Performs an optimistic update on the local cache.
 * Accepts { project, oldId? } — oldId is needed when the project id changes (e.g. move/rename).
 */
export function useSaveProject() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async ({ project }: { project: Project; oldId?: string }) => {
            const res = await apiFetch('/api/v1/projects/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project),
            });
            if (!res.ok) throw new Error('Failed to save project');
            return res.json();
        },
        onMutate: async ({ project: updatedProject, oldId }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.projects });
            
            const previousProjects = queryClient.getQueryData<Project[]>(queryKeys.projects);
            
            if (previousProjects) {
                const lookupId = oldId || updatedProject.id;
                const idx = previousProjects.findIndex(p => p.id === lookupId);
                const newProjects = [...previousProjects];
                if (idx >= 0) {
                    newProjects[idx] = updatedProject;
                } else {
                    newProjects.unshift(updatedProject);
                }
                queryClient.setQueryData(queryKeys.projects, newProjects);
            }
            
            return { previousProjects };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousProjects) {
                queryClient.setQueryData(queryKeys.projects, context.previousProjects);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects });
        },
    });
}

/**
 * Delete a project by ID.
 */
export function useDeleteProject() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (projectId: string) => {
            const res = await apiFetch(`/api/v1/projects/delete?id=${encodeURIComponent(projectId)}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete project');
            return res.json();
        },
        onMutate: async (projectId) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.projects });
            const previousProjects = queryClient.getQueryData<Project[]>(queryKeys.projects);
            if (previousProjects) {
                queryClient.setQueryData(
                    queryKeys.projects,
                    previousProjects.filter(p => p.id !== projectId)
                );
            }
            return { previousProjects };
        },
        onError: (_err, _id, context) => {
            if (context?.previousProjects) {
                queryClient.setQueryData(queryKeys.projects, context.previousProjects);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects });
        },
    });
}

/**
 * Move a project to a new status folder.
 */
export function useMoveProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ clientName, newStatus }: { clientName: string; newStatus: string }) => {
            const res = await apiFetch('/api/v1/projects/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientName, newStatus }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to move project');
            }
            return res.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects });
        },
    });
}

/**
 * Create a client folder on the backend.
 */
export function useCreateClientFolder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ clientName, status }: { clientName: string; status: string }) => {
            const res = await apiFetch('/api/v1/files/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientName, status }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                const error = new Error(data.error || 'Failed to create client folder') as any;
                error.status = res.status;
                error.data = data;
                throw error;
            }
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects });
        },
    });
}

/**
 * Initialize the database.
 */
export function useInitDatabase() {
    return useMutation({
        mutationFn: async () => {
            const res = await apiFetch('/api/v1/database/init', { method: 'POST' });
            return res.json();
        },
    });
}

// ============================================================================
// EVENTS / CALENDAR
// ============================================================================

/**
 * Fetch Google Calendar events.
 * Fetches from start of previous month to +90 days for full calendar coverage.
 */
export function useGoogleCalendarEvents(enabled: boolean = true) {
    return useQuery({
        queryKey: queryKeys.events,
        queryFn: async () => {
            // Build a wide time range: start of previous month to +90 days
            const now = new Date();
            const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endRange = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
            const timeMin = startOfPrevMonth.toISOString();
            const timeMax = endRange.toISOString();
            const res = await apiFetch(`/api/v1/gcal/events?time_min=${timeMin}&time_max=${timeMax}&refresh=true`);
            if (!res.ok) return [];
            const data = await res.json();
            return (data.events || []) as CalendarEvent[];
        },
        enabled,
        staleTime: 60 * 1000,
        refetchInterval: 3 * 60 * 1000, // Refresh every 3 minutes
    });
}

/**
 * Check Google Calendar sync status.
 */
export function useCalendarSync() {
    return useQuery({
        queryKey: queryKeys.calendarSync,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/gcal/sync-status');
            if (!res.ok) return { synced: false, connected: false };
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
        refetchInterval: 3 * 60 * 1000,
    });
}

/**
 * Create a Google Calendar event.
 */
export function useCreateGoogleEvent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (event: {
            title: string;
            description?: string;
            date: string;
            startTime: string;
            duration: number;
            addMeet?: boolean;
            colorId?: string;
        }) => {
            const res = await apiFetch('/api/v1/gcal/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
            });
            if (!res.ok) throw new Error('Failed to create Google Calendar event');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.events });
        },
    });
}

/**
 * Update a Google Calendar event.
 */
export function useUpdateGoogleEvent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ googleEventId, event }: {
            googleEventId: string;
            event: {
                title: string;
                description?: string;
                date: string;
                startTime: string;
                duration: number;
                colorId?: string;
            };
        }) => {
            const res = await apiFetch(`/api/v1/gcal/events/${googleEventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
            });
            if (!res.ok) throw new Error('Failed to update Google Calendar event');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.events });
        },
    });
}

/**
 * Delete a Google Calendar event.
 */
export function useDeleteGoogleEvent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (googleEventId: string) => {
            const res = await apiFetch(`/api/v1/gcal/events/${googleEventId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete Google Calendar event');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.events });
        },
    });
}

// ============================================================================
// EXPENSES
// ============================================================================

/**
 * Fetch all expenses.
 */
export function useExpenses() {
    return useQuery({
        queryKey: queryKeys.expenses,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/expenses');
            if (!res.ok) throw new Error('Failed to load expenses');
            const data = await res.json();
            return (data.expenses || []) as Expense[];
        },
    });
}

/**
 * Delete an expense.
 */
export function useDeleteExpense() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (expenseId: string) => {
            const res = await apiFetch(`/api/v1/expenses/${expenseId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete expense');
            return res.json();
        },
        onMutate: async (expenseId) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.expenses });
            const previousExpenses = queryClient.getQueryData<Expense[]>(queryKeys.expenses);
            if (previousExpenses) {
                queryClient.setQueryData(
                    queryKeys.expenses,
                    previousExpenses.filter(e => e.id !== expenseId)
                );
            }
            return { previousExpenses };
        },
        onError: (_err, _id, context) => {
            if (context?.previousExpenses) {
                queryClient.setQueryData(queryKeys.expenses, context.previousExpenses);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.expenses });
        },
    });
}

/**
 * Scan a receipt to create an expense (upload file).
 */
export function useScanExpense() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiFetch('/api/v1/expenses/scan', {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) throw new Error('Failed to scan expense');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.expenses });
        },
    });
}

// ============================================================================
// NOTES
// ============================================================================

/**
 * Fetch all notes.
 */
export function useNotes() {
    return useQuery({
        queryKey: queryKeys.notes,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/notes');
            if (!res.ok) throw new Error('Failed to load notes');
            return res.json();
        },
    });
}

/**
 * Save a note.
 */
export function useSaveNote() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (note: any) => {
            const res = await apiFetch('/api/v1/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(note),
            });
            if (!res.ok) throw new Error('Failed to save note');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.notes });
        },
    });
}

/**
 * Delete a note.
 */
export function useDeleteNote() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (noteId: string) => {
            const res = await apiFetch('/api/v1/notes', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: noteId }),
            });
            if (!res.ok) throw new Error('Failed to delete note');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.notes });
        },
    });
}

// ============================================================================
// FRANCK (AI)
// ============================================================================

/**
 * Fetch a contextual greeting from Franck.
 */
export function useFranckGreeting() {
    return useQuery({
        queryKey: queryKeys.franckGreeting,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/franck/greeting');
            if (!res.ok) return { greeting: 'Salut !' };
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
}

// ============================================================================
// VERSION & UPDATES
// ============================================================================

/**
 * Fetch current app version.
 */
export function useVersion() {
    return useQuery({
        queryKey: queryKeys.version,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/version');
            if (!res.ok) throw new Error('Failed to fetch version');
            return res.json();
        },
        staleTime: 60 * 60 * 1000,
    });
}

/**
 * Check for available updates.
 */
export function useCheckUpdates() {
    return useMutation({
        mutationFn: async () => {
            const res = await apiFetch('/api/v1/updates/check');
            if (!res.ok) throw new Error('Failed to check for updates');
            return res.json();
        },
    });
}

/**
 * Apply an available update.
 */
export function useApplyUpdate() {
    return useMutation({
        mutationFn: async () => {
            const res = await apiFetch('/api/v1/updates/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error('Failed to apply update');
            return res.json();
        },
    });
}

// ============================================================================
// OAUTH
// ============================================================================

/**
 * Check Google OAuth connection status.
 */
export function useOAuthStatus() {
    return useQuery({
        queryKey: queryKeys.oauthStatus,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/oauth/google/status');
            if (!res.ok) return { connected: false };
            return res.json();
        },
        staleTime: 2 * 60 * 1000,       // consider stale after 2 min
        refetchInterval: 5 * 60 * 1000,  // re-check every 5 min
    });
}

/**
 * Start Google OAuth login flow.
 */
export function useConnectGoogle() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const res = await apiFetch('/api/v1/oauth/google/login');
            if (!res.ok) throw new Error('Failed to start Google login');
            return res.json();
        },
        onSuccess: () => {
            // Status will be checked after popup completes
            queryClient.invalidateQueries({ queryKey: queryKeys.oauthStatus });
        },
    });
}

/**
 * Disconnect Google OAuth.
 */
export function useDisconnectGoogle() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const res = await apiFetch('/api/v1/oauth/google/disconnect', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to disconnect Google');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.oauthStatus });
            queryClient.invalidateQueries({ queryKey: queryKeys.calendarSync });
            queryClient.invalidateQueries({ queryKey: queryKeys.events });
        },
    });
}

// ============================================================================
// STATUS CHECK
// ============================================================================

/**
 * Check backend status / configuration.
 * Used during app initialization.
 */
export function useCheckStatus(enabled: boolean = true) {
    return useQuery({
        queryKey: queryKeys.checkStatus,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/ai/check-status');
            if (!res.ok) throw new Error('Backend unreachable');
            return res.json();
        },
        enabled,
        staleTime: 30 * 1000,
        retry: 1,
    });
}

// ============================================================================
// UTILITY - Direct cache manipulation for optimistic updates
// ============================================================================

/**
 * Update a single project in the React Query cache without refetching.
 * Useful for local/optimistic updates.
 */
export function useUpdateProjectCache() {
    const queryClient = useQueryClient();

    return (updatedProject: Project, oldId?: string) => {
        queryClient.setQueryData<Project[]>(queryKeys.projects, (old) => {
            if (!old) return [updatedProject];
            const id = oldId || updatedProject.id;
            const idx = old.findIndex(p => p.id === id);
            const newProjects = [...old];
            if (idx >= 0) {
                newProjects[idx] = updatedProject;
            } else {
                newProjects.unshift(updatedProject);
            }
            return newProjects;
        });
    };
}

/**
 * Remove a project from the React Query cache.
 */
export function useRemoveProjectFromCache() {
    const queryClient = useQueryClient();

    return (projectId: string) => {
        queryClient.setQueryData<Project[]>(queryKeys.projects, (old) => {
            if (!old) return [];
            return old.filter(p => p.id !== projectId);
        });
    };
}

// ============================================================================
// WORKSPACE
// ============================================================================

/**
 * Fetch the current workspace (with branding).
 */
export function useWorkspace() {
    return useQuery({
        queryKey: queryKeys.workspace,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/workspace');
            if (!res.ok) return null;
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Fetch all workspaces the user belongs to.
 */
export function useWorkspaces() {
    return useQuery({
        queryKey: queryKeys.workspaces,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/workspaces');
            if (!res.ok) return [];
            const data = await res.json();
            return data.workspaces || [];
        },
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Fetch workspace members.
 */
export function useWorkspaceMembers() {
    return useQuery({
        queryKey: queryKeys.workspaceMembers,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/workspace/members');
            if (!res.ok) return [];
            const data = await res.json();
            return data.members || [];
        },
        staleTime: 60 * 1000,
    });
}

/**
 * Fetch workspace branding.
 */
export function useWorkspaceBranding() {
    return useQuery({
        queryKey: queryKeys.workspaceBranding,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/workspace/branding');
            if (!res.ok) return null;
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
    });
}

/**
 * Update workspace branding.
 */
export function useUpdateBranding() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (branding: Record<string, any>) => {
            const res = await apiFetch('/api/v1/workspace/branding', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(branding),
            });
            if (!res.ok) throw new Error('Failed to update branding');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.workspaceBranding });
            queryClient.invalidateQueries({ queryKey: queryKeys.workspace });
        },
    });
}

/**
 * Add a member to the workspace.
 */
export function useAddWorkspaceMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ email, role }: { email: string; role?: string }) => {
            const res = await apiFetch('/api/v1/workspace/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, role: role || 'member' }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add member');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.workspaceMembers });
        },
    });
}

/**
 * Remove a member from the workspace.
 */
export function useRemoveWorkspaceMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (memberId: number) => {
            const res = await apiFetch(`/api/v1/workspace/members/${memberId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to remove member');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.workspaceMembers });
        },
    });
}

// ============================================================================
// ANALYTICS
// ============================================================================

export interface AnalyticsTopClient {
    client: string;
    hours: number;
    revenue: number;
    hourlyRate: number;
}

export interface AnalyticsMonthlyRevenue {
    month: string;
    label: string;
    revenue: number;
    revenuePrevYear: number;
}

export interface AnalyticsSummary {
    timeByClient: Record<string, { hours: number; entries: number }>;
    conversionRates: {
        estimateToInvoice: number;
        invoiceToPaid: number;
    };
    avgPaymentDelay: number;
    monthlyRevenue: AnalyticsMonthlyRevenue[];
    newClientsByMonth: Record<string, number>;
    topClients: AnalyticsTopClient[];
    totals: {
        totalInvoices: number;
        totalPaid: number;
        totalEstimates: number;
        totalRevenue: number;
    };
}

/**
 * Fetch aggregated analytics summary.
 * Includes real time tracking, conversion rates, monthly revenue trends.
 */
export function useAnalytics() {
    return useQuery<AnalyticsSummary>({
        queryKey: queryKeys.analytics,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/analytics/summary');
            if (!res.ok) throw new Error('Failed to load analytics');
            const data = await res.json();
            return data as AnalyticsSummary;
        },
        staleTime: 5 * 60 * 1000,  // Consider stale after 5 min
    });
}

// ============================================================================
// BACKUP & CLOUD BACKUP HOOKS
// ============================================================================

export interface CloudBackupFile {
    id: string;
    name: string;
    date: string;
    size: number;
    link: string;
}

export interface BackupStatus {
    success: boolean;
    lastBackup: string | null;
    backupCount: number;
    totalSizeBytes: number;
    totalSizeMB: number;
    nextBackupInSeconds: number;
    nextBackupInHours: number;
    backups: { name: string; date: string; size: number }[];
    cloudEnabled: boolean;
    lastCloudBackup: string | null;
    lastCloudBackupLink: string | null;
    cloudBackups: CloudBackupFile[];
}

export interface CloudBackupConfig {
    success: boolean;
    cloudBackupEnabled: boolean;
    lastCloudBackup: string | null;
    lastCloudBackupLink: string | null;
}

/**
 * Fetch backup status (local + cloud).
 */
export function useBackupStatus(enabled: boolean = true) {
    return useQuery<BackupStatus>({
        queryKey: queryKeys.backupStatus,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/backup/status');
            if (!res.ok) throw new Error('Failed to load backup status');
            return res.json();
        },
        enabled,
        staleTime: 60 * 1000, // 1 minute
    });
}

/**
 * Fetch cloud backup config.
 */
export function useCloudBackupConfig() {
    return useQuery<CloudBackupConfig>({
        queryKey: queryKeys.cloudBackupConfig,
        queryFn: async () => {
            const res = await apiFetch('/api/v1/backup/cloud/config');
            if (!res.ok) throw new Error('Failed to load cloud backup config');
            return res.json();
        },
    });
}

/**
 * Toggle cloud backup on/off.
 */
export function useSetCloudBackupConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (cloudBackupEnabled: boolean) => {
            const res = await apiFetch('/api/v1/backup/cloud/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cloudBackupEnabled }),
            });
            if (!res.ok) throw new Error('Failed to update cloud backup config');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.cloudBackupConfig });
            queryClient.invalidateQueries({ queryKey: queryKeys.backupStatus });
        },
    });
}

/**
 * Trigger a manual cloud backup (local + upload to Drive).
 */
export function useCloudBackup() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const res = await apiFetch('/api/v1/backup/cloud', {
                method: 'POST',
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Cloud backup failed');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.backupStatus });
            queryClient.invalidateQueries({ queryKey: queryKeys.cloudBackupConfig });
        },
    });
}
