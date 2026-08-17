
export enum ProjectStatus {
    EN_COURS = 'En cours',
    MAINTENANCE = 'Maintenance',
    ASSOCIATION = 'Association',
    PROSPECT = 'Prospect',
    ARCHIVED = 'Archivé'
  }
  
  export enum WorkflowPhase {
    DISCOVERY = 'Découverte',
    STRATEGY = 'Stratégie',
    DESIGN = 'Design',
    DEV = 'Développement',
    QA = 'Recettage',
    MAINTENANCE = 'Maintenance'
  }

  export type Theme = 'light' | 'dark' | 'unicorn';
  
  export interface Task {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    column?: 'todo' | 'doing' | 'done'; // Kanban column state
    dueDate?: string;
    priority: 'Low' | 'Medium' | 'High';
    phase: WorkflowPhase;
    sortOrder?: number;
  }
  
  /**
   * Swiss VAT rates (LTVA) valid from 2024-01-01:
   *   8.1  — taux normal
   *   3.8  — taux spécial hébergement
   *   2.6  — taux réduit (alimentation, presse, médicaments)
   *   0    — exonéré / non-applicable
   * Stored as numbers (not strings) so they participate directly in math.
   */
  export type SwissVatRate = 0 | 2.6 | 3.8 | 8.1;

  export interface InvoiceItem {
    id: string;
    desc: string;
    quantity: number;
    price: number; // Unit price (HT if vatRate is set, else gross — see invoiceEngine)
    /** Taux TVA suisse appliqué à cette ligne. Absent ⇒ legacy (TVA inclusive 0). */
    vatRate?: SwissVatRate;
    /** Ligne exonérée (art. 21 LTVA) — affichage spécial dans le PDF. */
    vatExempt?: boolean;
  }

  export interface InvoicePayment {
    id: string;
    amount: number;
    date: string;
    method: 'Virement' | 'Carte' | 'Espèces' | 'Stripe' | 'Autre';
    note?: string;
  }

  /** Ventilation TVA par taux, persistée pour audit. */
  export interface VatBreakdownEntry {
    rate: SwissVatRate;
    netHt: number;
    vat: number;
  }

  /** Informations créancier (Marion) — utilisées pour QR-bill et footer légal. */
  export interface CreditorInfo {
    name: string;
    address: string;
    zip: string;
    city: string;
    country: string; // ISO 3166-1 alpha-2 (CH, FR, …)
    iban: string;     // IBAN ou QR-IBAN (IID 30000-31999), avec ou sans espaces
    /** Numéro TVA suisse au format CHE-xxx.xxx.xxx TVA */
    vatNumber?: string;
    /** Numéro IDE/UID au format CHE-xxx.xxx.xxx */
    ide?: string;
  }

  /** Référence QR-bill : QRR (27 digits, QR-IBAN), SCOR (Creditor Reference RF…), NON (sans réf.). */
  export type QrReferenceType = 'QRR' | 'SCOR' | 'NON';

  export interface InvoiceQr {
    referenceType: QrReferenceType;
    /** Pour QRR : 27 chiffres avec checksum modulo 10 récursif. Pour SCOR : "RFxx…" max 25. */
    reference?: string;
    /** Message libre (max 140 chars en QR-bill v2.0). */
    message?: string;
    /** Information supplémentaire structurée (max 140 chars). */
    additionalInfo?: string;
  }

  /** Entrée du journal d'audit immuable d'une facture. */
  export interface InvoiceAuditEntry {
    at: string;        // ISO 8601
    actor: string;     // utilisateur (Marion par défaut)
    action:
      | 'create' | 'edit' | 'send' | 'pay' | 'partial-pay'
      | 'remind' | 'void' | 'archive' | 'restore' | 'issue'
      | 'credit-note' | 'recurrence-tick';
    note?: string;
  }

  /** Configuration récurrence (génération automatique). */
  export interface InvoiceRecurrence {
    frequency: 'monthly' | 'quarterly' | 'yearly';
    nextRunAt: string;        // ISO date du prochain run
    until?: string;           // ISO date de fin (optionnel)
    /** id de la facture qui sert de template — autoclone lors du tick. */
    templateInvoiceId?: string;
  }

  /** Relance enregistrée. */
  export interface InvoiceReminder {
    level: 1 | 2 | 3;
    sentAt: string;
    feeChf?: number; // frais de rappel ajoutés (param. dans Settings)
  }

  /**
   * Statuts de facture (étendus pour conformité CO art. 958f) :
   *   Draft     — brouillon non émis, modifiable & supprimable
   *   Sent      — émise (numéro verrouillé) en attente de paiement
   *   Pending   — alias historique de Sent (compat existant)
   *   Partial   — partiellement payée
   *   Paid      — soldée
   *   Overdue   — calculé : Sent/Pending/Partial + dueDate < aujourd'hui
   *   Voided    — annulée (conservée 10 ans, exclue des KPIs)
   *   Archived  — archivée manuellement (idem Voided pour KPI)
   */
  export type InvoiceStatus =
    | 'Draft' | 'Sent' | 'Pending' | 'Partial' | 'Paid'
    | 'Overdue' | 'Voided' | 'Archived';

  export type InvoiceType = 'Invoice' | 'Estimate' | 'CreditNote';

  export interface Invoice {
    id: string;
    number: string;
    /** Verrouillé dès le passage Draft → Sent/Pending. */
    numberLocked?: boolean;
    date: string;
    dueDate?: string;
    /** Délai de paiement en jours (Swiss standard = 30). */
    paymentTermsDays?: number;
    clientAddress?: string;
    clientDisplayName?: string;

    /** Total brut (legacy ou TTC quand TVA présente). Conservé pour KPIs & compat. */
    amount: number;
    /** Sous-total HT (somme nette des lignes après TVA breakdown). Optionnel = legacy. */
    subtotalHt?: number;
    /** Total TVA (somme vatBreakdown). */
    totalVat?: number;
    /** Total TTC (= subtotalHt + totalVat). En général ≈ amount. */
    totalTtc?: number;
    /** Ventilation TVA par taux. */
    vatBreakdown?: VatBreakdownEntry[];

    currency?: string;
    /** Taux CHF figé à l'émission (multi-devise). */
    fxRateChf?: number;

    status: InvoiceStatus;
    type: InvoiceType;
    /** Facture d'origine pour une note de crédit. */
    parentInvoiceId?: string;

    items: InvoiceItem[];
    payments?: InvoicePayment[];
    paymentLink?: string;
    footerNote?: string;

    /** Créancier (Marion). Si absent : fallback sur valeurs du template/Settings. */
    creditor?: CreditorInfo;
    /** Bloc QR-bill structuré (Phase 3). */
    qr?: InvoiceQr;

    /** Timestamps de cycle de vie. */
    issuedAt?: string;
    sentAt?: string;
    paidAt?: string;
    voidedAt?: string;
    archivedAt?: string;
    voidReason?: string;

    /** Récurrence (Phase 4). */
    recurrence?: InvoiceRecurrence;
    /** Relances (Phase 4). */
    reminders?: InvoiceReminder[];

    /** Journal d'audit (append-only). */
    history?: InvoiceAuditEntry[];

    /** Marqueur de migration : true pour anciennes factures pré-v2. */
    legacy?: boolean;
  }

  export interface InvoiceTemplate {
    id: string;
    name: string;
    senderName: string;
    senderAddress: string;
    logoUrl?: string;
    paymentTerms: string;
    bankId: string;
    footerNote?: string;
    createdAt: string;
    /** Données créancier suisse (mentions légales). */
    creditor?: CreditorInfo;
    /** Délai de paiement par défaut. */
    paymentTermsDays?: number;
    /** Frais de relance par niveau (CHF). [niveau 1, 2, 3]. */
    reminderFees?: [number, number, number];
  }
  
  export interface ClientProfile {
    email: string;
    phone: string;
    website: string;
    address?: string; // NEW: Physical address
    driveLink?: string;
    serverAccess?: string;
    customFields: { key: string; value: string }[];
  }

  export interface BrandColor {
    name: string;
    hex: string;
  }

    export interface BrandFont {
      name: string;
      type: 'Serif' | 'Sans-Serif' | 'Display' | 'Mono';
      usage: 'Title' | 'Body' | 'Accent';
    }
  
    // New Moodboard Interfaces
    export interface MoodboardImage {
      id: string;
      type: 'image';
      url: string; // Base64 or external URL
      name?: string;
    }
  
    export interface MoodboardColor {
      id: string;
      type: 'color';
      name?: string;
      hex: string;
      rgb?: string;
      hsl?: string;
    }
  
    export interface MoodboardFont {
      id: string;
      type: 'font';
      name: string;
      category?: 'serif' | 'sans-serif' | 'display' | 'monospace';
      url?: string; // Link to Google Fonts or local file
    }
  
    export type MoodboardItem = MoodboardImage | MoodboardColor | MoodboardFont;
    
    export interface Credential {
    id: string;
    service: string;
    url?: string;
    username: string;
    password: string;
    notes?: string;
  }
  
  export interface MaintenanceInfo {
    /** Maintenance active → apparaît dans la checklist / tournée. */
    active?: boolean;
    /** Mode exclusif : offerte jusqu’à une date, ou facturation à une date. */
    mode?: 'offered' | 'billing';
    freeMaintenanceEndDate?: string; // Date de fin de la maintenance offerte
    /** Prochaine (ou unique) date de facturation — synchro calendrier. */
    billingDate?: string;
    contractSignDate?: string; // Date de signature du contrat de maintenance
    billingDates?: string[]; // Legacy : dates de facturation multiples
    hasContract: boolean; // Si un contrat de maintenance est signé
    monthlyPrice?: number; // Coût / tarif mensuel
    /** IDs d’événements calendrier générés automatiquement. */
    calendarEventIds?: string[];
  }

