
export enum ProjectStatus {
    PROSPECT = 'Prospect',
    ACTIVE = 'Active',
    ARCHIVED = 'Archived',
    PRO_BONO = 'Pro Bono',
    PERSO = 'Perso'
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
    description?: string; // Added description for objectives
    completed: boolean;
    column?: 'todo' | 'doing' | 'done'; // Kanban column state
    dueDate?: string;
    priority: 'Low' | 'Medium' | 'High';
    phase: WorkflowPhase;
  }
  
  export interface InvoiceItem {
    id: string;
    desc: string;
    quantity: number;
    price: number; // Unit price
  }

  export interface InvoicePayment {
    id: string;
    amount: number;
    date: string;
    method: 'Virement' | 'Carte' | 'Espèces' | 'Stripe' | 'Autre';
    note?: string;
  }

  export interface Invoice {
    id: string;
    number: string;
    date: string;
    dueDate?: string;
    clientAddress?: string;
    clientDisplayName?: string;
    amount: number;
    currency?: string;
    status: 'Paid' | 'Pending' | 'Draft' | 'Partial';
    type: 'Invoice';
    items: InvoiceItem[];
    payments?: InvoicePayment[];
    paymentLink?: string;
    footerNote?: string;
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
    freeMaintenanceEndDate?: string; // Date de fin de la maintenance offerte
    contractSignDate?: string; // Date de signature du contrat de maintenance
    billingDates?: string[]; // Dates de facturation récurrentes
    hasContract: boolean; // Si un contrat de maintenance est signé
  }

  export interface Project {
    id: string;
    clientName: string;
    avatarInitials: string;
    avatarColor?: string; // CSS gradient class string
    avatarImage?: string; // URL or Base64 string for custom image
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
    moodboard?: MoodboardItem[]; // New: For creative assets
    progress: number; // 0-100
    createdAt: string;
    unreadEmailCount?: number; // NEW: Number of unread emails for this client
    logoLabData?: any; // Stores the raw state of LogoLab (elements, bgColor)
    archiveCategory?: string;
    portalSettings?: ClientPortalSettings;
    portalComments?: ClientPortalComment[];
    maintenance?: MaintenanceInfo; // Informations de maintenance
  }
  
export interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    startTime: string;
    duration: number; // in minutes
    type: 'Meeting' | 'Deadline' | 'Focus' | 'Personal';
    meetLink?: string;
    description?: string;
    originalTimezone?: string;
    originalDateTime?: string; // ISO string
    source?: 'local' | 'iCal' | 'google';
    isAppEvent?: boolean;
    calendarName?: string;
    googleEventId?: string;
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
    title: string; // Added title
    message: string;
    timestamp: Date;
    read: boolean;
    action?: NotificationAction; // Added action
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
    id: string;
    author: string;
    text: string;
    timestamp: string;
    phaseRef?: WorkflowPhase;
}

export interface ClientPortalSettings {
    enabled: boolean;
    shareToken: string;
    showTasks: boolean;
    showTimeline: boolean;
    allowComments: boolean;
    lastAccessed?: string;
}