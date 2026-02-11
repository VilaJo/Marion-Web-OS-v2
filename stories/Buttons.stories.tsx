import type { Meta, StoryObj } from '@storybook/react';
import { ThemeDecorator } from '../.storybook/ThemeDecorator';
import { Plus, Send, Settings, Trash2, Download, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';

/**
 * Les boutons de Marion Web OS suivent un système cohérent :
 * - **Primary** : gradient orange→pink, text-white, rounded-full
 * - **Secondary** : bg-white, border, rounded-full
 * - **Icon** : p-2, rounded-full, icône seule
 * - **Toolbar pill** : petit, uppercase, tracking-wide
 * - **Destructive** : texte rouge, hover bg-red
 */
const meta: Meta = {
  title: 'Components/Buttons',
  decorators: [ThemeDecorator],
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Système de boutons Marion Web OS. Tous les boutons utilisent `rounded-full` (pill shape), `font-bold`, et des transitions fluides.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
  render: () => (
    <button className="px-6 py-2.5 bg-gradient-to-r from-[#FF7E5F] to-pink-500 text-white rounded-full text-sm font-bold hover:scale-105 transition-all shadow-lg shadow-orange-200 dark:shadow-none flex items-center gap-2">
      <Plus size={16} />
      Nouveau projet
    </button>
  ),
};

export const Secondary: Story = {
  render: () => (
    <button className="px-6 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 rounded-full text-sm font-bold hover:border-[#FF7E5F] hover:text-[#FF7E5F] transition-all">
      Annuler
    </button>
  ),
};

export const IconButton: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <button className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors">
        <Settings size={20} />
      </button>
      <button className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors">
        <RefreshCw size={20} />
      </button>
      <button className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors">
        <Download size={20} />
      </button>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Boutons icône utilisés dans la toolbar et les actions secondaires.' } },
  },
};

export const ToolbarPills: Story = {
  render: () => (
    <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-800/40 px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-md">
      <button className="px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md">
        Tous
      </button>
      <button className="px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-white dark:bg-slate-800/60 text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-slate-700/80 transition-all">
        Actifs
      </button>
      <button className="px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-white dark:bg-slate-800/60 text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-slate-700/80 transition-all">
        Prospects
      </button>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Filtres pill dans la toolbar du dashboard. Le filtre actif utilise un gradient.' } },
  },
};

export const Destructive: Story = {
  render: () => (
    <button className="px-6 py-2.5 rounded-full text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2">
      <Trash2 size={16} />
      Supprimer
    </button>
  ),
};

export const CTAGradient: Story = {
  render: () => (
    <button className="px-8 py-3 bg-gradient-to-r from-[#FF7E5F] to-[#d946ef] text-white rounded-full text-sm font-bold uppercase tracking-wide hover:scale-105 transition-all shadow-md flex items-center gap-2 group">
      Commencer
      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
    </button>
  ),
  parameters: {
    docs: { description: { story: 'Bouton CTA premium avec gradient orange→fuchsia, utilisé pour les actions majeures.' } },
  },
};

export const WithSparkle: Story = {
  render: () => (
    <button className="px-6 py-2.5 bg-gradient-to-r from-[#FF7E5F] to-pink-500 text-white rounded-full text-sm font-bold hover:scale-105 transition-all shadow-lg flex items-center gap-2">
      <Sparkles size={16} />
      Demander à Franck
    </button>
  ),
};

export const SendButton: Story = {
  render: () => (
    <button className="p-3 bg-gradient-to-r from-[#FF7E5F] to-pink-500 text-white rounded-full hover:scale-110 transition-all shadow-lg">
      <Send size={18} />
    </button>
  ),
  parameters: {
    docs: { description: { story: 'Bouton d\'envoi circulaire, utilisé dans le chat et l\'email.' } },
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-6 items-start">
      <div className="flex items-center gap-3 flex-wrap">
        <button className="px-6 py-2.5 bg-gradient-to-r from-[#FF7E5F] to-pink-500 text-white rounded-full text-sm font-bold shadow-lg">
          Primary
        </button>
        <button className="px-6 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 rounded-full text-sm font-bold">
          Secondary
        </button>
        <button className="px-6 py-2.5 rounded-full text-sm font-bold text-red-500 hover:bg-red-50">
          Destructive
        </button>
        <button className="px-6 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-full text-sm font-bold shadow-lg">
          Dark CTA
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-full text-slate-500 hover:bg-slate-100/80 transition-colors"><Settings size={20} /></button>
        <button className="p-2 rounded-full text-slate-500 hover:bg-slate-100/80 transition-colors"><RefreshCw size={20} /></button>
        <button className="p-3 bg-gradient-to-r from-[#FF7E5F] to-pink-500 text-white rounded-full shadow-lg"><Send size={18} /></button>
      </div>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Toutes les variantes de boutons côte à côte pour comparaison.' } },
  },
};