export interface MeetingReportTask {
    id?: string;
    title: string;
    owner?: string;
    deadline?: string;
    priority?: 'Low' | 'Medium' | 'High';
}

export interface MeetingCoachingMoment {
    timestampSec?: number;
    cue: string;
    rationale?: string;
}

export interface MeetingEvidenceItem {
    speaker?: string;
    timestampSec?: number;
    quote: string;
}

export interface MeetingReport {
    id: string;
    clientName: string;
    generatedAt: string;
    durationSeconds?: number;
    objective?: string;
    summary: string;
    keyPoints: string[];
    decisions: string[];
    risks: string[];
    objections: string[];
    nextSteps: string[];
    tasks: MeetingReportTask[];
    coachingMoments?: MeetingCoachingMoment[];
    evidence?: MeetingEvidenceItem[];
    followUpDraft?: string;
    transcriptExcerpt?: string;
    consentAccepted?: boolean;
    retentionDays?: number;
    requestId?: string;
    meetingScore?: { score: number; rationale: string };
}

  export interface Project {
    id: string;
    clientName: string;
    avatarInitials: string;
    avatarColor?: string; // CSS gradient class string
    avatarImage?: string; // URL or Base64 string for custom image
    logoTransform?: { x: number; y: number; scale: number }; // Position & scale adjustment
    status: ProjectStatus;
    phase: WorkflowPhase;
    tasks: Task[];
    invoices: Invoice[];
    profile: ClientProfile;
    brandKit?: {
        colors: BrandColor[];
        fonts: BrandFont[];
    };
    credentials?: Credential[];
    credentialsLocked?: boolean;
    moodboard?: MoodboardItem[]; // New: For creative assets
    progress: number; // 0-100
    createdAt: string;
    unreadEmailCount?: number; // NEW: Number of unread emails for this client
    logoLabData?: any; // Stores the raw state of LogoLab (elements, bgColor)
    archiveCategory?: string;
    portalSettings?: ClientPortalSettings;
    portalComments?: ClientPortalComment[];
    maintenance?: MaintenanceInfo; // Informations de maintenance
    links?: Record<string, string>; // External links (figma, github, wordpress, etc.)
    meetingReports?: MeetingReport[];
  }
  
export interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    startTime: string;
    duration: number; // in minutes
    type: 'Deadlines' | 'Call ou rdv pro' | 'To do pro' | 'Anniversaire' | 'Facturation' | 'Perso' | 'Maintenances' | 'Sport';
    colorId?: string;
    meetLink?: string;
    description?: string;
    location?: string;
    originalTimezone?: string;
    originalDateTime?: string; // ISO string
    source?: 'local' | 'iCal' | 'google' | 'infomaniak';
    isAppEvent?: boolean;
    calendarName?: string;
    googleEventId?: string;
    infomaniakEventId?: string;
}
  
  export interface FinderItem {
    id: string;
    name: string;
    type: 'folder' | 'file';
    children?: FinderItem[];
  }
  
  export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    timestamp: Date;
  }

export type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'ai' | 'finance' | 'deadline';

export interface NotificationAction {
    label: string;
    onClick: () => void;
}

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    action?: NotificationAction;
    link?: string; // Route to navigate to on click (e.g. "/client/ProjectName", "/finances")
}

export type FocusSessionState = 'idle' | 'running' | 'paused' | 'break' | 'completed';

export type FocusPhase = 'focus' | 'short_break' | 'long_break';

export interface FocusSession {
    id: string;
    startedAt: string;
    endedAt: string;
    plannedMinutes: number;
    actualMinutes: number;
    objective: string;
    resultSummary: string;
    state: FocusSessionState;
    linkedTaskId?: string;
    linkedProjectId?: string;
    interruptionCount: number;
}

export interface FocusSettings {
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    longBreakEvery: number;
    autoStartNextPhase: boolean;
    muteToastsDuringFocus: boolean;
    calmMode: boolean;
}

export interface Expense {
    id: string;
    date: string;
    supplier: string;
    amount: number;
    category: 'Software' | 'Hardware' | 'Office' | 'Travel' | 'Services' | 'Tax' | 'Other';
    fileUrl?: string;
    description?: string;
}

