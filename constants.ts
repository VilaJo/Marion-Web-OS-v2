import { Project, ProjectStatus, WorkflowPhase, CalendarEvent, FinderItem, Task } from './types';
import { Telescope, Map, Palette, Code, Sparkles, Sprout, Flame, CloudRain } from 'lucide-react';

export const SOUNDS = [
    { id: 'rain', label: 'Pluie Douce', icon: CloudRain, url: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg' },
];

export const WORKFLOW_CONFIG = {
    [WorkflowPhase.DISCOVERY]: { 
        label: 'Exploration', 
        desc: 'Vision & Besoins', 
        icon: Telescope,
        color: 'text-yellow-600',
        bg: 'bg-yellow-100',
        border: 'border-yellow-200',
        gradient: 'from-yellow-400 to-orange-400'
    },
    [WorkflowPhase.STRATEGY]: { 
        label: 'Cartographie', 
        desc: 'Structure & UX', 
        icon: Map,
        color: 'text-blue-600',
        bg: 'bg-blue-100',
        border: 'border-blue-200',
        gradient: 'from-cyan-400 to-blue-500'
    },
    [WorkflowPhase.DESIGN]: { 
        label: 'Magie Visuelle', 
        desc: 'UI & Émotion', 
        icon: Palette,
        color: 'text-pink-600',
        bg: 'bg-pink-100',
        border: 'border-pink-200',
        gradient: 'from-pink-400 to-rose-500'
    },
    [WorkflowPhase.DEV]: { 
        label: 'Construction', 
        desc: 'Code & Logique', 
        icon: Code,
        color: 'text-purple-600',
        bg: 'bg-purple-100',
        border: 'border-purple-200',
        gradient: 'from-purple-500 to-indigo-600'
    },
    [WorkflowPhase.QA]: { 
        label: 'Polissage', 
        desc: 'Chasse aux bugs', 
        icon: Sparkles,
        color: 'text-orange-600',
        bg: 'bg-orange-100',
        border: 'border-orange-200',
        gradient: 'from-orange-400 to-red-400'
    },
    [WorkflowPhase.MAINTENANCE]: { 
        label: 'Jardinage', 
        desc: 'Suivi & Soin', 
        icon: Sprout,
        color: 'text-emerald-600',
        bg: 'bg-emerald-100',
        border: 'border-emerald-200',
        gradient: 'from-emerald-400 to-green-500'
    }
};

// Define templates for PROSPECTS
export const PROSPECT_PHASE_TEMPLATES: Partial<Record<WorkflowPhase, Omit<Task, 'id' | 'completed' | 'phase'>[]>> = {
    [WorkflowPhase.DISCOVERY]: [
        { title: "Prise de contact", description: "Premier échange (mail/tel) pour qualifier l'intérêt.", priority: "High" },
        { title: "Qualification du besoin", description: "Identifier budget, délais et décideurs.", priority: "High" },
        { title: "Envoi Questionnaire", description: "Envoyer le questionnaire de pré-qualification.", priority: "Medium" }
    ],
    [WorkflowPhase.STRATEGY]: [
        { title: "Étude de faisabilité", description: "Vérifier la viabilité technique et planning.", priority: "Medium" },
        { title: "Estimation budgétaire", description: "Calculer le chiffrage macro du projet.", priority: "High" },
        { title: "Rédaction Proposition", description: "Rédiger la proposition commerciale détaillée.", priority: "High" }
    ],
    [WorkflowPhase.DESIGN]: [
        { title: "Moodboard Avant-Vente", description: "Créer une planche d'inspiration rapide pour séduire.", priority: "Low" }
    ],
    [WorkflowPhase.DEV]: [],
    [WorkflowPhase.QA]: [
        { title: "Relecture Devis", description: "Vérifier les CGV et les montants avant envoi.", priority: "High" }
    ],
    [WorkflowPhase.MAINTENANCE]: [
        { title: "Suivi Relance J+3", description: "Relancer le prospect si pas de réponse.", priority: "Medium" },
        { title: "Suivi Relance J+7", description: "Dernière relance avant archivage.", priority: "Low" }
    ]
};

// Define templates for ACTIVE CLIENTS (Workflow Marion)
export const ACTIVE_PHASE_TEMPLATES: Partial<Record<WorkflowPhase, Omit<Task, 'id' | 'completed' | 'phase'>[]>> = {
    // Exploration
    [WorkflowPhase.DISCOVERY]: [
        { title: "Discovery call - Identification du besoin", description: "", priority: "High" },
        { title: "Préparation de l’offre", description: "", priority: "High" },
        { title: "Envoi de l’offre", description: "", priority: "Medium" },
        { title: "Envoi du contrat pour signature", description: "", priority: "Medium" }
    ],
    // Cartographie
    [WorkflowPhase.STRATEGY]: [
        { title: "Cartographie", description: "", priority: "High" },
        { title: "Organisation du projet", description: "", priority: "Medium" },
        { title: "Récupération des accès", description: "", priority: "High" },
        { title: "Récupération des documents existants", description: "", priority: "Medium" }
    ],
    // Magie visuelle
    [WorkflowPhase.DESIGN]: [
        { title: "Magie visuelle", description: "", priority: "High" },
        { title: "Atelier Branding", description: "", priority: "High" },
        { title: "Création de la charte graphique", description: "", priority: "High" },
        { title: "Validation de la charte graphique", description: "", priority: "Medium" }
    ],
    // Construction
    [WorkflowPhase.DEV]: [
        { title: "Construction", description: "", priority: "High" },
        { title: "Création du logo", description: "", priority: "High" },
        { title: "Validation du logo", description: "", priority: "Medium" },
        { title: "Création du site internet", description: "", priority: "High" },
        { title: "Validation du site internet", description: "", priority: "Medium" }
    ],
    // Polissage
    [WorkflowPhase.QA]: [
        { title: "Polissage", description: "", priority: "High" },
        { title: "Tests techniques", description: "", priority: "High" },
        { title: "Responsive", description: "", priority: "Medium" },
        { title: "Corrections et ajustement", description: "", priority: "Medium" },
        { title: "Mise en ligne", description: "", priority: "High" }
    ],
    // Jardinage
    [WorkflowPhase.MAINTENANCE]: [
        { title: "Jardinage", description: "", priority: "Medium" },
        { title: "Maintenance offerte (jusque’à xx)", description: "", priority: "Medium" },
        { title: "Signature du contrat de maintenance", description: "", priority: "High" },
        { title: "Maintenance et suivi mensuel", description: "", priority: "Medium" }
    ]
};

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    clientName: 'Genève Avocats',
    avatarInitials: 'GA',
    status: ProjectStatus.ACTIVE,
    phase: WorkflowPhase.DESIGN,
    progress: 45,
    createdAt: '2023-10-15',
    profile: {
      email: 'contact@geneve-avocats.ch',
      phone: '+41 22 555 0102',
      website: 'geneve-avocats.ch',
      driveLink: 'drive.google.com/ga',
      customFields: [{ key: 'Code Postal', value: '1204' }]
    },
    brandKit: {
        colors: [
            { name: 'Primary', hex: '#1e3a8a' },
            { name: 'Secondary', hex: '#93c5fd' },
            { name: 'Accent', hex: '#fbbf24' }
        ],
        fonts: [
            { name: 'Playfair Display', type: 'Serif', usage: 'Title' },
            { name: 'Lato', type: 'Sans-Serif', usage: 'Body' }
        ]
    },
    credentials: [
        { id: 'c1', service: 'WordPress Admin', url: 'https://geneve-avocats.ch/wp-admin', username: 'marion_admin', password: 'SuperSecurePassword123!' },
        { id: 'c2', service: 'FTP Serveur', url: 'ftp.geneve-avocats.ch', username: 'ga_ftp', password: 'ftp_password_2024' }
    ],
    tasks: [
      { id: 't1', title: 'Valider les maquettes UX', description: 'Obtenir la validation formelle des wireframes avant la UI.', completed: true, priority: 'High', phase: WorkflowPhase.DESIGN },
      { id: 't2', title: 'Intégration Hero Section', description: 'Développer le haut de la page d\'accueil avec les animations.', completed: false, priority: 'Medium', phase: WorkflowPhase.DESIGN, dueDate: '2023-11-20' },
    ],
    invoices: [
      { id: 'inv1', number: 'F2023-042', date: '2023-10-01', amount: 4500, status: 'Paid', type: 'Invoice', items: [{ id: 'i1', desc: 'Acompte 50%', quantity: 1, price: 4500 }] },
      { id: 'inv2', number: 'D2023-089', date: '2023-10-15', amount: 9000, status: 'Draft', type: 'Estimate', items: [{ id: 'i2', desc: 'Refonte Site Web', quantity: 1, price: 9000 }] }
    ]
  },
  {
    id: 'p2',
    clientName: 'Agape Global',
    avatarInitials: 'AG',
    status: ProjectStatus.ACTIVE,
    phase: WorkflowPhase.DEV,
    progress: 70,
    createdAt: '2023-09-10',
    profile: {
      email: 'hello@agape.com',
      phone: '+33 6 12 34 56 78',
      website: 'dev.agape.com',
      customFields: []
    },
    tasks: [
      { id: 't3', title: 'Setup API Shopify', description: 'Connecter le store front à l\'API Shopify.', completed: true, priority: 'High', phase: WorkflowPhase.DEV },
      { id: 't4', title: 'Debug Safari Mobile', description: 'Fixer le bug de scroll horizontal sur iPhone.', completed: false, priority: 'High', phase: WorkflowPhase.QA, dueDate: '2023-11-18' },
    ],
    invoices: []
  },
  {
    id: 'p3',
    clientName: 'Bistro du Lac',
    avatarInitials: 'BL',
    status: ProjectStatus.PROSPECT,
    phase: WorkflowPhase.DISCOVERY,
    progress: 10,
    createdAt: '2023-11-05',
    profile: {
      email: 'chef@bistrodulac.fr',
      phone: '04 50 00 00 00',
      website: '',
      customFields: []
    },
    tasks: [
      { id: 't5', title: 'Envoyer devis', description: 'Préparer et envoyer l\'estimation budgétaire.', completed: false, priority: 'High', phase: WorkflowPhase.DISCOVERY },
    ],
    invoices: []
  },
  {
    id: 'p4',
    clientName: 'Studio K',
    avatarInitials: 'SK',
    status: ProjectStatus.ARCHIVED,
    phase: WorkflowPhase.MAINTENANCE,
    progress: 100,
    createdAt: '2023-01-20',
    profile: {
      email: 'karim@studiok.com',
      phone: '',
      website: 'studiok.com',
      customFields: []
    },
    tasks: [],
    invoices: [
       { id: 'inv3', number: 'F2023-010', date: '2023-02-01', amount: 3200, status: 'Paid', type: 'Invoice', items: [] }
    ]
  }
];

