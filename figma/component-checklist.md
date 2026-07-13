# Eonora Tech OS - Figma Component Checklist

> Checklist of every component, screen, and state to build in Figma.
> Each item should exist in Light, Dark (Space), and Unicorn themes.

---

## Foundations (tokens.json ready for import)

- [ ] Color palette swatches (Brand, Accent, Neutral, Pastel, Semantic)
- [ ] Theme backgrounds (Light gradient, Dark space, Unicorn pastel)
- [ ] Gradient samples (Marion, Sunset, Space, Unicorn)
- [ ] Typography scale (H1-H6, Body, Body SM, Caption, Label, Overline)
- [ ] Spacing scale visual (4-8-12-16-20-24-32-48-64)
- [ ] Border radius scale visual (4-8-12-16-24-28-32-full)
- [ ] Glass effect samples (Light, Dark, Unicorn)
- [ ] Shadow samples (SM, MD, LG, XL, 2XL)
- [ ] Dark mode glow effects (Brand, Hover, Firefly)
- [ ] Lucide icon reference sheet

---

## Primitive Components

### Badge
- [ ] 9 color variants (green, blue, purple, yellow, gray, red, pink, orange, brand)
- [ ] Light theme x 9
- [ ] Dark theme x 9
- [ ] Unicorn theme x 9
- [ ] Default state
- [ ] Hover state (clickable)

### Button
- [ ] Primary (brand gradient) — Default, Hover, Active, Disabled, Focus
- [ ] Secondary (outline) — Default, Hover, Active, Disabled, Focus
- [ ] Ghost (transparent) — Default, Hover, Active, Disabled
- [ ] Icon-only (circle) — Default, Hover, Active
- [ ] All above x 3 themes
- [ ] Dark mode glow effect on Primary

### Card
- [ ] Default glass card — Light, Dark, Unicorn
- [ ] Hover state (scale 1.03)
- [ ] Selected state (brand border)

### Modal
- [ ] Desktop centered (rounded-4xl, zoom animation) — Light, Dark, Unicorn
- [ ] Mobile bottom sheet (rounded-t-3xl, drag handle) — Light, Dark, Unicorn
- [ ] Backdrop (black/30 + blur)
- [ ] Header with close button
- [ ] Content area
- [ ] With/without content padding

### Tooltip
- [ ] Below trigger position — Light, Dark, Unicorn
- [ ] Arrow pointer

### Empty State
- [ ] With icon, title, message, action button — Light, Dark, Unicorn
- [ ] Without action button

### Input / Textarea / Select
- [ ] Default, Focus (ring-brand), Error (ring-red), Disabled, Filled
- [ ] All above x 3 themes
- [ ] With label
- [ ] With error message

### Toggle / Checkbox
- [ ] On / Off states x 3 themes

### Toast
- [ ] Success, Error, Warning, Info, AI, Finance, Deadline
- [ ] All above x Light, Dark
- [ ] Slide-in animation reference
- [ ] Toast container (top-right stack)

---

## Business Components

### ProjectCard
- [ ] Status: EN_COURS — Light, Dark, Unicorn
- [ ] Status: MAINTENANCE — Light, Dark, Unicorn
- [ ] Status: ASSOCIATION — Light, Dark, Unicorn
- [ ] Status: PROSPECT — Light, Dark, Unicorn
- [ ] Status: ARCHIVED — Light, Dark, Unicorn
- [ ] Health indicators: Good (green), Warning (amber), Critical (red)
- [ ] Hover state with glow orbs
- [ ] With/without next deadline
- [ ] With/without pending invoices

### Search Bar (Cmd+K)
- [ ] Trigger state (in toolbar)
- [ ] Open modal with empty input
- [ ] With search results (grouped)
- [ ] Keyboard navigation highlight

### Notification Center Panel
- [ ] Closed (bell icon + count)
- [ ] Open panel with unread items
- [ ] Open panel with all read
- [ ] Empty state
- [ ] Item: unread, read, with action

