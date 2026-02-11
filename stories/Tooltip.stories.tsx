import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from '../components/Shared';
import { ThemeDecorator } from '../.storybook/ThemeDecorator';
import { Settings, Bell, Mail, Star } from 'lucide-react';

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip',
  component: Tooltip,
  decorators: [ThemeDecorator],
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Tooltip avec flèche/pointeur, fond semi-transparent avec backdrop-blur. S\'affiche au survol avec une animation zoom-in.',
      },
    },
  },
  argTypes: {
    content: { control: 'text', description: 'Texte du tooltip' },
  },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  args: {
    content: 'Paramètres',
    children: (
      <button className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors">
        <Settings size={20} />
      </button>
    ),
  },
};

export const IconButtons: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Tooltip content="Notifications">
        <button className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors">
          <Bell size={20} />
        </button>
      </Tooltip>
      <Tooltip content="Emails">
        <button className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors">
          <Mail size={20} />
        </button>
      </Tooltip>
      <Tooltip content="Favoris">
        <button className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors">
          <Star size={20} />
        </button>
      </Tooltip>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Groupe de boutons icône avec tooltips — typique de la toolbar.' } },
  },
};
