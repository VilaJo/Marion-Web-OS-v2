import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ThemeDecorator } from '../.storybook/ThemeDecorator';
import { Badge } from '../components/Shared';
import {
  Menu, Bell, Settings, LayoutGrid, Mail, FileText, Target,
  StickyNote, Palette, Sparkles, Sun, Moon, Coffee, X,
  Search, Plus, RefreshCw
} from 'lucide-react';

const meta: Meta = {
  title: 'Layout',
  decorators: [ThemeDecorator],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const DesktopToolbar: Story = {
  render: () => (
    <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-800/40 px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-md">
      {/* Briefing button */}
      <button className="px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-gradient-to-r from-[#FF7E5F] to-pink-500 text-white flex items-center gap-1.5">
        <Sparkles size={14} />
        Briefing
      </button>
      {/* Divider */}
      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
      {/* Tool buttons */}
      {[LayoutGrid, Mail, FileText, Target, StickyNote, Palette, Coffee].map((Icon, i) => (
        <button key={i} className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors">
          <Icon size={18} />
        </button>
      ))}
      {/* Divider */}
      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
      {/* Settings */}
      <button className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors">
        <Settings size={18} />
      </button>
      {/* Notification */}
      <button className="p-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-colors relative">
        <Bell size={18} />
        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
      </button>
      {/* Franck status */}
      <span className="ml-2 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Franck
      </span>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Barre d\'outils desktop flottante avec glassmorphisme. Contient le briefing IA, les raccourcis outils, les notifications et le statut de Franck.',
      },
    },
  },
};

export const MobileHeader: Story = {
  render: () => (
    <div className="w-[375px] flex justify-between items-center px-3 py-2 bg-white/70 dark:bg-slate-900/40 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-700/30">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF7E5F] to-pink-500 flex items-center justify-center text-white font-bold text-sm">M</div>
        <span className="font-sans text-base font-semibold text-slate-800 dark:text-white">Marion</span>
      </div>
      <div className="flex items-center gap-1">
        <button className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100 transition-colors relative">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <button className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Menu size={22} className="text-slate-700 dark:text-white" />
        </button>
      </div>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Header mobile compact avec logo, notifications et hamburger menu.' } },
  },
};

export const MobileDrawer: Story = {
  render: () => (
    <div className="w-72 bg-white dark:bg-slate-900 shadow-2xl flex flex-col rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <span className="font-semibold text-slate-800 dark:text-white text-lg">Menu</span>
        <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <X size={20} className="text-slate-500" />
        </button>
      </div>
      {/* Items */}
      <div className="flex-1 py-2">
        {[
          { icon: LayoutGrid, label: 'Dashboard', color: 'text-[#FF7E5F]' },
          { icon: Mail, label: 'Emails', color: 'text-blue-500' },
          { icon: FileText, label: 'Documents', color: 'text-emerald-500' },
          { icon: Target, label: 'Objectifs', color: 'text-purple-500' },
          { icon: Palette, label: 'Atelier Médias', color: 'text-pink-500' },
          { icon: Coffee, label: 'Mode Focus', color: 'text-amber-500' },
          { icon: Settings, label: 'Paramètres', color: 'text-slate-500' },
        ].map(({ icon: Icon, label, color }) => (
          <button key={label} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <Icon size={22} className={color} />
            <span className="text-[15px] font-medium text-slate-700 dark:text-slate-200">{label}</span>
          </button>
        ))}
      </div>
      {/* Theme toggle */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <button className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <Sun size={20} className="text-amber-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Changer de thème</span>
        </button>
      </div>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Drawer de navigation mobile avec les accès rapides aux outils et le toggle de thème.' } },
  },
};

export const SearchBar: Story = {
  render: () => (
    <div className="w-[600px] bg-white/40 dark:bg-slate-800/30 p-2 rounded-3xl backdrop-blur-sm flex items-center gap-2">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          className="pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-transparent dark:border-slate-700/50 focus:border-orange-300 w-full transition-all outline-none text-sm dark:text-slate-100 shadow-sm"
        />
      </div>
      <div className="flex gap-1">
        {['Tous', 'Actifs', 'Prospects'].map((f, i) => (
          <button
            key={f}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${
              i === 0
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                : 'bg-white dark:bg-slate-800/60 text-slate-400 hover:text-purple-500'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <button className="px-3 py-1.5 rounded-full text-white text-[10px] font-bold uppercase bg-gradient-to-r from-[#FF7E5F] to-[#d946ef] flex items-center gap-1 shadow-md">
        <Plus size={12} /> Nouveau
      </button>
      <button className="p-2 bg-white dark:bg-slate-800/60 rounded-xl text-slate-400 hover:text-[#FF7E5F] transition-all">
        <RefreshCw size={14} />
      </button>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Barre de recherche du dashboard avec filtres pill et bouton nouveau client.' } },
  },
};

export const NewProjectCard: Story = {
  render: () => (
    <div className="group rounded-[32px] p-6 border-2 border-dashed border-slate-300 dark:border-slate-600/50 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:border-[#FF7E5F] hover:text-[#FF7E5F] cursor-pointer transition-all min-h-[280px] w-[340px]">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-90 transition-transform duration-300 shadow-inner">
        <Plus size={28} />
      </div>
      <span className="font-serif text-xl">Nouveau client</span>
      <span className="text-xs mt-2 opacity-60 font-sans">Ajouter un projet</span>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Carte dashed "Nouveau client" avec animation de rotation au survol.' } },
  },
};
