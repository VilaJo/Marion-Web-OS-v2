# Eonora Tech OS - Design System Rules

> Rules for translating Figma designs into code and maintaining consistency.

---

## 1. Token Definitions

### Location
- **CSS variables**: `index.css` (`:root`, `.dark`, `.unicorn`)
- **Tailwind config**: Inline in `index.html` (`tailwind.config = { ... }`)
- **Runtime**: `App.tsx` sets `--brand-color` via `document.documentElement.style.setProperty()`

### Key Variables
```css
:root {
  --brand-orange: #FF7E5F;
  --brand-color: #FF7E5F;  /* Overridable by accent selection */
  --pastel-pink: #FFF0F5;
  --pastel-purple: #F3E8FF;
}
.unicorn { --brand-color: #d946ef; }
```

### Accent System
The accent color is user-selectable from Settings. It changes `--brand-color` which cascades to:
- `brand-orange` (Tailwind)
- `brand-primary` (Tailwind)
- Background gradients (computed in App.tsx)

---

## 2. Component Library

### Location
All components in `components/` directory:
- **Shared primitives**: `components/Shared.tsx` (Badge, Card, Modal, Tooltip, EmptyState, Toast)
- **Feature components**: `components/{FeatureName}.tsx`
- **Nested modules**: `components/email/`, `components/media/`

### Architecture
- Functional components with TypeScript
- Props interfaces defined inline
- No HOC or render prop patterns
- Zustand for state management

### No Shared Button/Input
Buttons and inputs are NOT abstracted into shared components. They use recurring Tailwind class patterns inline.

---

## 3. Styling Approach

### Tailwind CSS 4
- Utility-first, all styles inline via className
- Custom utilities in `index.css` (`.glass`, `.juicy-hover`, etc.)
- Dark mode via `dark:` prefix (class-based)
- Responsive via `sm:`, `md:`, `lg:` prefixes

### Glass Effect Pattern
```
glass rounded-4xl p-6 shadow-sm dark:shadow-md border border-white/50 dark:border-slate-700/50 dark:bg-slate-800/40
```

### Key CSS Classes
| Class | Effect |
|-------|--------|
| `glass` | Frosted glass: backdrop-blur-20px, semi-transparent bg |
| `rounded-4xl` | 32px border radius |
| `juicy-hover` | Bouncy hover animation |
| `font-serif` / `font-heading` | Montserrat |
| `font-sans` | Raleway |

---

## 4. Figma-to-Code Mapping Rules

### Colors
| Figma Token | Tailwind Class |
|-------------|---------------|
| Brand Orange | `bg-brand-orange`, `text-brand-orange` |
| Brand Secondary | `text-brand-pink` |
| Cream | `bg-cream` |
| Glass White | `bg-glass-white` |
| Glass Dark | `bg-glass-dark` |
| Deep Space | `bg-deep-space` |

### Typography
| Figma Style | Tailwind Classes |
|------------|-----------------|
| H1 | `font-serif text-5xl font-extrabold` |
| H2 | `font-serif text-4xl font-bold` |
| H3 | `font-serif text-3xl font-bold` |
| H4 | `font-serif text-2xl font-semibold` |
| H5 | `font-serif text-xl font-semibold` |
| Body | `font-sans text-base` |
| Body SM | `font-sans text-sm` |
| Caption | `font-sans text-xs font-medium` |
| Label | `font-sans text-sm font-semibold` |

### Spacing
All spacing uses Tailwind's scale: `p-1` (4px) through `p-16` (64px).

### Border Radius
| Figma Token | Tailwind Class |
|-------------|---------------|
| 8px | `rounded-lg` |
| 12px | `rounded-xl` |
| 16px | `rounded-2xl` |
| 24px | `rounded-3xl` |
| 32px | `rounded-4xl` |
| Full | `rounded-full` |

---

## 5. Theme Implementation

### Switching Themes
```tsx
// In Settings component
document.documentElement.classList.toggle('dark');
document.documentElement.classList.toggle('unicorn');
```

### Theme-Aware Components
Every component must handle 3 themes:
1. **Light**: Default (no prefix)
2. **Dark**: `dark:` prefix
3. **Unicorn**: `.unicorn` class overrides

### Pattern
```tsx
<div className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
  {/* Unicorn inherits light mode + glass shadow override */}
</div>
```

---

## 6. Icon System

### Library: Lucide React
```tsx
import { Search, Bell, Settings } from 'lucide-react';
<Search className="w-5 h-5 text-slate-500" />
```

### Sizes
- Default: `w-5 h-5` (20px)
- Small: `w-4 h-4` (16px)
- Large: `w-6 h-6` (24px)

---

## 7. Responsive Patterns

### Breakpoints
- Mobile first approach
- `sm:` 640px
- `md:` 768px (main breakpoint for layout changes)
- `lg:` 1024px

### Common Responsive Patterns
```tsx
// Padding
className="px-2 sm:px-3 md:px-6"

// Grid columns
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"

// Show/hide
className="hidden md:flex"  // Show only on desktop
className="flex md:hidden"  // Show only on mobile

// Modal behavior
className="rounded-t-3xl md:rounded-4xl"  // Bottom sheet → centered modal
```

---

## 8. Animation Patterns

### Entries
- Modals: `animate-in fade-in zoom-in-95 duration-500`
- Toasts: `animate-in slide-in-from-right-full duration-500`
- Bottom sheets: `animate-in slide-in-from-bottom duration-500`
- Dropdowns: `animate-in fade-in slide-in-from-top-2 duration-200`

### Hover
- Cards: `hover:scale-[1.03] transition-all duration-500`
- Buttons: `hover:scale-105 transition-transform`
- Juicy: `cubic-bezier(0.175, 0.885, 0.32, 1.275)`

---

## 9. Project Structure

```
Eonora Tech OS/
├── components/         # All React components
│   ├── Shared.tsx      # Badge, Card, Modal, Tooltip, EmptyState, Toast
│   ├── AppHeader.tsx   # Main navigation header
│   ├── email/          # Email module components
│   └── media/          # Media Studio components
├── pages/              # Route-level page components
├── stores/             # Zustand stores
├── services/           # API services, queries
├── translations/       # i18n (FR, EN, ES)
├── constants.ts        # Workflow phases, colors
├── index.css           # Global CSS, glass effects, animations
├── index.html          # Tailwind config, fonts, base styles
└── figma/              # Design system assets (this directory)
    ├── tokens.json     # Tokens Studio import file
    ├── figma-spec.md   # Complete Figma build specification
    └── design-system-rules.md  # This file
```
