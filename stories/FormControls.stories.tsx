import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { ThemeDecorator } from '../.storybook/ThemeDecorator';
import { Search, Mail, Lock, User, Eye, EyeOff, Mic, Send } from 'lucide-react';

/**
 * Inputs, toggles et contrôles de formulaire utilisés dans Eonora Tech OS.
 */
const meta: Meta = {
  title: 'Components/FormControls',
  decorators: [ThemeDecorator],
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Contrôles de formulaire : inputs avec icônes, textarea, toggle switches, sélecteurs de couleurs. Tous suivent le même design system avec rounded-xl/2xl et focus ring orange.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const SearchInput: Story = {
  render: () => (
    <div className="relative w-[400px]">
      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder="Rechercher un client, projet..."
        className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]/50 focus:border-[#FF7E5F] transition-all"
      />
    </div>
  ),
};

export const EmailInput: Story = {
  render: () => (
    <div className="w-[400px] space-y-2">
      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
      <div className="relative">
        <Mail size={18} className="absolute left-3 top-3 text-slate-400" />
        <input
          type="email"
          placeholder="contact@example.ch"
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#FF7E5F] transition-colors text-sm text-slate-800 dark:text-white"
        />
      </div>
    </div>
  ),
};

export const PasswordInput: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="w-[400px] space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mot de passe</label>
        <div className="relative">
          <Lock size={18} className="absolute left-3 top-3 text-slate-400" />
          <input
            type={visible ? 'text' : 'password'}
            placeholder="••••••••"
            className="w-full pl-10 pr-12 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#FF7E5F] transition-colors text-sm text-slate-800 dark:text-white"
          />
          <button
            onClick={() => setVisible(!visible)}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
    );
  },
};

export const Textarea: Story = {
  render: () => (
    <div className="w-[400px] space-y-2">
      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
      <textarea
        placeholder="Décrivez votre projet..."
        rows={4}
        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#FF7E5F] transition-colors resize-none text-slate-800 dark:text-white placeholder-slate-400"
      />
    </div>
  ),
};

export const ToggleSwitch: Story = {
  render: () => {
    const [on1, setOn1] = useState(true);
    const [on2, setOn2] = useState(false);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between w-[300px]">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Notifications email</span>
          <button
            onClick={() => setOn1(!on1)}
            className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${on1 ? 'bg-[#FF7E5F]' : 'bg-slate-300 dark:bg-slate-700'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${on1 ? 'left-5' : 'left-1'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between w-[300px]">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Mode sombre</span>
          <button
            onClick={() => setOn2(!on2)}
            className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${on2 ? 'bg-[#FF7E5F]' : 'bg-slate-300 dark:bg-slate-700'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${on2 ? 'left-5' : 'left-1'}`} />
          </button>
        </div>
      </div>
    );
  },
  parameters: {
    docs: { description: { story: 'Toggle switch avec la couleur brand-orange pour l\'état actif.' } },
  },
};

export const ColorPicker: Story = {
  render: () => {
    const [selected, setSelected] = useState('#FF7E5F');
    const colors = ['#FF7E5F', '#3B82F6', '#10B981', '#8B5CF6'];
    return (
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Couleur d'accent</label>
        <div className="flex gap-3">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setSelected(c)}
              className="w-12 h-12 rounded-full shadow-sm hover:scale-110 transition-transform relative border-2 border-white dark:border-slate-800"
              style={{ background: c }}
            >
              {selected === c && (
                <div className="absolute inset-0 flex items-center justify-center text-white/80">✓</div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  },
  parameters: {
    docs: { description: { story: 'Sélecteur de couleur d\'accent — les 4 couleurs disponibles dans les paramètres.' } },
  },
};

export const ChatInput: Story = {
  render: () => (
    <div className="w-[500px] flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2">
      <button className="p-2 rounded-full text-slate-400 hover:text-pink-500 hover:bg-pink-50 transition-colors">
        <Mic size={18} />
      </button>
      <input
        type="text"
        placeholder="Écrivez votre message..."
        className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-white placeholder-slate-400"
      />
      <button className="p-2 bg-gradient-to-r from-[#FF7E5F] to-pink-500 text-white rounded-full hover:scale-110 transition-all">
        <Send size={16} />
      </button>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Input de chat avec bouton micro et envoi — utilisé dans Coach Franck.' } },
  },
};