---

## Layout Components

### AppHeader - Desktop
- [ ] Light theme full toolbar
- [ ] Dark theme full toolbar
- [ ] Unicorn theme full toolbar
- [ ] Franck dropdown open
- [ ] With notification badge count
- [ ] With unread email badge

### AppHeader - Mobile
- [ ] Light, Dark, Unicorn
- [ ] MobileDrawer open state

### Footer
- [ ] Light, Dark, Unicorn

### Page Template
- [ ] Desktop 1440px frame with header + content + footer
- [ ] Mobile 375px frame with header + content + footer

---

## Screens (each in Light, Dark, Unicorn + Desktop 1440px, Mobile 375px)

### Auth & Onboarding
- [ ] Login Screen — Default
- [ ] Login Screen — Error state
- [ ] Onboarding Step 1: Welcome
- [ ] Onboarding Step 2: API Key Input
- [ ] Onboarding Step 3: Installing (loading)
- [ ] Onboarding Step 4: Success
- [ ] Splash Screen
- [ ] Backend Down Screen

### Dashboard
- [ ] Full dashboard with all widgets
- [ ] Monday Briefing visible
- [ ] Empty state (no projects)

### Client Detail
- [ ] Kanban tab active
- [ ] Invoices tab active
- [ ] Time Tracking tab active
- [ ] Files tab active
- [ ] Brand Kit tab active
- [ ] Portal Config tab active
- [ ] Workflow Timeline (each phase highlighted)

### Invoice Builder
- [ ] New invoice (empty)
- [ ] Invoice with line items
- [ ] PDF preview visible
- [ ] Export/send actions

### Finances
- [ ] Full dashboard with charts
- [ ] Invoice list with filters
- [ ] Yacht Bar progress

### Email Client
- [ ] Three-panel layout
- [ ] Email selected/reading
- [ ] Compose modal open
- [ ] Empty inbox state
- [ ] Mobile: list view only

### Settings
- [ ] Theme selection highlighted
- [ ] Accent color selected
- [ ] Agency config section
- [ ] All sections visible

### Client Portal
- [ ] PIN auth screen
- [ ] Portal dashboard — Overview tab
- [ ] Portal dashboard — Files tab
- [ ] Portal dashboard — Comments tab
- [ ] Language: FR, EN, ES variants

---

## Overlays (each in Light, Dark, Unicorn)

- [ ] Franck Chat — Empty, with messages, typing indicator
- [ ] Global Search — Empty, with results
- [ ] Quick Notes — With content
- [ ] File Explorer — Grid view, list view
- [ ] File Dispatcher — Empty drop zone, uploading, complete
- [ ] Document Templates — Grid of templates
- [ ] Goals & KPIs — With progress bars
- [ ] Messaging Hub — Conversation list + message view
- [ ] What's New — Release notes
- [ ] Bug Reporter — Empty form, filled form
- [ ] PWA Install Prompt — Banner
- [ ] Tour Guide — Step tooltip with spotlight

---

## Creative Tools (each in Light, Dark, Unicorn)

- [ ] Media Studio — Upload view
- [ ] Media Studio — Editing with canvas + panels
- [ ] Brand Center — Color palette + typography section
- [ ] Logo Lab — Logo on different backgrounds

---

## Special Modes

- [ ] Focus Mode — Active with timer
- [ ] Meeting Mode — Active with mic indicator

---

## Total Estimated Frames

| Category | Frames (approx) |
|----------|-----------------|
| Foundations | ~15 |
| Components (primitives) | ~120 (variants x themes x states) |
| Business components | ~40 |
| Layout | ~20 |
| Screens (desktop x3 themes) | ~75 |
| Screens (mobile x3 themes) | ~75 |
| Overlays x3 themes | ~60 |
| Creative tools x3 themes | ~15 |
| Special modes | ~10 |
| **Total** | **~430 frames** |
