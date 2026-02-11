import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Modal } from '../components/Shared';

const meta: Meta<typeof Modal> = {
  title: 'Components/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Modale accessible avec focus trap, ESC pour fermer, et scroll lock. S\'affiche en bottom-sheet sur mobile (rounded-t-3xl) et centrée sur desktop (rounded-4xl). Supporte le drag handle mobile.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    width: {
      control: 'select',
      options: ['max-w-sm', 'max-w-md', 'max-w-lg', 'max-w-2xl', 'max-w-4xl'],
    },
    isOpen: { control: 'boolean' },
    noContentPadding: { control: 'boolean' },
    showCloseButton: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

const ModalDemo = ({ title, width, content }: { title: string; width?: string; content: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: 40 }}>
      <button
        onClick={() => setOpen(true)}
        className="px-6 py-2.5 bg-gradient-to-r from-[#FF7E5F] to-pink-500 text-white rounded-full text-sm font-bold hover:scale-105 transition-transform shadow-lg"
      >
        Ouvrir la modale
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={title} width={width}>
        {content}
      </Modal>
    </div>
  );
};

export const Default: Story = {
  render: () => (
    <ModalDemo
      title="Nouveau projet"
      content={
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Nom du client</label>
            <input
              type="text"
              placeholder="Ex: Cabinet Dupont"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#FF7E5F] transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Description</label>
            <textarea
              placeholder="Décrivez le projet..."
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#FF7E5F] transition-colors resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button className="px-6 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-bold text-sm transition-colors">
              Annuler
            </button>
            <button className="px-6 py-2.5 rounded-xl bg-[#FF7E5F] text-white font-bold text-sm hover:bg-orange-600 transition-colors shadow-lg">
              Créer
            </button>
          </div>
        </div>
      }
    />
  ),
};

export const Wide: Story = {
  render: () => (
    <ModalDemo
      title="Paramètres"
      width="max-w-4xl"
      content={
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-serif font-bold text-slate-800 dark:text-white">Profil</h3>
            <input type="text" placeholder="Nom" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none" />
            <input type="email" placeholder="Email" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none" />
          </div>
          <div className="space-y-4">
            <h3 className="font-serif font-bold text-slate-800 dark:text-white">Préférences</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configurez votre espace de travail selon vos préférences.
            </p>
          </div>
        </div>
      }
    />
  ),
  parameters: {
    docs: { description: { story: 'Modale large (max-w-4xl) pour les paramètres ou les formulaires complexes.' } },
  },
};
