import type { Preview } from '@storybook/react';
// Note: Tailwind CSS + all styles are loaded via preview-head.html (CDN approach)
// Do NOT import index.css here as it contains @tailwind directives that need the CDN to process

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: {
      options: {
        light: { name: 'light', value: 'linear-gradient(135deg, #FFE4D6 0%, #FFF8F5 50%, #FFF0F5 100%)' },
        dark: { name: 'dark', value: '#0F172A' },
        unicorn: { name: 'unicorn', value: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 50%, #f5d0fe 100%)' },
        white: { name: 'white', value: '#FFFFFF' }
      }
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
      description: 'Eonora Tech OS theme',
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

    backgrounds: {
      value: 'light'
    }
  },
};

export default preview;
