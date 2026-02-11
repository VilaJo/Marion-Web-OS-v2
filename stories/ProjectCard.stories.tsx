import type { Meta, StoryObj } from '@storybook/react';
import { ThemeDecorator } from '../.storybook/ThemeDecorator';
import { Card, Badge } from '../components/Shared';
import { MoreHorizontal, Clock, CreditCard, Mail, CheckSquare } from 'lucide-react';

/**
 * La carte projet est le composant principal du dashboard.
 * Chaque statut a sa propre palette de couleurs, son gradient de
 * barre de progression et son avatar.
 */
const meta: Meta = {
  title: 'Components/ProjectCard',
  decorators: [ThemeDecorator],
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Carte de projet avec avatar, barre de progression, statistiques et effets de survol (glow, scale, accent bar). Chaque statut de projet a sa propre identité visuelle.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

interface MockProjectCardProps {
  name: string;
  initials: string;
  status: string;
  statusBadge: { color: string; label: string };
  progress: number;
  avatarGradient: string;
  avatarText: string;
  bgClass: string;
  borderClass: string;
  barGradient: string;
  tasks: number;
  revenue: string;
  emails: number;
  pending: string;
}

const MockProjectCard = ({
  name, initials, status, statusBadge, progress, avatarGradient, avatarText,
  bgClass, borderClass, barGradient, tasks, revenue, emails, pending,
}: MockProjectCardProps) => (
  <div className={`group transition-all duration-500 cursor-pointer hover:scale-[1.03] hover:border-[#FF7E5F]/60 hover:shadow-[0_20px_50px_-12px_rgba(255,126,95,0.5)] relative overflow-hidden glass rounded-4xl p-6 shadow-sm border w-[340px] ${bgClass} ${borderClass}`}>
    {/* Glow effects */}
    <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#FF7E5F]/60 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0" />
    <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-purple-500/50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0" />
    {/* Accent bar */}
    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#FF7E5F] to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />

    <div className="relative z-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-3xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-xl font-serif font-bold shadow-inner border border-white/50 dark:border-white/5 group-hover:scale-110 transition-transform duration-300 group-hover:rotate-3 ${avatarText}`}>
            {initials}
          </div>
          <div>
            <h3 className="font-serif font-bold text-slate-800 dark:text-white text-base">{name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge color={statusBadge.color}>{statusBadge.label}</Badge>
            </div>
          </div>
        </div>
        <button className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100">
          <MoreHorizontal size={18} className="text-slate-400" />
        </button>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Progression</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{progress}%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
          <div className={`bg-gradient-to-r ${barGradient} h-full rounded-full transition-all duration-1000 ease-out`} style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg text-slate-500 dark:text-slate-400">
          <CheckSquare size={12} /> {tasks} tâches
        </span>
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
          {revenue}
        </span>
        {emails > 0 && (
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg animate-pulse">
            <Mail size={12} className="inline mr-1" />{emails} non lus
          </span>
        )}
        {pending !== 'CHF 0' && (
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
            <CreditCard size={12} className="inline mr-1" />{pending} dû
          </span>
        )}
      </div>
    </div>
  </div>
);

export const Active: Story = {
  render: () => (
    <MockProjectCard
      name="Marion Studio"
      initials="MS"
      status="Actif"
      statusBadge={{ color: 'green', label: 'Actif' }}
      progress={68}
      avatarGradient="from-emerald-50 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30"
      avatarText="text-emerald-600 dark:text-emerald-400"
      bgClass="bg-emerald-50/50 dark:bg-emerald-950/20"
      borderClass="border-emerald-100/50 dark:border-emerald-900/30"
      barGradient="from-emerald-400 via-teal-400 to-cyan-400"
      tasks={12}
      revenue="CHF 8'450"
      emails={2}
      pending="CHF 1'200"
    />
  ),
};

export const Prospect: Story = {
  render: () => (
    <MockProjectCard
      name="Cabinet Dupont"
      initials="CD"
      status="Prospect"
      statusBadge={{ color: 'yellow', label: 'Prospect' }}
      progress={15}
      avatarGradient="from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30"
      avatarText="text-amber-600 dark:text-amber-400"
      bgClass="bg-amber-50/50 dark:bg-amber-950/20"
      borderClass="border-amber-100/50 dark:border-amber-900/30"
      barGradient="from-amber-400 via-yellow-400 to-orange-400"
      tasks={3}
      revenue="CHF 0"
      emails={0}
      pending="CHF 0"
    />
  ),
};

export const ProBono: Story = {
  render: () => (
    <MockProjectCard
      name="Association Terre"
      initials="AT"
      status="Pro Bono"
      statusBadge={{ color: 'purple', label: 'Pro Bono' }}
      progress={45}
      avatarGradient="from-violet-50 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30"
      avatarText="text-violet-600 dark:text-violet-400"
      bgClass="bg-violet-50/50 dark:bg-violet-950/20"
      borderClass="border-violet-100/50 dark:border-violet-900/30"
      barGradient="from-violet-400 via-purple-400 to-fuchsia-400"
      tasks={8}
      revenue="CHF 0"
      emails={1}
      pending="CHF 0"
    />
  ),
};

export const Personal: Story = {
  render: () => (
    <MockProjectCard
      name="Mon Portfolio"
      initials="MP"
      status="Perso"
      statusBadge={{ color: 'pink', label: 'Personnel' }}
      progress={90}
      avatarGradient="from-pink-50 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30"
      avatarText="text-pink-600 dark:text-pink-400"
      bgClass="bg-pink-50/50 dark:bg-pink-950/20"
      borderClass="border-pink-100/50 dark:border-pink-900/30"
      barGradient="from-pink-400 via-rose-400 to-red-400"
      tasks={5}
      revenue="CHF 0"
      emails={0}
      pending="CHF 0"
    />
  ),
};

export const Archived: Story = {
  render: () => (
    <MockProjectCard
      name="Ancien Client"
      initials="AC"
      status="Archivé"
      statusBadge={{ color: 'gray', label: 'Archivé' }}
      progress={100}
      avatarGradient="from-slate-100 to-gray-200 dark:from-slate-800 dark:to-gray-800"
      avatarText="text-slate-500 dark:text-slate-400"
      bgClass="bg-slate-50/50 dark:bg-slate-900/20"
      borderClass="border-slate-100/50 dark:border-slate-800/30"
      barGradient="from-slate-400 via-gray-400 to-slate-500"
      tasks={20}
      revenue="CHF 15'000"
      emails={0}
      pending="CHF 0"
    />
  ),
};

export const AllStatuses: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-6">
      <MockProjectCard name="Marion Studio" initials="MS" status="Actif" statusBadge={{ color: 'green', label: 'Actif' }} progress={68} avatarGradient="from-emerald-50 to-teal-100" avatarText="text-emerald-600" bgClass="bg-emerald-50/50" borderClass="border-emerald-100/50" barGradient="from-emerald-400 via-teal-400 to-cyan-400" tasks={12} revenue="CHF 8'450" emails={2} pending="CHF 1'200" />
      <MockProjectCard name="Cabinet Dupont" initials="CD" status="Prospect" statusBadge={{ color: 'yellow', label: 'Prospect' }} progress={15} avatarGradient="from-amber-50 to-yellow-100" avatarText="text-amber-600" bgClass="bg-amber-50/50" borderClass="border-amber-100/50" barGradient="from-amber-400 via-yellow-400 to-orange-400" tasks={3} revenue="CHF 0" emails={0} pending="CHF 0" />
      <MockProjectCard name="Association Terre" initials="AT" status="Pro Bono" statusBadge={{ color: 'purple', label: 'Pro Bono' }} progress={45} avatarGradient="from-violet-50 to-purple-100" avatarText="text-violet-600" bgClass="bg-violet-50/50" borderClass="border-violet-100/50" barGradient="from-violet-400 via-purple-400 to-fuchsia-400" tasks={8} revenue="CHF 0" emails={1} pending="CHF 0" />
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Comparaison des 3 statuts principaux côte à côte.' } },
  },
};
