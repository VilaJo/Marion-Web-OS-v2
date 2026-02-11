import type { Meta, StoryObj } from '@storybook/react';
import { Card, Badge } from '../components/Shared';
import { ThemeDecorator } from '../.storybook/ThemeDecorator';
import { TrendingUp, Users, Calendar } from 'lucide-react';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  decorators: [ThemeDecorator],
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Carte glassmorphisme — composant fondamental de Marion Web OS. Utilise la classe `.glass` avec `rounded-4xl` (32px) et un flou d\'arrière-plan.',
      },
    },
  },
  argTypes: {
    className: { control: 'text', description: 'Classes CSS additionnelles' },
    onClick: { action: 'clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: (
      <div>
        <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white mb-2">
          Titre de la carte
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Contenu de la carte avec le style glassmorphisme signature de Marion Web OS.
        </p>
      </div>
    ),
  },
};

export const WithStats: Story = {
  render: () => (
    <Card className="w-[400px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white">Revenus</h3>
            <p className="text-xs text-slate-400">Ce mois-ci</p>
          </div>
        </div>
        <Badge color="green">+12%</Badge>
      </div>
      <div className="text-4xl font-serif font-black text-slate-800 dark:text-white">
        CHF 8'450
      </div>
    </Card>
  ),
  parameters: {
    docs: { description: { story: 'Carte avec statistiques et badge, typique d\'un widget dashboard.' } },
  },
};

export const WithList: Story = {
  render: () => (
    <Card className="w-[350px]">
      <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
        <Users size={20} className="text-brand-orange" />
        Clients récents
      </h3>
      {['Marion Studio', 'Cabinet Dupont', 'Dr. Weber'].map((name, i) => (
        <div
          key={name}
          className={`flex items-center gap-3 py-3 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-700/50' : ''}`}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-50 to-pink-100 dark:from-orange-900/30 dark:to-pink-900/30 flex items-center justify-center text-sm font-serif font-bold text-orange-600 dark:text-orange-400">
            {name[0]}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{name}</p>
            <p className="text-xs text-slate-400">Projet en cours</p>
          </div>
          <Badge color="green">Actif</Badge>
        </div>
      ))}
    </Card>
  ),
};

export const Clickable: Story = {
  args: {
    className: 'w-[300px] cursor-pointer hover:scale-[1.02] transition-transform',
    onClick: () => alert('Card clicked!'),
    children: (
      <div className="flex items-center gap-3">
        <Calendar size={24} className="text-brand-orange" />
        <div>
          <h3 className="font-serif font-bold text-slate-800 dark:text-white">Réunion client</h3>
          <p className="text-xs text-slate-400">Aujourd'hui à 14:00</p>
        </div>
      </div>
    ),
  },
};
