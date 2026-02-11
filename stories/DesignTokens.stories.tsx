import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ThemeDecorator } from '../.storybook/ThemeDecorator';

/**
 * Référence visuelle de tous les tokens de design de Marion Web OS.
 * Couleurs, typographie, espacements, rayons de bordure et ombres.
 */
const meta: Meta = {
  title: 'Foundations/Design Tokens',
  decorators: [ThemeDecorator],
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Tokens de design fondamentaux de Marion Web OS. Utilisez cette page comme référence pour la conception de nouveaux composants.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const ColorSwatch = ({ name, hex, className }: { name: string; hex: string; className: string }) => (
  <div className="flex flex-col items-center gap-2">
    <div className={`w-16 h-16 rounded-2xl shadow-md border border-white/50 ${className}`} />
    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{name}</span>
    <span className="text-[10px] text-slate-400 font-mono">{hex}</span>
  </div>
);

export const BrandColors: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white">Couleurs de marque</h3>
      <div className="flex flex-wrap gap-6">
        <ColorSwatch name="Brand Orange" hex="#FF7E5F" className="bg-[#FF7E5F]" />
        <ColorSwatch name="Brand Pink" hex="#FEB47B" className="bg-[#FEB47B]" />
        <ColorSwatch name="Fuchsia" hex="#d946ef" className="bg-[#d946ef]" />
      </div>

      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white mt-8">Gradients</h3>
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-32 h-16 rounded-2xl shadow-md bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B]" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Marion Gradient</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-32 h-16 rounded-2xl shadow-md bg-gradient-to-r from-[#FF7E5F] to-[#d946ef]" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Sunset Gradient</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-32 h-16 rounded-2xl shadow-md bg-gradient-to-r from-purple-500 to-pink-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Filter Gradient</span>
        </div>
      </div>

      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white mt-8">Couleurs d'accent</h3>
      <div className="flex flex-wrap gap-6">
        <ColorSwatch name="Orange" hex="#FF7E5F" className="bg-[#FF7E5F]" />
        <ColorSwatch name="Blue" hex="#3B82F6" className="bg-[#3B82F6]" />
        <ColorSwatch name="Green" hex="#10B981" className="bg-[#10B981]" />
        <ColorSwatch name="Purple" hex="#8B5CF6" className="bg-[#8B5CF6]" />
      </div>
    </div>
  ),
};

export const SemanticColors: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white">Couleurs sémantiques</h3>
      <div className="flex flex-wrap gap-6">
        <ColorSwatch name="Success" hex="#10B981" className="bg-emerald-500" />
        <ColorSwatch name="Warning" hex="#F59E0B" className="bg-amber-500" />
        <ColorSwatch name="Error" hex="#EF4444" className="bg-red-500" />
        <ColorSwatch name="Info" hex="#3B82F6" className="bg-blue-500" />
      </div>

      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white mt-8">Couleurs de statut</h3>
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Actif', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
          { label: 'Prospect', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
          { label: 'Pro Bono', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
          { label: 'Personnel', bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
          { label: 'Archivé', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
        ].map((s) => (
          <div key={s.label} className={`px-4 py-2 rounded-full text-xs font-medium text-center border ${s.bg} ${s.text} ${s.border}`}>
            {s.label}
          </div>
        ))}
      </div>
    </div>
  ),
};