export type ActivityType = 
    | 'invoice_created' 
    | 'invoice_paid' 
    | 'project_created' 
    | 'project_archived' 
    | 'project_status_changed'
    | 'task_completed' 
    | 'client_updated'
    | 'brand_updated'
    | 'meeting_scheduled'
    | 'file_uploaded';

export interface Activity {
    id: string;
    type: ActivityType;
    title: string;
    description?: string;
    projectId?: string;
    projectName?: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

export interface ClientPortalComment {
    id: string | number;
    author: string;
    text: string;
    timestamp?: string;
    createdAt?: string;
    phaseRef?: WorkflowPhase;
    isAdmin?: boolean;
    seen?: boolean;
}

export interface ClientPortalSettings {
    enabled: boolean;
    shareToken: string;
    pin?: string;
    showTasks: boolean;
    showTimeline: boolean;
    allowComments: boolean;
    showDeliverables: boolean;
    showUpdates: boolean;
    allowUploads: boolean;
    customMessage?: string;
    clientName?: string;
    lastAccessed?: string;
    showAccount?: boolean; // Enable "Mon Compte" section
    language?: 'fr' | 'en' | 'es'; // Portal language
}

export type PortalDeliverableType = 'link' | 'image' | 'file' | 'figma' | 'website';

export interface PortalDeliverable {
    id: number;
    type: PortalDeliverableType;
    title: string;
    url?: string;
    description?: string;
    thumbnail?: string;
    visible: boolean;
    sortOrder: number;
    createdAt?: string;
    filePath?: string;
    originalName?: string;
}

export interface PortalUpdate {
    id: number;
    phase?: string;
    title: string;
    content?: string;
    attachments?: string[];
    createdAt?: string;
}

export type PortalDocumentType = 'contract' | 'invoice' | 'quote' | 'report' | 'other';

export interface PortalDocument {
    id: number;
    title: string;
    docType: PortalDocumentType;
    originalName: string;
    mimeType?: string;
    sizeBytes: number;
    visible: boolean;
    uploadedAt?: string;
}

export type PortalFileCategory = 'text' | 'image' | 'logo' | 'document' | 'other';

export interface PortalClientFile {
    id: number;
    filename?: string;
    originalName: string;
    mimeType?: string;
    sizeBytes: number;
    category: PortalFileCategory;
    note?: string;
    authorName?: string;
    seen?: boolean;
    createdAt?: string;
}

export interface PortalActivityItem {
    id: string;
    type: 'update' | 'comment' | 'file';
    title: string;
    content?: string;
    author: string;
    isAdmin?: boolean;
    phase?: string;
    category?: string;
    createdAt: string;
}

// --- Goals & KPIs ---
export interface Goal {
    id: string;
    title: string;
    description?: string;
    type: 'revenue' | 'clients' | 'projects' | 'custom';
    target: number;
    current: number;
    unit: string; // 'CHF', 'clients', 'projets', etc.
    period: 'monthly' | 'quarterly' | 'yearly';
    year: number;
    month?: number; // 1-12 for monthly goals
    quarter?: number; // 1-4 for quarterly goals
    createdAt: string;
    completedAt?: string;
}

export interface KPI {
    id: string;
    name: string;
    value: number;
    previousValue?: number;
    unit: string;
    trend: 'up' | 'down' | 'stable';
    category: 'finance' | 'clients' | 'productivity';
}

// --- Document Templates ---
export interface DocumentTemplate {
    id: string;
    name: string;
    type: 'devis' | 'contrat' | 'email' | 'autre';
    category?: string;
    content: string;
    variables: string[]; // e.g., ['{{client_name}}', '{{date}}', '{{amount}}']
    createdAt: string;
    updatedAt: string;
    usageCount: number;
}

// --- Email Signatures ---
export interface EmailSignature {
    id: string;
    name: string;
    content: string;
    isDefault: boolean;
    createdAt: string;
}

// --- Email Templates ---
export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
    category: 'relance' | 'devis' | 'remerciement' | 'suivi' | 'autre';
    variables: string[];
    createdAt: string;
    usageCount: number;
}

// --- Messaging (WhatsApp/SMS) ---
export interface Message {
    id: string;
    direction: 'incoming' | 'outgoing';
    content: string;
    timestamp: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    platform: 'whatsapp' | 'sms';
}

export interface Conversation {
    id: string;
    contactName: string;
    contactPhone: string;
    projectId?: string;
    platform: 'whatsapp' | 'sms';
    messages: Message[];
    lastMessage?: Message;
    unreadCount: number;
    updatedAt: string;
}

// --- Treasury Forecast ---
export interface TreasuryEntry {
    id: string;
    type: 'income' | 'expense';
    description: string;
    amount: number;
    date: string;
    category: string;
    isRecurring: boolean;
    recurringFrequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    projectId?: string;
    invoiceId?: string;
    status: 'confirmed' | 'expected' | 'pending';
}