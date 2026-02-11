import React, { useEffect } from 'react';

/**
 * Storybook decorator that applies the Marion Web OS theme
 * (light / dark / unicorn) based on the global toolbar selector.
 */
export const ThemeDecorator = (Story: React.FC, context: any) => {
  const theme = context.globals.theme || 'light';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'unicorn');
    if (theme === 'dark') root.classList.add('dark');
    if (theme === 'unicorn') root.classList.add('unicorn');
  }, [theme]);

  const bg: Record<string, string> = {
    light: 'linear-gradient(135deg, #FFE4D6 0%, #FFF8F5 50%, #FFF0F5 100%)',
    dark: 'linear-gradient(to bottom, #2E1065, #0F172A)',
    unicorn: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 50%, #f5d0fe 100%)',
  };

  return (
    <div
      style={{
        background: bg[theme],
        padding: 32,
        borderRadius: 16,
        minHeight: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Story />
    </div>
  );
};
