import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from '../components/Shared';
import { ThemeDecorator } from '../.storybook/ThemeDecorator';
import { Inbox, Users, FileText, Calendar, Mail } from 'lucide-react';

const meta: Meta<typeof EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  decorators: [ThemeDecorator],
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Composant d\'état vide affiché quand une section n\'a pas encore de contenu. Comprend une icône, un titre, un message et un CTA optionnel.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    message: { control: 'text' },
    actionLabel: { control: 'text' },
    onAction: { action: 'action-clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: 'Aucun projet',
    message: 'Vous n\'avez pas encore de projet. Créez votre premier projet pour commencer.',
    icon: FileText,
    actionLabel: 'Nouveau projet',
  },
};

export const NoClients: Story = {
  args: {
    title: 'Aucun client',
    message: 'Votre liste de clients est vide. Ajoutez votre premier client pour démarrer.',
    icon: Users,
    actionLabel: 'Ajouter un client',
  },
};

export const EmptyInbox: Story = {
  args: {
    title: 'Boîte de réception vide',
    message: 'Vous n\'avez aucun email non lu. Profitez-en pour vous concentrer sur vos projets !',
    icon: Mail,
  },
};

export const NoEvents: Story = {
  args: {
    title: 'Rien de prévu',
    message: 'Votre agenda est libre pour aujourd\'hui. Planifiez vos prochaines tâches.',
    icon: Calendar,
    actionLabel: 'Planifier',
  },
};

export const WithoutAction: Story = {
  args: {
    title: 'Tout est en ordre',
    message: 'Aucune notification en attente. Votre espace de travail est propre.',
    icon: Inbox,
  },
  parameters: {
    docs: { description: { story: 'Empty state sans bouton d\'action — mode informatif.' } },
  },
};
