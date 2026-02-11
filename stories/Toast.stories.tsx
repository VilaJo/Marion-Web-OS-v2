import type { Meta, StoryObj } from '@storybook/react';
import { Toast } from '../components/Shared';
import { ThemeDecorator } from '../.storybook/ThemeDecorator';

const meta: Meta<typeof Toast> = {
  title: 'Components/Toast',
  component: Toast,
  decorators: [ThemeDecorator],
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Notification toast avec barre d\'accent latérale, backdrop blur et animation slide-in. Utilisé par le NotificationStore pour les feedbacks utilisateur.',
      },
    },
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['success', 'error', 'info', 'warning'],
      description: 'Type de notification',
    },
    message: { control: 'text', description: 'Message affiché' },
    onClose: { action: 'closed' },
  },
};

export default meta;
type Story = StoryObj<typeof Toast>;

export const Success: Story = {
  args: {
    type: 'success',
    message: 'Le projet a été sauvegardé avec succès.',
  },
};

export const Error: Story = {
  args: {
    type: 'error',
    message: 'Impossible de se connecter au serveur IMAP.',
  },
};

export const Info: Story = {
  args: {
    type: 'info',
    message: 'Vous avez 3 nouveaux emails non lus.',
  },
};

export const Warning: Story = {
  args: {
    type: 'warning',
    message: 'La facture FJ-2026-042 est en retard de 15 jours.',
  },
};

export const AllTypes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Toast type="success" message="Projet sauvegardé avec succès." onClose={() => {}} />
      <Toast type="error" message="Erreur de connexion au serveur." onClose={() => {}} />
      <Toast type="info" message="3 nouveaux emails non lus." onClose={() => {}} />
      <Toast type="warning" message="Facture en retard de paiement." onClose={() => {}} />
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Les 4 types de toast côte à côte.' } },
  },
};
