import type { Preview } from '@storybook/react';
// Note: Tailwind CSS + all styles are loaded via preview-head.html (CDN approach)
// Do NOT import index.css here as it contains @tailwind directives that need the CDN to process

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: 'linear-gradient(135deg, #FFE4D6 0%, #FFF8F5 50%, #FFF0F5 100%)' },
        { name: 'dark', value: '#0F172A' },
        { name: 'unicorn', value: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 50%, #f5d0fe 100%)' },
        { name: 'white', value: '#FFFFFF' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Marion Web OS theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'unicorn', title: 'Unicorn', icon: 'heart' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
};

export default preview;
