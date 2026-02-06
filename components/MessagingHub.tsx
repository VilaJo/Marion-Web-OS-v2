import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Message, Project } from '../types';
import {
    MessageCircle,
    Phone,
    Search,
    Send,
    X,
    User,
    Clock,
    Check,
    CheckCheck,
    Plus,
    Settings,
    Archive,
    Star,
    Filter,
    MoreVertical,
    Smile,
    Paperclip,
    Image as ImageIcon,
    Mic,
    ExternalLink,
    AlertCircle,
    RefreshCw
} from 'lucide-react';

// WhatsApp/SMS icons
const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
);

const SMSIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
);

interface MessagingHubProps {
    projects: Project[];
    onClose: () => void;
}

export const MessagingHub: React.FC<MessagingHubProps> = ({ projects, onClose }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [filter, setFilter] = useState<'all' | 'whatsapp' | 'sms'>('all');
    const [showNewConversation, setShowNewConversation] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [showSetup, setShowSetup] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load conversations from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('marion_conversations');
        if (saved) {
            const parsed = JSON.parse(saved);
            setConversations(parsed);
            if (parsed.length > 0) setShowSetup(false);
        }
        
        // Check if already set up
        const setup = localStorage.getItem('marion_messaging_setup');
        if (setup) setShowSetup(false);
    }, []);

    // Save conversations
    useEffect(() => {
        if (conversations.length > 0) {
            localStorage.setItem('marion_conversations', JSON.stringify(conversations));
        }
    }, [conversations]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedConversation?.messages]);

    const handleSendMessage = () => {
        if (!newMessage.trim() || !selectedConversation) return;

        const message: Message = {
            id: `msg-${Date.now()}`,
            direction: 'outgoing',
            content: newMessage,
            timestamp: new Date().toISOString(),
            status: 'sent',
            platform: selectedConversation.platform
        };

        const updatedConversation = {
            ...selectedConversation,
            messages: [...selectedConversation.messages, message],
            lastMessage: message,
            updatedAt: new Date().toISOString()
        };

        setConversations(conversations.map(c => 
            c.id === selectedConversation.id ? updatedConversation : c
        ));
        setSelectedConversation(updatedConversation);
        setNewMessage('');

        // Simulate message delivery after 1s
        setTimeout(() => {
            setConversations(prev => prev.map(c => {
                if (c.id === selectedConversation.id) {
                    const msgs = c.messages.map(m => 
                        m.id === message.id ? { ...m, status: 'delivered' as const } : m
                    );
                    return { ...c, messages: msgs };
                }
                return c;
            }));
        }, 1000);
    };

    const handleSetupComplete = () => {
        localStorage.setItem('marion_messaging_setup', 'true');
        setShowSetup(false);
        setIsConnected(true);

        // Add demo conversations from projects
        const demoConversations: Conversation[] = projects
            .filter(p => p.profile?.phone)
            .slice(0, 5)
            .map(p => ({
                id: `conv-${p.id}`,
                contactName: p.clientName,
                contactPhone: p.profile.phone || '',
                projectId: p.id,
                platform: Math.random() > 0.5 ? 'whatsapp' as const : 'sms' as const,
                messages: [
                    {
                        id: `msg-demo-1-${p.id}`,
                        direction: 'incoming' as const,
                        content: `Bonjour, j'ai une question concernant le projet.`,
                        timestamp: new Date(Date.now() - 86400000).toISOString(),
                        status: 'read' as const,
                        platform: 'whatsapp' as const
                    },
                    {
                        id: `msg-demo-2-${p.id}`,
                        direction: 'outgoing' as const,
                        content: `Bonjour ! Bien sûr, je vous écoute.`,
                        timestamp: new Date(Date.now() - 82800000).toISOString(),
                        status: 'read' as const,
                        platform: 'whatsapp' as const
                    }
                ],
                unreadCount: 0,
                updatedAt: new Date(Date.now() - 82800000).toISOString()
            }));

        setConversations(demoConversations);
    };

    const handleCreateConversation = (project: Project) => {
        if (!project.profile?.phone) return;

        const newConv: Conversation = {
            id: `conv-${Date.now()}`,
            contactName: project.clientName,
            contactPhone: project.profile.phone,
            projectId: project.id,
            platform: 'whatsapp',
            messages: [],
            unreadCount: 0,
            updatedAt: new Date().toISOString()
        };

        setConversations([newConv, ...conversations]);
        setSelectedConversation(newConv);
        setShowNewConversation(false);
    };

    const filteredConversations = conversations.filter(c => {
        if (filter !== 'all' && c.platform !== filter) return false;
        if (searchQuery) {
            return c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   c.contactPhone.includes(searchQuery);
        }
        return true;
    });

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Hier';
        } else if (diffDays < 7) {
            return date.toLocaleDateString('fr-CH', { weekday: 'short' });
        }
        return date.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' });
    };

    const getStatusIcon = (status: Message['status']) => {
        switch (status) {
            case 'sent': return <Check className="w-3 h-3 text-gray-400" />;
            case 'delivered': return <CheckCheck className="w-3 h-3 text-gray-400" />;
            case 'read': return <CheckCheck className="w-3 h-3 text-blue-500" />;
            case 'failed': return <AlertCircle className="w-3 h-3 text-red-500" />;
        }
    };

    // Setup Screen
    if (showSetup) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
                                <MessageCircle className="w-6 h-6 text-white" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                Messagerie
                            </h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-6 text-center">
                        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-full flex items-center justify-center">
                            <WhatsAppIcon />
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            Connectez WhatsApp & SMS
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6" style={{ fontFamily: 'Raleway, sans-serif' }}>
                            Centralisez vos conversations clients dans Marion. 
                            Gardez un historique de tous vos échanges liés à vos projets.
                        </p>

                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6 text-left">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-800 dark:text-amber-300" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                    <p className="font-medium mb-1">Note:</p>
                                    <p>Cette fonctionnalité permet de gérer manuellement l'historique de vos conversations. 
                                    L'intégration automatique avec WhatsApp Business API peut être ajoutée ultérieurement.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={handleSetupComplete}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            >
                                <WhatsAppIcon />
                                Commencer à utiliser
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            >
                                Plus tard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-5xl h-[85vh] overflow-hidden shadow-2xl flex">
                {/* Sidebar - Conversations List */}
                <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                    <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                    Messages
                                </h2>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setShowNewConversation(true)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    title="Nouvelle conversation"
                                >
                                    <Plus className="w-5 h-5 text-gray-500" />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Rechercher..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-0 rounded-lg text-sm"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            />
                        </div>

                        {/* Filter */}
                        <div className="flex gap-1">
                            {(['all', 'whatsapp', 'sms'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                        filter === f 
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {f === 'all' ? 'Tous' : f === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Conversations */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredConversations.length === 0 ? (
                            <div className="p-6 text-center">
                                <MessageCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                                <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                    Aucune conversation
                                </p>
                            </div>
                        ) : (
                            filteredConversations.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedConversation(conv)}
                                    className={`w-full p-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                                        selectedConversation?.id === conv.id ? 'bg-green-50 dark:bg-green-900/20' : ''
                                    }`}
                                >
                                    <div className="relative">
                                        <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center">
                                            <User className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                                        </div>
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center ${
                                            conv.platform === 'whatsapp' ? 'bg-green-500' : 'bg-blue-500'
                                        }`}>
                                            {conv.platform === 'whatsapp' ? (
                                                <WhatsAppIcon />
                                            ) : (
                                                <SMSIcon />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-gray-900 dark:text-white text-sm truncate" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                                {conv.contactName}
                                            </span>
                                            <span className="text-xs text-gray-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                {conv.lastMessage && formatTime(conv.lastMessage.timestamp)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                            {conv.lastMessage?.content || 'Aucun message'}
                                        </p>
                                    </div>
                                    {conv.unreadCount > 0 && (
                                        <span className="w-5 h-5 bg-green-500 text-white text-xs rounded-full flex items-center justify-center">
                                            {conv.unreadCount}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Chat Area */}
                {selectedConversation ? (
                    <div className="flex-1 flex flex-col">
                        {/* Chat Header */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center">
                                        <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                        {selectedConversation.contactName}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                        <Phone className="w-3 h-3" />
                                        {selectedConversation.contactPhone}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedConversation.projectId && (
                                    <button className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                        Voir le projet
                                    </button>
                                )}
                                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                                    <MoreVertical className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-800/50">
                            {selectedConversation.messages.length === 0 ? (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <MessageCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                                        <p className="text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                            Commencez la conversation
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                selectedConversation.messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                                                msg.direction === 'outgoing'
                                                    ? 'bg-green-500 text-white rounded-br-md'
                                                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md shadow-sm'
                                            }`}
                                        >
                                            <p className="text-sm" style={{ fontFamily: 'Raleway, sans-serif' }}>{msg.content}</p>
                                            <div className={`flex items-center justify-end gap-1 mt-1 ${
                                                msg.direction === 'outgoing' ? 'text-green-100' : 'text-gray-400'
                                            }`}>
                                                <span className="text-xs">{formatTime(msg.timestamp)}</span>
                                                {msg.direction === 'outgoing' && getStatusIcon(msg.status)}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                            <div className="flex items-center gap-2">
                                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                                    <Smile className="w-5 h-5 text-gray-500" />
                                </button>
                                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                                    <Paperclip className="w-5 h-5 text-gray-500" />
                                </button>
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Écrivez un message..."
                                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-0 rounded-full text-sm"
                                    style={{ fontFamily: 'Raleway, sans-serif' }}
                                />
                                {newMessage ? (
                                    <button
                                        onClick={handleSendMessage}
                                        className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                                        <Mic className="w-5 h-5 text-gray-500" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-4 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                <MessageCircle className="w-10 h-10 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                Sélectionnez une conversation
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                Choisissez une conversation ou créez-en une nouvelle
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* New Conversation Modal */}
            {showNewConversation && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                Nouvelle conversation
                            </h3>
                            <button onClick={() => setShowNewConversation(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-4 max-h-96 overflow-y-auto">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                Sélectionnez un client pour démarrer une conversation:
                            </p>
                            <div className="space-y-2">
                                {projects.filter(p => p.profile?.phone).map(project => (
                                    <button
                                        key={project.id}
                                        onClick={() => handleCreateConversation(project)}
                                        className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                                    >
                                        <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center">
                                            <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                                {project.clientName}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                {project.profile.phone}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                                {projects.filter(p => p.profile?.phone).length === 0 && (
                                    <p className="text-center text-gray-400 py-4" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                        Aucun client avec numéro de téléphone
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessagingHub;
