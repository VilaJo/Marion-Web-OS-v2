import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../components/Shared';
import { ThemeDecorator } from '../.storybook/ThemeDecorator';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  decorators: [ThemeDecorator],
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Badge pill utilisé pour les statuts, catégories et labels. Disponible en 8 couleurs avec support light/dark mode.',
      },
    },
  },
  argTypes: {
    color: {
      control: 'select',
      options: ['green', 'blue', 'purple', 'yellow', 'gray', 'red', 'pink', 'brand'],
      description: 'Couleur du badge',
    },
    children: { control: 'text', description: 'Contenu du badge' },
    onClick: { action: 'clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Green: Story = {
  args: { color: 'green', children: 'Actif' },
};

export const Blue: Story = {
  args: { color: 'blue', children: 'En cours' },
};

export const Purple: Story = {
  args: { color: 'purple', children: 'Pro bono' },
};

export const Yellow: Story = {
  args: { color: 'yellow', children: 'En attente' },
};

export const Gray: Story = {
  args: { color: 'gray', children: 'Archivé' },
};

export const Red: Story = {
  args: { color: 'red', children: 'Urgent' },
};

export const Pink: Story = {
  args: { color: 'pink', children: 'Personnel' },
};

export const Brand: Story = {
  args: { color: 'brand', children: 'Marion OS' },
};

export const Clickable: Story = {
  args: { color: 'brand', children: 'Cliquez-moi', onClick: () => alert('Badge clicked!') },
};

export const AllColors: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge color="green">Actif</Badge>
      <Badge color="blue">En cours</Badge>
      <Badge color="purple">Pro bono</Badge>
      <Badge color="yellow">Prospect</Badge>
      <Badge color="gray">Archivé</Badge>
      <Badge color="red">Urgent</Badge>
      <Badge color="pink">Personnel</Badge>
      <Badge color="brand">Marion OS</Badge>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Toutes les variantes de couleur côte à côte.' } },
  },
};