export const MOCK_EVENTS: CalendarEvent[] = [];

export const FINDER_ROOT: FinderItem[] = [
  {
    id: 'root_admin',
    name: '00. Admin',
    type: 'folder',
    children: [
        { id: 'adm1', name: 'Factures', type: 'folder', children: [] },
        { id: 'adm2', name: 'Contrats', type: 'folder', children: [] }
    ]
  },
  {
    id: 'root_clients',
    name: '02. Clients Actifs',
    type: 'folder',
    children: [
      {
        id: 'c1', 
        name: 'Impharm AG', 
        type: 'folder',
        children: [
            { 
                id: 'c1_0', 
                name: '0. Admin', 
                type: 'folder', 
                children: [
                    { id: 'c1_0_1', name: '0. Offre Impharm.pdf', type: 'file' },
                    { id: 'c1_0_2', name: '1. Contrat Impharm.pdf', type: 'file' },
                    { id: 'c1_0_3', name: '2. Factures', type: 'folder', children: [] }
                ]
            },
            { id: 'c1_1', name: '1. Charte graphique', type: 'folder', children: [] },
            { id: 'c1_2', name: '2. Logo', type: 'folder', children: [] },
            { 
                id: 'c1_3', 
                name: '3. Site internet', 
                type: 'folder', 
                children: [
                    { id: 'c1_3_1', name: 'Textes', type: 'folder', children: [] },
                    { id: 'c1_3_2', name: 'Visuels', type: 'folder', children: [] }
                ]
            }
        ]
      },
      {
        id: 'c2', 
        name: 'Maison Fleur', 
        type: 'folder',
        children: [
             { 
                id: 'c2_0', 
                name: '0. Admin', 
                type: 'folder', 
                children: [
                    { id: 'c2_0_3', name: '2. Factures', type: 'folder', children: [] }
                ]
            },
            { id: 'c2_1', name: '1. Charte graphique', type: 'folder', children: [] },
            { id: 'c2_2', name: '2. Logo', type: 'folder', children: [] },
            { 
                id: 'c2_3', 
                name: '3. Site internet', 
                type: 'folder', 
                children: [
                    { id: 'c2_3_1', name: 'Textes', type: 'folder', children: [] },
                    { id: 'c2_3_2', name: 'Visuels', type: 'folder', children: [] }
                ]
            }
        ]
      }
    ]
  },
  {
      id: 'root_archives',
      name: '4. Archivés',
      type: 'folder',
      children: [
        { id: 'arch0', name: '0. Associations', type: 'folder', children: [] },
        { id: 'arch1', name: '1. Corporate', type: 'folder', children: [] },
        { id: 'arch2', name: '2. Avocats', type: 'folder', children: [] },
        { id: 'arch3', name: '3. Médical', type: 'folder', children: [] },
        { id: 'arch4', name: '4. Immobilier', type: 'folder', children: [] },
        { id: 'arch5', name: '5. Mariages', type: 'folder', children: [] },
        { id: 'arch6', name: '6. Autre', type: 'folder', children: [] },
        { id: 'arch_audits', name: 'Audits', type: 'folder', children: [] }
      ]
  }
];

export const WORKFLOW_STEPS = Object.values(WorkflowPhase);

export const SYSTEM_INSTRUCTION = `You are Franck, an ultra-efficient, professional, yet charming AI assistant for Marion, a freelance web designer. 
Your tone is helpful, concise, and slightly witty. You care deeply about organization and clean code.
You know Marion's schedule and clients. 
You act as her business partner.
Strictly output in French.`;
