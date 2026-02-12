import React, { useState, useEffect } from 'react';
import { DocumentTemplate, EmailTemplate, EmailSignature } from '../types';
import {
    FileText,
    Mail,
    Plus,
    Edit2,
    Trash2,
    Copy,
    X,
    Search,
    FileSignature,
    File,
    Briefcase,
    Send,
    Tag,
    Clock,
    Check,
    ChevronDown,
    Sparkles,
    Download,
    Eye
} from 'lucide-react';

interface DocumentTemplatesProps {
    onClose: () => void;
    onUseTemplate?: (content: string, type: string) => void;
}

export const DocumentTemplates: React.FC<DocumentTemplatesProps> = ({ onClose, onUseTemplate }) => {
    const [activeTab, setActiveTab] = useState<'documents' | 'emails' | 'signatures'>('documents');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Document Templates
    const [docTemplates, setDocTemplates] = useState<DocumentTemplate[]>([]);
    const [showDocEditor, setShowDocEditor] = useState(false);
    const [editingDoc, setEditingDoc] = useState<DocumentTemplate | null>(null);

    // Email Templates
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [showEmailEditor, setShowEmailEditor] = useState(false);
    const [editingEmail, setEditingEmail] = useState<EmailTemplate | null>(null);

    // Email Signatures
    const [signatures, setSignatures] = useState<EmailSignature[]>([]);
    const [showSignatureEditor, setShowSignatureEditor] = useState(false);
    const [editingSignature, setEditingSignature] = useState<EmailSignature | null>(null);

    // Load templates from localStorage
    useEffect(() => {
        const savedDocs = localStorage.getItem('marion_doc_templates');
        const savedEmails = localStorage.getItem('marion_email_templates');
        const savedSignatures = localStorage.getItem('marion_email_signatures');

        if (savedDocs) setDocTemplates(JSON.parse(savedDocs));
        else setDocTemplates(getDefaultDocTemplates());

        if (savedEmails) setEmailTemplates(JSON.parse(savedEmails));
        else setEmailTemplates(getDefaultEmailTemplates());

        if (savedSignatures) setSignatures(JSON.parse(savedSignatures));
        else setSignatures(getDefaultSignatures());
    }, []);

    // Save templates
    useEffect(() => {
        if (docTemplates.length) localStorage.setItem('marion_doc_templates', JSON.stringify(docTemplates));
        if (emailTemplates.length) localStorage.setItem('marion_email_templates', JSON.stringify(emailTemplates));
        if (signatures.length) localStorage.setItem('marion_email_signatures', JSON.stringify(signatures));
    }, [docTemplates, emailTemplates, signatures]);

    // Default templates
    function getDefaultDocTemplates(): DocumentTemplate[] {
        return [
            {
                id: 'doc-1',
                name: 'Devis standard',
                type: 'devis',
                category: 'Commercial',
                content: `DEVIS N°{{numero}}

Date: {{date}}
Valide jusqu'au: {{date_validite}}

CLIENT
{{client_nom}}
{{client_adresse}}
{{client_email}}

PRESTATIONS
{{description_prestations}}

MONTANT TOTAL: {{montant}} CHF

Conditions de paiement: 30 jours net
TVA non applicable - Article 293 B du CGI

Signature client: ___________________
Date: ___________________`,
                variables: ['numero', 'date', 'date_validite', 'client_nom', 'client_adresse', 'client_email', 'description_prestations', 'montant'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                usageCount: 0
            },
            {
                id: 'doc-2',
                name: 'Contrat de prestation',
                type: 'contrat',
                category: 'Juridique',
                content: `CONTRAT DE PRESTATION DE SERVICES

Entre les soussignés:

LE PRESTATAIRE
{{prestataire_nom}}
{{prestataire_adresse}}
SIRET: {{prestataire_siret}}

Et

LE CLIENT
{{client_nom}}
{{client_adresse}}

ARTICLE 1 - OBJET
Le présent contrat a pour objet la réalisation des prestations suivantes:
{{description_prestations}}

ARTICLE 2 - DURÉE
Le présent contrat est conclu pour une durée de {{duree}}.
Date de début: {{date_debut}}
Date de fin prévue: {{date_fin}}

ARTICLE 3 - RÉMUNÉRATION
En contrepartie des prestations effectuées, le Client versera au Prestataire:
Montant: {{montant}} CHF
Modalités de paiement: {{modalites_paiement}}

ARTICLE 4 - CONFIDENTIALITÉ
Les parties s'engagent à maintenir la confidentialité de toutes informations échangées.

Fait à {{lieu}}, le {{date_signature}}
En deux exemplaires originaux

Le Prestataire                    Le Client
___________________              ___________________`,
                variables: ['prestataire_nom', 'prestataire_adresse', 'prestataire_siret', 'client_nom', 'client_adresse', 'description_prestations', 'duree', 'date_debut', 'date_fin', 'montant', 'modalites_paiement', 'lieu', 'date_signature'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                usageCount: 0
            },
            {
                id: 'doc-3',
                name: 'Contrat de maintenance',
                type: 'contrat',
                category: 'Maintenance',
                content: `CONTRAT DE MAINTENANCE ANNUEL

Entre:
{{prestataire_nom}}
Et:
{{client_nom}}

ARTICLE 1 - PRESTATIONS INCLUSES
- Maintenance corrective
- Mises à jour de sécurité
- Support technique ({{heures_support}} heures/mois)
- Sauvegardes régulières

ARTICLE 2 - TARIFICATION
Forfait annuel: {{montant_annuel}} CHF
Facturation: {{frequence_facturation}}

ARTICLE 3 - DURÉE ET RENOUVELLEMENT
Durée: 12 mois à compter du {{date_debut}}
Reconduction tacite sauf dénonciation 30 jours avant échéance.

Date et signature: ___________________`,
                variables: ['prestataire_nom', 'client_nom', 'heures_support', 'montant_annuel', 'frequence_facturation', 'date_debut'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                usageCount: 0
            }
        ];
    }

    function getDefaultEmailTemplates(): EmailTemplate[] {
        return [
            {
                id: 'email-1',
                name: 'Relance facture impayée',
                subject: 'Rappel: Facture {{numero_facture}} en attente',
                body: `Bonjour {{prenom}},

J'espère que vous allez bien.

Je me permets de vous relancer concernant la facture n°{{numero_facture}} d'un montant de {{montant}} CHF, émise le {{date_facture}} et arrivée à échéance le {{date_echeance}}.

À ce jour, je n'ai pas encore reçu le règlement correspondant. Serait-il possible de procéder au paiement dans les meilleurs délais ?

Si le paiement a déjà été effectué, je vous prie de ne pas tenir compte de ce message.

Je reste à votre disposition pour toute question.

Cordialement,`,
                category: 'relance',
                variables: ['prenom', 'numero_facture', 'montant', 'date_facture', 'date_echeance'],
                createdAt: new Date().toISOString(),
                usageCount: 0
            },
            {
                id: 'email-2',
                name: 'Envoi de devis',
                subject: 'Devis pour {{projet}}',
                body: `Bonjour {{prenom}},

Suite à notre échange, veuillez trouver ci-joint le devis pour {{projet}}.

Résumé:
- Prestations: {{prestations}}
- Montant total: {{montant}} CHF
- Validité: 30 jours

Je reste disponible pour en discuter et répondre à vos questions.

Cordialement,`,
                category: 'devis',
                variables: ['prenom', 'projet', 'prestations', 'montant'],
                createdAt: new Date().toISOString(),
                usageCount: 0
            },
            {
                id: 'email-3',
                name: 'Remerciement projet terminé',
                subject: 'Merci pour votre confiance ! 🙏',
                body: `Bonjour {{prenom}},

Je tenais à vous remercier sincèrement pour votre confiance tout au long du projet {{projet}}.

Ce fut un réel plaisir de collaborer avec vous. J'espère que le résultat répond à vos attentes !

N'hésitez pas à me contacter si vous avez des questions ou pour de futurs projets.

À très bientôt,`,
                category: 'remerciement',
                variables: ['prenom', 'projet'],
                createdAt: new Date().toISOString(),
                usageCount: 0
            },
            {
                id: 'email-4',
                name: 'Suivi de projet',
                subject: 'Point sur {{projet}}',
                body: `Bonjour {{prenom}},

Je vous fais un petit point sur l'avancement de {{projet}}.

État actuel: {{etat_actuel}}

Prochaines étapes:
{{prochaines_etapes}}

Date de livraison prévue: {{date_livraison}}

N'hésitez pas à me faire part de vos retours.

Cordialement,`,
                category: 'suivi',
                variables: ['prenom', 'projet', 'etat_actuel', 'prochaines_etapes', 'date_livraison'],
                createdAt: new Date().toISOString(),
                usageCount: 0
            }
        ];
    }

    function getDefaultSignatures(): EmailSignature[] {
        return [
            {
                id: 'sig-1',
                name: 'Signature principale',
                content: `Marion
Freelance Designer & Developer

📧 contact@example.com
📱 +41 XX XXX XX XX
🌐 www.example.com`,
                isDefault: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'sig-2',
                name: 'Signature courte',
                content: `Marion
contact@example.com | +41 XX XXX XX XX`,
                isDefault: false,
                createdAt: new Date().toISOString()
            }
        ];
    }

    // Handlers
    const handleSaveDocTemplate = (template: DocumentTemplate) => {
        if (editingDoc) {
            setDocTemplates(docTemplates.map(t => t.id === template.id ? { ...template, updatedAt: new Date().toISOString() } : t));
        } else {
            setDocTemplates([...docTemplates, { ...template, id: `doc-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0 }]);
        }
        setShowDocEditor(false);
        setEditingDoc(null);
    };

    const handleSaveEmailTemplate = (template: EmailTemplate) => {
        if (editingEmail) {
            setEmailTemplates(emailTemplates.map(t => t.id === template.id ? template : t));
        } else {
            setEmailTemplates([...emailTemplates, { ...template, id: `email-${Date.now()}`, createdAt: new Date().toISOString(), usageCount: 0 }]);
        }
        setShowEmailEditor(false);
        setEditingEmail(null);
    };

    const handleSaveSignature = (signature: EmailSignature) => {
        if (signature.isDefault) {
            setSignatures(signatures.map(s => ({ ...s, isDefault: s.id === signature.id })));
        }
        if (editingSignature) {
            setSignatures(signatures.map(s => s.id === signature.id ? signature : s));
        } else {
            setSignatures([...signatures, { ...signature, id: `sig-${Date.now()}`, createdAt: new Date().toISOString() }]);
        }
        setShowSignatureEditor(false);
        setEditingSignature(null);
    };

    const handleDeleteDoc = (id: string) => setDocTemplates(docTemplates.filter(t => t.id !== id));
    const handleDeleteEmail = (id: string) => setEmailTemplates(emailTemplates.filter(t => t.id !== id));
    const handleDeleteSignature = (id: string) => setSignatures(signatures.filter(s => s.id !== id));

    const handleCopyTemplate = (content: string) => {
        navigator.clipboard.writeText(content);
    };

    const filteredDocs = docTemplates.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredEmails = emailTemplates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'devis': return <FileText className="w-4 h-4 text-blue-500" />;
            case 'contrat': return <Briefcase className="w-4 h-4 text-purple-500" />;
            case 'email': return <Mail className="w-4 h-4 text-green-500" />;
            default: return <File className="w-4 h-4 text-gray-500" />;
        }
    };

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            'relance': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            'devis': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            'remerciement': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            'suivi': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            'autre': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
        };
        return colors[category] || colors.autre;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                Templates & Modèles
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                Gérez vos documents types et signatures
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
                    {[
                        { id: 'documents', label: 'Documents', icon: FileText, count: docTemplates.length },
                        { id: 'emails', label: 'Modèles d\'emails', icon: Mail, count: emailTemplates.length },
                        { id: 'signatures', label: 'Signatures', icon: FileSignature, count: signatures.length }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                                activeTab === tab.id 
                                    ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800">
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
                    {/* Search and Add */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Rechercher un template..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            />
                        </div>
                        <button
                            onClick={() => {
                                if (activeTab === 'documents') { setEditingDoc(null); setShowDocEditor(true); }
                                else if (activeTab === 'emails') { setEditingEmail(null); setShowEmailEditor(true); }
                                else { setEditingSignature(null); setShowSignatureEditor(true); }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                        >
                            <Plus className="w-4 h-4" />
                            Nouveau
                        </button>
                    </div>

                    {/* Documents Tab */}
                    {activeTab === 'documents' && (
                        <div className="space-y-4">
                            {filteredDocs.length === 0 ? (
                                <div className="text-center py-12">
                                    <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                        Aucun template de document
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredDocs.map(doc => (
                                        <div 
                                            key={doc.id}
                                            className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                                                        {getTypeIcon(doc.type)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                                            {doc.name}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                                                                {doc.type}
                                                            </span>
                                                            {doc.category && (
                                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                    {doc.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                {doc.content.substring(0, 100)}...
                                            </p>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    <Tag className="w-3 h-3" />
                                                    {doc.variables.length} variables
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleCopyTemplate(doc.content)}
                                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                        title="Copier"
                                                    >
                                                        <Copy className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingDoc(doc); setShowDocEditor(true); }}
                                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                        title="Modifier"
                                                    >
                                                        <Edit2 className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteDoc(doc.id)}
                                                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Emails Tab */}
                    {activeTab === 'emails' && (
                        <div className="space-y-4">
                            {filteredEmails.length === 0 ? (
                                <div className="text-center py-12">
                                    <Mail className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                        Aucun modèle d'email
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredEmails.map(email => (
                                        <div 
                                            key={email.id}
                                            className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h4 className="font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                                            {email.name}
                                                        </h4>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(email.category)}`}>
                                                            {email.category}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                        Sujet: {email.subject}
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                        {email.body.substring(0, 150)}...
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 ml-4">
                                                    <button
                                                        onClick={() => handleCopyTemplate(`Sujet: ${email.subject}\n\n${email.body}`)}
                                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                        title="Copier"
                                                    >
                                                        <Copy className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingEmail(email); setShowEmailEditor(true); }}
                                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                        title="Modifier"
                                                    >
                                                        <Edit2 className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteEmail(email.id)}
                                                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Signatures Tab */}
                    {activeTab === 'signatures' && (
                        <div className="space-y-4">
                            {signatures.length === 0 ? (
                                <div className="text-center py-12">
                                    <FileSignature className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                        Aucune signature email
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {signatures.map(sig => (
                                        <div 
                                            key={sig.id}
                                            className={`bg-gray-50 dark:bg-gray-800 rounded-xl p-4 transition-all ${sig.isDefault ? 'ring-2 ring-amber-500' : ''}`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                                        {sig.name}
                                                    </h4>
                                                    {sig.isDefault && (
                                                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                                                            Par défaut
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleCopyTemplate(sig.content)}
                                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                        title="Copier"
                                                    >
                                                        <Copy className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingSignature(sig); setShowSignatureEditor(true); }}
                                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                        title="Modifier"
                                                    >
                                                        <Edit2 className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSignature(sig.id)}
                                                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </button>
                                                </div>
                                            </div>
                                            <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans bg-white dark:bg-gray-900 rounded-lg p-3" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                {sig.content}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Document Editor Modal */}
            {showDocEditor && (
                <DocumentEditorModal
                    template={editingDoc}
                    onSave={handleSaveDocTemplate}
                    onClose={() => { setShowDocEditor(false); setEditingDoc(null); }}
                />
            )}

            {/* Email Editor Modal */}
            {showEmailEditor && (
                <EmailEditorModal
                    template={editingEmail}
                    onSave={handleSaveEmailTemplate}
                    onClose={() => { setShowEmailEditor(false); setEditingEmail(null); }}
                />
            )}

            {/* Signature Editor Modal */}
            {showSignatureEditor && (
                <SignatureEditorModal
                    signature={editingSignature}
                    onSave={handleSaveSignature}
                    onClose={() => { setShowSignatureEditor(false); setEditingSignature(null); }}
                />
            )}
        </div>
    );
};

// Editor Modals
const DocumentEditorModal: React.FC<{ template: DocumentTemplate | null; onSave: (t: DocumentTemplate) => void; onClose: () => void }> = ({ template, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: template?.name || '',
        type: template?.type || 'devis' as DocumentTemplate['type'],
        category: template?.category || '',
        content: template?.content || '',
        variables: template?.variables || []
    });

    const detectVariables = (content: string): string[] => {
        const matches = content.match(/\{\{(\w+)\}\}/g) || [];
        return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
    };

    useEffect(() => {
        setForm(f => ({ ...f, variables: detectVariables(f.content) }));
    }, [form.content]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...template,
            ...form,
            id: template?.id || '',
            createdAt: template?.createdAt || '',
            updatedAt: '',
            usageCount: template?.usageCount || 0
        } as DocumentTemplate);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {template ? 'Modifier le template' : 'Nouveau template'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(80vh-130px)]">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>Nom</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>Type</label>
                            <select
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                            >
                                <option value="devis">Devis</option>
                                <option value="contrat">Contrat</option>
                                <option value="email">Email</option>
                                <option value="autre">Autre</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>Catégorie</label>
                        <input
                            type="text"
                            value={form.category}
                            onChange={e => setForm({ ...form, category: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                            placeholder="Ex: Commercial, Juridique..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>
                            Contenu <span className="text-xs text-gray-400">(utilisez {"{{variable}}"} pour les champs dynamiques)</span>
                        </label>
                        <textarea
                            value={form.content}
                            onChange={e => setForm({ ...form, content: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 tabular-nums text-sm"
                            rows={12}
                            required
                        />
                    </div>

                    {form.variables.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" style={{ fontFamily: 'Raleway, sans-serif' }}>Variables détectées</label>
                            <div className="flex flex-wrap gap-2">
                                {form.variables.map(v => (
                                    <span key={v} className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs">
                                        {`{{${v}}}`}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Annuler</button>
                        <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg">Enregistrer</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EmailEditorModal: React.FC<{ template: EmailTemplate | null; onSave: (t: EmailTemplate) => void; onClose: () => void }> = ({ template, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: template?.name || '',
        subject: template?.subject || '',
        body: template?.body || '',
        category: template?.category || 'autre' as EmailTemplate['category'],
        variables: template?.variables || []
    });

    const detectVariables = (text: string): string[] => {
        const matches = text.match(/\{\{(\w+)\}\}/g) || [];
        return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
    };

    useEffect(() => {
        const allVars = detectVariables(form.subject + ' ' + form.body);
        setForm(f => ({ ...f, variables: allVars }));
    }, [form.subject, form.body]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...template,
            ...form,
            id: template?.id || '',
            createdAt: template?.createdAt || '',
            usageCount: template?.usageCount || 0
        } as EmailTemplate);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {template ? 'Modifier le modèle' : 'Nouveau modèle d\'email'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(80vh-130px)]">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>Nom du modèle</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>Catégorie</label>
                            <select
                                value={form.category}
                                onChange={e => setForm({ ...form, category: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                            >
                                <option value="relance">Relance</option>
                                <option value="devis">Devis</option>
                                <option value="remerciement">Remerciement</option>
                                <option value="suivi">Suivi</option>
                                <option value="autre">Autre</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>Sujet</label>
                        <input
                            type="text"
                            value={form.subject}
                            onChange={e => setForm({ ...form, subject: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>Corps du message</label>
                        <textarea
                            value={form.body}
                            onChange={e => setForm({ ...form, body: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                            rows={10}
                            required
                        />
                    </div>

                    {form.variables.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" style={{ fontFamily: 'Raleway, sans-serif' }}>Variables</label>
                            <div className="flex flex-wrap gap-2">
                                {form.variables.map(v => (
                                    <span key={v} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
                                        {`{{${v}}}`}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Annuler</button>
                        <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg">Enregistrer</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SignatureEditorModal: React.FC<{ signature: EmailSignature | null; onSave: (s: EmailSignature) => void; onClose: () => void }> = ({ signature, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: signature?.name || '',
        content: signature?.content || '',
        isDefault: signature?.isDefault || false
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...signature,
            ...form,
            id: signature?.id || '',
            createdAt: signature?.createdAt || ''
        } as EmailSignature);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {signature ? 'Modifier la signature' : 'Nouvelle signature'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>Nom</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                            placeholder="Ex: Signature principale"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>Contenu</label>
                        <textarea
                            value={form.content}
                            onChange={e => setForm({ ...form, content: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                            rows={6}
                            placeholder="Votre signature ici..."
                            required
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.isDefault}
                            onChange={e => setForm({ ...form, isDefault: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300" style={{ fontFamily: 'Raleway, sans-serif' }}>Définir comme signature par défaut</span>
                    </label>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Annuler</button>
                        <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg">Enregistrer</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DocumentTemplates;