export const NeutralPalette: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white">Palette Slate</h3>
      <div className="flex gap-1">
        {[
          { name: '50', hex: '#F8FAFC', bg: 'bg-slate-50' },
          { name: '100', hex: '#F1F5F9', bg: 'bg-slate-100' },
          { name: '200', hex: '#E2E8F0', bg: 'bg-slate-200' },
          { name: '300', hex: '#CBD5E1', bg: 'bg-slate-300' },
          { name: '400', hex: '#94A3B8', bg: 'bg-slate-400' },
          { name: '500', hex: '#64748B', bg: 'bg-slate-500' },
          { name: '600', hex: '#475569', bg: 'bg-slate-600' },
          { name: '700', hex: '#334155', bg: 'bg-slate-700' },
          { name: '800', hex: '#1E293B', bg: 'bg-slate-800' },
          { name: '900', hex: '#0F172A', bg: 'bg-slate-900' },
        ].map((c) => (
          <div key={c.name} className="flex flex-col items-center gap-1">
            <div className={`w-12 h-12 rounded-lg ${c.bg}`} />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{c.name}</span>
            <span className="text-[9px] text-slate-400 font-mono">{c.hex}</span>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div className="space-y-6 w-[500px]">
      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white">Typographie</h3>

      <div className="space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Display XL — Montserrat 900</span>
          <p className="font-serif text-7xl font-black text-slate-800 dark:text-white">CHF 8'450</p>
        </div>
        <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">H1 — Montserrat 700</span>
          <p className="font-serif text-2xl font-bold text-slate-800 dark:text-white">Titre de section</p>
        </div>
        <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">H2 — Montserrat 700</span>
          <p className="font-serif text-xl font-bold text-slate-800 dark:text-white">Sous-titre widget</p>
        </div>
        <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">H3 — Montserrat 700</span>
          <p className="font-serif text-lg font-bold text-slate-800 dark:text-white">Titre de carte</p>
        </div>
        <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Body — Raleway 400</span>
          <p className="text-sm text-slate-600 dark:text-slate-300">Texte courant pour les descriptions et le contenu. Raleway est utilisée pour tout le corps de texte de l'application.</p>
        </div>
        <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Caption — Raleway 600</span>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Label, méta-information, horodatage</p>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Micro — Raleway 700</span>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">BADGES, LABELS, CATÉGORIES</p>
        </div>
      </div>

      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white mt-8">Gradient Text</h3>
      <p className="text-5xl font-serif font-black bg-gradient-to-r from-emerald-600 to-green-800 bg-clip-text text-transparent">
        +CHF 12'450
      </p>
      <p className="text-5xl font-serif font-black bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
        -CHF 3'200
      </p>
    </div>
  ),
};

export const BorderRadius: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white">Rayons de bordure</h3>
      <div className="flex items-end gap-6">
        {[
          { name: 'rounded-md', value: '6px', size: 'w-12 h-12' },
          { name: 'rounded-lg', value: '8px', size: 'w-14 h-14' },
          { name: 'rounded-xl', value: '12px', size: 'w-16 h-16' },
          { name: 'rounded-2xl', value: '16px', size: 'w-20 h-20' },
          { name: 'rounded-3xl', value: '24px', size: 'w-24 h-16' },
          { name: 'rounded-4xl', value: '32px', size: 'w-32 h-20' },
          { name: 'rounded-full', value: '∞', size: 'w-16 h-16' },
        ].map((r) => (
          <div key={r.name} className="flex flex-col items-center gap-2">
            <div className={`${r.size} bg-gradient-to-br from-[#FF7E5F] to-pink-400 shadow-md ${r.name === 'rounded-4xl' ? 'rounded-[32px]' : r.name}`} />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{r.name}</span>
            <span className="text-[9px] text-slate-400">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const Shadows: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white">Niveaux d'ombres</h3>
      <div className="flex gap-8">
        {[
          { name: 'shadow-sm', label: 'Level 0' },
          { name: 'shadow-md', label: 'Level 1' },
          { name: 'shadow-lg', label: 'Level 2' },
          { name: 'shadow-xl', label: 'Level 3' },
          { name: 'shadow-2xl', label: 'Level 4' },
        ].map((s) => (
          <div key={s.name} className="flex flex-col items-center gap-3">
            <div className={`w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 ${s.name}`} />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{s.name}</span>
            <span className="text-[9px] text-slate-400">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const GlassEffect: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white">Glassmorphisme</h3>
      <div className="flex gap-6">
        <div className="w-64 p-6 rounded-[32px] glass">
          <h4 className="font-serif font-bold text-slate-800 dark:text-white mb-2">Glass Card</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Surface semi-transparente avec backdrop-blur 20px.
          </p>
        </div>
        <div className="w-64 p-6 rounded-[32px] bg-white/70 dark:bg-slate-800/40 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
          <h4 className="font-serif font-bold text-slate-800 dark:text-white mb-2">Toolbar Glass</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Variante plus opaque pour la toolbar et le header.
          </p>
        </div>
      </div>
    </div>
  ),
};

export const Spacing: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white">Échelle d'espacements</h3>
      <div className="space-y-2">
        {[
          { name: '1 (4px)', width: 'w-1' },
          { name: '2 (8px)', width: 'w-2' },
          { name: '3 (12px)', width: 'w-3' },
          { name: '4 (16px)', width: 'w-4' },
          { name: '5 (20px)', width: 'w-5' },
          { name: '6 (24px)', width: 'w-6' },
          { name: '8 (32px)', width: 'w-8' },
        ].map((s) => (
          <div key={s.name} className="flex items-center gap-4">
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-20 text-right">{s.name}</span>
            <div className={`h-4 ${s.width} bg-gradient-to-r from-[#FF7E5F] to-pink-400 rounded-sm`} />
          </div>
        ))}
      </div>
    </div>
  ),
};
