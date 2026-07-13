# Eonora Tech OS - Figma Specification

> This document provides complete specifications for building the Figma design file.
> Import `tokens.json` via Tokens Studio plugin for all design tokens.

---

## Page 1 : Cover & Documentation

### Cover Frame (1440x900)
- Background: `marion-gradient` (linear-gradient 135deg, #FF7E5F → #FEB47B)
- Logo: Eonora Tech OS logo centered, white, 120px
- Title: "Eonora Tech OS" — Montserrat 800, 64px, white
- Subtitle: "Design System & UI Kit" — Raleway 400, 24px, white/80
- Version: "v1.0" — Raleway 500, 16px, white/60
- Date: "Fevrier 2026" — Raleway 400, 14px, white/60

### Table of Contents
- Clickable links to all pages (use Figma prototyping)
- 6 sections listed with preview thumbnails

---

## Page 2 : Design System - Fondations

### 2.1 Color Palette

#### Brand Colors
| Name | Hex | Usage |
|------|-----|-------|
| Brand Orange | #FF7E5F | Primary CTA, accents, brand identity |
| Brand Secondary | #FEB47B | Secondary accents, gradients |
| Brand Fuchsia | #d946ef | Unicorn theme brand |

#### Accent Options (user-selectable)
| Name | Hex | Background Gradient |
|------|-----|---------------------|
| Orange | #FF7E5F | 135deg #FFE4D6 → #FFF8F5 → #FFF0F5 |
| Blue | #3B82F6 | 135deg #DBEAFE → #EFF6FF → #F0F9FF |
| Emerald | #10B981 | 135deg #D1FAE5 → #ECFDF5 → #F0FDF4 |
| Violet | #8B5CF6 | 135deg #EDE9FE → #F5F3FF → #FAF5FF |

#### Neutral Palette
| Name | Hex |
|------|-----|
| Cream | #FDFCF8 |
| Cream Dark | #F5F2EA |
| Slate 50 | #F8FAFC |
| Slate 100 | #F1F5F9 |
| Slate 200 | #E2E8F0 |
| Slate 300 | #CBD5E1 |
| Slate 400 | #94A3B8 |
| Slate 500 | #64748B |
| Slate 600 | #475569 |
| Slate 700 | #334155 |
| Slate 800 | #1E293B |
| Slate 900 | #0F172A |

#### Pastel Palette
| Name | Hex |
|------|-----|
| Pastel Pink | #FFF0F5 / #FCE7F3 |
| Pastel Purple | #F3E8FF / #E9D5FF |
| Pastel Orange | #FFEDD5 |

#### Semantic Colors
| Type | Color | Light BG | Dark BG |
|------|-------|----------|---------|
| Success | #10B981 | #D1FAE5 | green-900/30 |
| Warning | #F59E0B | #FEF3C7 | yellow-900/30 |
| Error | #EF4444 | #FEE2E2 | red-900/30 |
| Info | #3B82F6 | #DBEAFE | blue-900/30 |

#### Theme Backgrounds
- **Light**: linear-gradient(135deg, #FFE4D6, #FFF8F5, #FFF0F5)
- **Dark "Space"**: linear-gradient(to bottom, #2E1065, #0F172A)
  - Grid overlay: 1px white/3% lines
  - Star layers: sm (1px), md (2px), lg (3px) white dots
- **Unicorn**: linear-gradient(135deg, #fdf4ff, #fae8ff, #f5d0fe)

#### Gradients
| Name | Value |
|------|-------|
| Marion | 135deg #FF7E5F → #FEB47B |
| Sunset | 135deg #FF7E5F → #d946ef |
| Space | to bottom #2E1065 → #0F172A |
| Unicorn | 135deg #FFF0F5 → #E0F7FA → #F3E5F5 |

### 2.2 Typography

#### Font Families
- **Headings**: Montserrat (Google Fonts)
  - Weights: 400, 500, 600, 700, 800 + italic 400, 600
- **Body**: Raleway (Google Fonts)
  - Weights: 300, 400, 500, 600, 700

#### Type Scale
| Style | Font | Weight | Size | Line Height | Usage |
|-------|------|--------|------|-------------|-------|
| H1 | Montserrat | 800 | 48px | 1.25 | Page titles |
| H2 | Montserrat | 700 | 36px | 1.25 | Section titles |
| H3 | Montserrat | 700 | 30px | 1.25 | Subsection titles |
| H4 | Montserrat | 600 | 24px | 1.25 | Card titles |
| H5 | Montserrat | 600 | 20px | 1.25 | Widget titles |
| H6 | Montserrat | 500 | 18px | 1.25 | Minor headings |
| Body | Raleway | 400 | 16px | 1.5 | Default text |
| Body SM | Raleway | 400 | 14px | 1.5 | Secondary text |
| Caption | Raleway | 500 | 12px | 1.5 | Captions, badges |
| Label | Raleway | 600 | 14px | 1.25 | Form labels |
| Overline | Montserrat | 600 | 12px | 1.25 | Section labels, uppercase |

#### Text Colors per Theme
| | Light | Dark | Unicorn |
|---|---|---|---|
| Primary | #1E293B | #F1F5F9 | #1E293B |
| Secondary | #64748B | #CBD5E1 | #64748B |
| Muted | #94A3B8 | #94A3B8 | #94A3B8 |

### 2.3 Spacing Scale

| Token | Value |
|-------|-------|
| space-1 | 4px |
| space-2 | 8px |
| space-3 | 12px |
| space-4 | 16px |
| space-5 | 20px |
| space-6 | 24px |
| space-8 | 32px |
| space-12 | 48px |
| space-16 | 64px |

### 2.4 Grid System
- **Max width**: 1400px
- **Horizontal padding**: 8px (mobile) → 12px (sm) → 24px (md)
- **Columns**: Fluid, no fixed column grid

### 2.5 Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| radius-sm | 4px | Small elements |
| radius-md | 8px | Buttons, inputs |
| radius-lg | 12px | Cards inner |
| radius-xl | 16px | Dropdowns |
| radius-2xl | 24px | Modals, large cards |
| radius-3xl | 28px | Bottom sheets |
| radius-4xl | 32px | Main cards (glass) |
| radius-full | 9999px | Badges, pills, avatars |

### 2.6 Effects

#### Glass Effect
| Theme | Background | Blur | Border | Shadow |
|-------|------------|------|--------|--------|
| Light | rgba(255,255,255,0.75) | 20px | 1px rgba(255,255,255,0.6) | 0 4px 30px rgba(0,0,0,0.05) |
| Dark | rgba(30,41,59,0.4) | 20px | 1px rgba(255,255,255,0.1) | 0 4px 30px rgba(0,0,0,0.2) |
| Unicorn | rgba(255,255,255,0.65) | 20px | 1px rgba(255,255,255,0.8) | 0 8px 32px rgba(236,72,153,0.15) |

#### Shadows
| Name | Value |
|------|-------|
| Shadow SM | 0 1px 2px rgba(0,0,0,0.05) |
| Shadow MD | 0 4px 6px -1px rgba(0,0,0,0.1) |
| Shadow LG | 0 10px 15px -3px rgba(0,0,0,0.1) |
| Shadow XL | 0 20px 25px -5px rgba(0,0,0,0.1) |
| Shadow 2XL | 0 25px 50px -12px rgba(0,0,0,0.25) |

#### Dark Mode Glow Effects
| Name | Value |
|------|-------|
| Brand Glow | 0 0 10px rgba(255,126,95,0.4), inset 0 0 10px rgba(255,255,255,0.2) |
| Brand Glow Hover | 0 0 20px rgba(255,126,95,0.7), 0 0 40px rgba(255,126,95,0.4) |
| Firefly Glow | 0 0 8px rgba(255,126,95,0.6), 0 0 20px rgba(255,126,95,0.3) |

### 2.7 Google Calendar Categories (Agenda)

These 8 event categories match Marion's Google Calendar colors exactly for seamless sync.

| Category | Hex | Google Calendar Color | colorId |
|----------|-----|----------------------|---------|
| Deadlines | #D50000 | Tomato | 11 |
| Call ou rdv pro | #8E24AA | Grape | 3 |
| To do pro | #3F51B5 | Blueberry | 9 |
| Anniversaire | #7986CB | Lavender | 1 |
| Facturation | #F6BF26 | Banana | 5 |
| Perso | #E91E63 | Flamingo | 4 |
| Maintenances | #F4511E | Tangerine | 6 |
| Sport | #33B679 | Sage | 2 |

Events use these colors as:
- Left border (4px, solid color)
- Background (color at 8% opacity)
- Text color (full color, lighter in dark mode)
- Dot color in month view (full color)
- Chip background for all-day events (full color, white text)

### 2.8 Icons
- **Library**: Lucide React (https://lucide.dev)
- **Default size**: 20px (w-5 h-5)
- **Small**: 16px (w-4 h-4)
- **Large**: 24px (w-6 h-6)
- **Stroke width**: 2px default

### 2.8 Animation Reference (document, not animate in Figma)
| Name | Duration | Easing | Description |
|------|----------|--------|-------------|
| Float | 6s | ease-in-out | Y translate -15px, infinite |
| Float Slow | 12s | ease-in-out | Y translate -20px + rotate 5deg |
| Twinkle | 4s | ease-in-out | Opacity 0.3→1→0.3, infinite |
| Loading Bar | 2.5s | ease-out | Width 0→100% |
| Slide In Right | 500ms | ease-out | TranslateX 100%→0 |
| Zoom In 95 | 500ms | ease-out | Scale 0.95→1 + fade |
| Juicy Hover | — | cubic-bezier(0.175,0.885,0.32,1.275) | Scale 1.03 |

---

## Page 3 : Design System - Composants

### 3.1 Badge

**Structure**: `px-3 py-1 rounded-full text-xs font-medium border`
**Size**: Single size (no variants)
**States**: Default, Hover (opacity 80% if clickable)

#### Color Variants (Light / Dark)
| Color | Light BG | Light Text | Dark BG | Dark Text |
|-------|----------|------------|---------|-----------|
| Green | green-100 | green-700 | green-900/30 | green-400 |
| Blue | blue-100 | blue-700 | blue-900/30 | blue-400 |
| Purple | purple-100 | purple-700 | purple-900/30 | purple-400 |
| Yellow | yellow-100 | yellow-700 | yellow-900/30 | yellow-400 |
| Gray | gray-100 | gray-700 | gray-800/50 | gray-400 |
| Red | red-100 | red-700 | red-900/30 | red-400 |
| Pink | pink-100 | pink-700 | pink-900/30 | pink-400 |
| Orange | orange-100 | orange-700 | orange-900/30 | orange-400 |
| Brand | = orange | = orange | = orange | = orange |

### 3.2 Card

**Structure**: Glass container
- Padding: 24px (p-6)
- Border radius: 32px (rounded-4xl)
- Border: 1px white/50 (light) | slate-700/50 (dark)
- Shadow: sm (light) | md (dark)
- Background: Glass effect (see 2.6)

### 3.3 Modal

**Backdrop**: Fixed, bg-black/30, backdrop-blur-sm, fade-in 500ms

**Container**:
- Desktop: rounded-4xl, max-w-2xl (default), zoom-in-95 animation
- Mobile: rounded-t-3xl (bottom sheet), slide-in-from-bottom
- Background: white (light) | slate-900/95 + border slate-700/50 (dark)
- Shadow: 2xl (light) | deep dark shadow (dark)
- Max height: 90vh (mobile) | 95vh (desktop)

**Header**: p-6, border-b slate-100 (light) | slate-700/50 (dark)
- Title: Montserrat 600, text-xl
- Close button: X icon, top-right

**Content**: p-6 (or p-0 if noContentPadding)

**Mobile drag handle**: w-10 h-1 rounded-full bg-slate-300, centered top

### 3.4 Tooltip

**Structure**: 
- Trigger: relative container
- Content: absolute, top-full mt-2
- Background: slate-800/90, backdrop-blur-sm
- Text: white, text-xs, font-medium
- Padding: px-3 py-1.5
- Border radius: lg (12px)
- Pointer: 2x2 rotated 45deg arrow
- Animation: fade-in + zoom-in-95, 200ms

### 3.5 Empty State

**Layout**: Centered, flex-col, min-h-300px
- Icon circle: 80px, bg-slate-100 (light) | slate-800 (dark), rounded-full, shadow-inner
- Icon: 32px, slate-400
- Title: Montserrat 700, text-xl, slate-700 (light) | slate-200 (dark), mb-2
- Message: Raleway 400, slate-500 | slate-400, max-w-md, mb-8
- Action button: px-6 py-2.5, bg-slate-900 | slate-700, white text, rounded-full, text-sm, font-bold, shadow-lg

### 3.6 Toast

**Container**: Fixed, top-24 right-4, z-110, flex-col gap-3

**Toast Item**:
- Min width: 340px, max-w-sm
- Padding: 16px, gap-4
- Border radius: 2xl (24px)
- Border: 1px white/60 (light) | white/10 (dark)
- Background: white/80 (light) | slate-800/80 (dark)
- Backdrop blur: xl
- Shadow: xl → 2xl on hover
- Animation: slide-in-from-right-full, 500ms
- Hover: scale 1.02

**Error variant**: bg-red-50/90 (light) | red-900/30 (dark)
**Accent line**: 3px left border, brand gradient or red-500

### 3.7 Button Patterns

#### Primary (CTA)
- Background: bg-brand-orange or marion-gradient
- Text: white, font-bold
- Padding: px-4 py-2
- Border radius: xl (16px) or full
- Dark mode: glow shadow effect
- Hover: bg-orange-600 or scale 1.05

#### Secondary
- Background: transparent or slate-100
- Text: slate-700
- Border: 1px slate-200
- Hover: bg-slate-50

#### Ghost / Icon
- Background: transparent
- Padding: p-2
- Border radius: full
- Hover: bg-slate-100 (light) | bg-slate-800 (dark)

### 3.8 Input Pattern
- Background: slate-50 (light) | slate-900 (dark)
- Border: 1px slate-200 (light) | slate-600 (dark)
- Border radius: xl (16px)
- Padding: px-3 py-2
- Text: sm, slate-800 | white
- Placeholder: slate-400
- Focus: ring-2 ring-brand-orange
- States: Default, Focus, Error (ring-red-500), Disabled (opacity-50)

### 3.9 ProjectCard

**Base**: Card component + status-specific colors
**Hover**: scale 1.03, 500ms transition

**Layout** (vertical):
1. **Glow orbs** (absolute, background blur, theme-colored)
2. **Left accent bar**: 6px wide, full height, status-colored
3. **Health indicator**: 8px dot, top-right (emerald/amber/red)
4. **Header row**:
   - Avatar: 44px (mobile) → 56px (desktop), rounded-2xl → rounded-3xl
   - Client name: Montserrat 700, text-lg
   - Phase name: Raleway 400, text-xs, muted
   - Badge: workflow phase color
5. **Progress bar**: h-2, bg-slate-100 | slate-700, rounded-full
6. **Stats row** (4 items): pending tasks, pending amount (CHF), total revenue, unread emails
7. **Footer**: Next deadline or next task, text-xs, muted

### 3.10 Search Bar (Cmd+K)

**Trigger**: In toolbar, magnifier icon
**Modal overlay**: 
- Centered, max-w-xl
- Input: large, auto-focus, placeholder "Rechercher..."
- Results: scrollable list, grouped by category
- Keyboard navigation: up/down arrows, enter to select
- Shortcut hint: "Cmd+K" badge

### 3.11 Notification Toast (NotificationSystem)

**Types with styling**:
| Type | Border Left | Icon BG | Icon Color |
|------|------------|---------|------------|
| Success | emerald-500 | emerald-50 | emerald-500 |
| Error | red-500 | red-50 | red-500 |
| Warning | amber-500 | amber-50 | amber-500 |
| Info | blue-500 | blue-50 | blue-500 |
| AI | purple-500 | purple-50 | purple-500 |
| Finance | amber-500 | amber-50 | amber-500 |
| Deadline | orange-500 | orange-50 | orange-500 |

---

## Page 4 : Layout & Navigation

### 4.1 AppHeader

#### Desktop (md+)
**Container**: sticky top-0, transparent bg with no blur on desktop

**Layout**: justify-between, items-center, px-6, py-4

**Left side**:
- Logo: 56px (w-14 h-14), rounded
- Text: "Eonora Tech OS" — Montserrat 700, text-lg, gradient text (brand-orange → brand-pink)
  - Fades out on scroll (opacity transition)

**Right side - Toolbar pill**:
- Container: bg-white/70 | slate-800/40, px-3 py-1.5, rounded-full, border slate-200/50
- Items (left to right):
  1. **Briefing CTA**: gradient bg (marion-gradient), white text, rounded-full, px-3 py-1
  2. **Search** (magnifier icon)
  3. **Notes** (sticky note icon)
  4. **Media Workshop** (image icon)
  5. **Focus Mode** (coffee icon)
  6. **Goals & KPIs** (target icon)
  7. **Templates** (file-text icon)
  8. **Emails** (mail icon) + unread badge
  9. **Messaging** (message-circle icon) + unread badge
  10. **File Dispatcher** (bot icon)
  11. Divider: 1px w, h-5, bg-slate-200 | slate-700
  12. **Theme toggle** (sun/moon icon)
  13. **Settings** (settings icon)
  14. **Guide** (compass icon)
  15. Divider
  16. **Notifications** (bell icon) + unread count badge
  17. **Franck status pill**: dot indicator (green=connected, red=disconnected) + "Franck" label + dropdown

**Toolbar button style**: p-2, rounded-full, text-slate-500, hover:bg-slate-100 | hover:bg-slate-800

#### Mobile (<md)
**Container**: sticky, bg-white/70 | slate-900/40, backdrop-blur-md, border-b

**Layout**: 
- Left: Logo 36px, "Eonora Tech OS" text
- Right: Notifications bell (orange), Franck status pill, Hamburger menu

**MobileDrawer**: Slide-in from right, full-height panel with all toolbar items listed vertically

### 4.2 Footer
- Fixed bottom
- Text: "Designer avec coeur par JV Automation" — Raleway 300, text-xs, slate-400
- Centered

### 4.3 Page Layout
```
[Header - sticky top-0 z-50]
[Main - max-w-[1400px] mx-auto px-2 sm:px-3 md:px-6]
  [Outlet / Page Content]
[Footer - fixed bottom]
```

---

## Page 5 : Ecrans

### 5.1 Auth & Onboarding

#### Login Screen
- Centered card on gradient background
- Logo + title
- Password input field
- Submit button (marion-gradient)
- Error state: red text below input

#### Onboarding (4 steps)
1. **Intro**: Welcome message, Marion logo, "Commencer" button
2. **API Key Input**: Text input for Gemini API key, validation
3. **Installing**: Loading animation, progress bar
4. **Success**: Check icon, success message, "Entrer" button

#### Splash Screen
- Full screen, centered
- Logo with float animation
- Loading bar below (marion-gradient, 2.5s)

#### Backend Down
- Full screen error
- Red/orange icon
- Title: "Serveur Franck Indisponible"
- Retry button

### 5.2 Dashboard

**Layout**: Responsive grid

**Sections** (top to bottom):
1. **Welcome header**: "Bonjour Marion" + date
2. **Monday Briefing** (if Monday): AI-generated summary card
3. **Project Cards Grid**: 2-3 columns, ProjectCard components
4. **Sidebar widgets** (right on desktop, below on mobile):
   - **Agenda Widget**: Day/week/month toggle, event list
   - **Financial Health Widget**: "Yacht Bar" progress bar toward 300k CHF
     - Net profit, revenue vs expenses
     - Circular or linear progress
   - **Email Widget**: Recent unread emails, compact list
   - **Activity Feed**: Recent actions (invoice sent, project updated, etc.)
   - **Maintenance Widget**: Upcoming maintenance tasks

### 5.3 Client Detail

**Header**:
- Back button → Dashboard
- Client name (H2)
- Status badge
- Actions: Edit, Archive, Delete

**Workflow Timeline**:
- Horizontal stepper, 6 phases
- Each phase: colored circle + label
- Active phase highlighted with gradient
- Colors: Discovery (yellow), Strategy (blue), Design (pink), Dev (purple), QA (orange), Maintenance (emerald)

**Tab navigation**:
| Tab | Content |
|-----|---------|
| Kanban | Task columns (To Do, In Progress, Review, Done), draggable cards |
| Invoices | List of invoices/estimates, status badges, amounts |
| Time Tracking | Time entries, timer, weekly summary |
| Files | File grid/list, upload, folders |
| Brand Kit | Colors, fonts, logos for this client |
| Portal Config | Public portal settings, PIN, language, sections toggle |

### 5.4 Invoice Builder

**Header**: Back button, "Facture #XXX" title, Save/Export actions

**Two-panel layout**:
- **Left: Form**
  - Emitter info (from settings)
  - Recipient info (from client)
  - Invoice details: number, date, due date, reference
  - Line items table: description, quantity, unit price, total
  - Add line button
  - Subtotal, VAT, Total
  - Notes / conditions
  - Payment info: IBAN, QR code toggle

- **Right: PDF Preview**
  - Live preview of the invoice
  - A4 proportions
  - Print/Export button

**Actions toolbar**: Save draft, Send, Export PDF, Copy link

### 5.5 Finances

**Header**: "Finances" title, date range picker, currency (CHF)

**Dashboard cards row**:
- Total Revenue (card, green)
- Total Expenses (card, red)
- Net Profit (card, brand gradient)
- "Yacht Bar" (card, progress toward 300,000 CHF)

**Charts section**:
- Revenue vs Expenses bar chart (monthly)
- Profit trend line chart
- Revenue by client pie/donut chart

**Invoice list**:
- Table: Client, Invoice #, Amount, Status (badge), Date, Actions
- Filters: Status (all/paid/pending/overdue), search
- Pagination

### 5.6 Email Client

**Three-panel layout** (desktop):

**Left - Sidebar** (w-64):
- Account info
- Folders: Inbox (count), Sent, Drafts, Archive, Trash
- Labels/tags

**Center - Email List** (flex-1):
- Search bar
- Sort: date, sender
- Email rows: sender avatar, name, subject, preview, time, read/unread indicator
- Selected state: bg-brand-orange/10

**Right - Email Reader** (flex-1):
- Header: sender, recipients, date, subject
- Actions: Reply, Forward, Archive, Delete, Mark as read
- Body: rendered HTML/text
- Attachments bar

**Compose modal**:
- To, CC, BCC fields
- Subject
- Rich text editor
- Attachments
- Send button (brand gradient)

### 5.7 Settings

**Layout**: Single column, max-w-3xl, centered

**Sections**:
1. **Theme**: 3 cards (Light, Dark/Space, Unicorn) with preview thumbnails, selected state
2. **Accent Color**: 4 color swatches (orange, blue, emerald, violet), selected ring
3. **Agency Config**: Name, address, SIRET, logo upload, IBAN
4. **Notifications**: Toggle switches for email, push, sound
5. **AI Tone** (Franck): Slider or select for tone (professional, friendly, casual)
6. **Language**: FR/EN/ES selector
7. **Data**: Export, import, reset

### 5.8 Client Portal

**Standalone layout** (no AppHeader):

#### Auth Screen
- Logo
- PIN input (4-6 digits)
- Language selector (FR/EN/ES flags)
- Submit button

#### Portal Dashboard
**Header**: Client logo + name, language switcher

**Navigation tabs**:
| Section | Content |
|---------|---------|
| Overview | Project status, workflow progress, key metrics |
| Activity | Timeline of updates, milestones |
| Files | Downloadable deliverables, organized by phase |
| Subscription | Billing status, renewal date, plan details |
| Documents | Contracts, proposals, signed documents |
| Comments | Threaded discussion, file attachments |
| Upload | Client file upload area |

---

## Page 6 : Overlays & Outils

### 6.1 Franck Chat
- **Trigger**: Franck pill in header or floating button
- **Panel**: Right slide-in or bottom sheet (mobile)
- Width: 400px (desktop)
- **Header**: "Franck" + AI icon + close
- **Messages**: Chat bubbles
  - User: right-aligned, brand-orange bg, white text
  - Franck: left-aligned, glass bg, dark text
- **Input**: Bottom, text input + send button + attachments
- **Typing indicator**: 3 animated dots

### 6.2 Global Search (Cmd+K)
- **Overlay**: Centered modal, max-w-xl
- **Input**: Large, 48px height, auto-focus, magnifier icon
- **Results**: Grouped by type (Projects, Clients, Invoices, Events)
- **Item**: Icon + title + subtitle + keyboard shortcut hint
- **Navigation**: Arrow keys, Enter to select, Esc to close

### 6.3 Quick Notes
- **Modal**: max-w-lg
- **Content**: Simple text area, auto-save
- **Actions**: Copy, clear, close

### 6.4 File Explorer
- **Modal**: max-w-4xl
- **Sidebar**: Folder tree
- **Content**: File grid or list view toggle
- **Actions**: Upload, create folder, rename, delete, download

### 6.5 File Dispatcher
- **Modal**: Drag & drop zone
- **States**: Empty (drop zone), uploading (progress), complete (checkmark)
- **Description**: "Donnez des fichiers a Franck"

### 6.6 Document Templates
- **Modal**: max-w-4xl
- **Grid**: Template cards with previews
- **Categories**: Contracts, proposals, briefs, reports
- **Actions**: Use template, preview, edit

### 6.7 Goals & KPIs
- **Modal**: max-w-2xl
- **Content**: Goal cards with progress bars
- **Metrics**: Revenue target, client count, project completion rate

### 6.8 Messaging Hub
- **Modal**: max-w-3xl
- **Layout**: Conversation list + message view
- **Channels**: Client conversations, team

### 6.9 What's New
- **Panel**: Right slide-in
- **Content**: Release notes, feature cards with screenshots
- **Version badges**

### 6.10 Bug Reporter
- **Modal**: max-w-lg
- **Form**: Title, description, screenshot upload, severity select
- **Submit**: Brand button

### 6.11 PWA Install Prompt
- **Banner**: Bottom fixed, glass bg
- **Content**: App icon + "Installer Eonora Tech OS" + Install/Dismiss buttons

### 6.12 Tour Guide
- **Overlay**: Step-by-step tooltips pointing to UI elements
- **Progress**: Step counter, next/prev/skip
- **Highlight**: Target element with spotlight effect

### 6.13 Media Studio
**Full-screen modal**:
- **Top toolbar**: Tool selection
- **Canvas center**: Image editing area
- **Right panels** (tabbed):
  - AI: AI-powered editing prompts
  - Adjust: Brightness, contrast, saturation sliders
  - Resize: Width, height, presets
  - Export: Format, quality, download
- **Bottom toolbar**: Zoom, undo/redo
- **Upload view**: Initial drag & drop state

### 6.14 Brand Center
- **Modal**: max-w-4xl
- **Sections**: Colors palette, typography showcase, logo variations, usage guidelines
- **Per-client**: Client-specific brand assets

### 6.15 Logo Lab
- **Modal**: max-w-3xl
- **Canvas**: Logo preview area with different backgrounds
- **Tools**: Color picker, size adjustment, export formats

### 6.16 Focus Mode
- **Full overlay**: Dims entire UI
- **Center**: Current task card, timer
- **Ambient**: Sound player controls (nature, music, white noise)
- **Exit**: Escape or button

### 6.17 Meeting Mode
- **Full overlay**: Clean presentation view
- **Features**: Voice recognition indicator, notes panel
- **Timer**: Meeting duration
- **Controls**: Mic toggle, end meeting

---

## Notification Center Panel

**Trigger**: Bell icon in header
**Panel**: Dropdown, w-96, max-h-600px, top-right

**Header**: "Notifications" title, unread count badge, "Mark all read" + "Clear all" actions

**Items**:
- Unread: Highlighted background
- Read: opacity-80, slight grayscale
- Each item: Type icon (colored circle), title, time ago, message preview
- Hover actions: Mark read (check), Delete (trash)
- Optional action button or "Voir" link

---

## Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | <640px | Single column, bottom sheets for modals, hamburger menu |
| SM | 640px | Slight padding increase |
| MD | 768px | Header toolbar visible, modals centered, 2-col layouts |
| LG | 1024px | Full 3-panel layouts (email), sidebar widgets |
| XL | 1280px | Max content width approaches 1400px |

---

## FigJam Diagrams (generated)

1. **App Structure & Navigation** - Route map and navigation flows
2. **Design System Structure** - Token and component hierarchy
3. **User Flows** - Auth flow and main user journeys
4. **Workflow Timeline Phases** - 6 project phases state diagram

---

## Figma File Organization

```
Eonora Tech OS.fig
├── Page 1: Cover & Documentation
│   ├── Cover (1440x900)
│   ├── Table of Contents
│   └── Conventions & Changelog
├── Page 2: Foundations
│   ├── Color Palette (Brand, Accent, Neutral, Pastel, Semantic)
│   ├── Theme Backgrounds (Light, Dark, Unicorn)
│   ├── Gradients
│   ├── Typography Scale
│   ├── Spacing Scale
│   ├── Border Radius
│   ├── Effects (Glass, Shadows, Glows)
│   └── Icons Reference
├── Page 3: Components
│   ├── Badge (9 colors x 3 themes)
│   ├── Card (3 themes)
│   ├── Modal (desktop + mobile x 3 themes)
│   ├── Tooltip
│   ├── Empty State
│   ├── Toast (7 types x 3 themes)
│   ├── Button (Primary, Secondary, Ghost x 3 themes x states)
│   ├── Input (Default, Focus, Error, Disabled x 3 themes)
│   ├── ProjectCard (5 statuses x 3 themes)
│   └── Search Bar
├── Page 4: Layout
│   ├── AppHeader Desktop (3 themes)
│   ├── AppHeader Mobile (3 themes)
│   ├── MobileDrawer
│   ├── Footer
│   └── Page Template
├── Page 5: Screens
│   ├── 5.1 Login, Onboarding (4 steps), Splash, Backend Down
│   ├── 5.2 Dashboard
│   ├── 5.3 Client Detail (6 tabs)
│   ├── 5.4 Invoice Builder
│   ├── 5.5 Finances
│   ├── 5.6 Email Client
│   ├── 5.7 Settings
│   └── 5.8 Client Portal (auth + dashboard)
└── Page 6: Overlays & Tools
    ├── Franck Chat
    ├── Global Search
    ├── Quick Notes
    ├── File Explorer
    ├── File Dispatcher
    ├── Document Templates
    ├── Goals & KPIs
    ├── Messaging Hub
    ├── What's New
    ├── Bug Reporter
    ├── PWA Install Prompt
    ├── Tour Guide
    ├── Media Studio
    ├── Brand Center
    ├── Logo Lab
    ├── Focus Mode
    └── Meeting Mode
```
