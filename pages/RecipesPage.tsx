/**
 * RecipesPage — Bibliothèque de recettes WordPress -> React/Tailwind
 *
 * Pour chaque pattern WP courant que Marion connaît bien, une fiche :
 *  - explication courte
 *  - équivalent moderne (stack + libs)
 *  - snippet de code copy-able
 *  - prompt Cursor associé
 *  - bouton "Demander à Franck" (ouvre /chat avec contexte recette)
 *
 * Recettes seedées en dur (12) — Marion peut en ajouter via le bouton "Créer".
 * La liste enrichie est persistée en localStorage (`wp_recipes_custom`).
 *
 * Sidebar : WpGlossary (lookup d'un terme WP isolé).
 */

import React, { useMemo, useState } from 'react';
import {
    BookOpen, Search, Copy, Check, Sparkles, Plus, X, Trash2, Tag,
    ArrowLeft, MessageSquare, ExternalLink, AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WpGlossary } from '../components/WpGlossary';

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------

export type RecipeCategory =
    | 'cms' | 'forms' | 'seo' | 'layout'
    | 'ecommerce' | 'routing' | 'content' | 'misc';

export interface WpRecipe {
    id: string;
    wp_term: string;
    modern_term: string;
    category: RecipeCategory;
    summary: string;
    snippet_code: string;
    snippet_lang: 'tsx' | 'ts' | 'js' | 'jsx' | 'sh' | 'html' | 'json';
    cursor_prompt: string;
    docs_url?: string;
    custom?: boolean;
}

const CATEGORIES: { id: RecipeCategory | 'all'; label: string; emoji: string }[] = [
    { id: 'all', label: 'Toutes', emoji: '🌐' },
    { id: 'cms', label: 'CMS / Données', emoji: '📦' },
    { id: 'forms', label: 'Formulaires', emoji: '✉️' },
    { id: 'seo', label: 'SEO', emoji: '🔍' },
    { id: 'layout', label: 'Layout', emoji: '🧱' },
    { id: 'ecommerce', label: 'E-commerce', emoji: '🛒' },
    { id: 'routing', label: 'Routing', emoji: '🛣️' },
    { id: 'content', label: 'Contenu', emoji: '📝' },
    { id: 'misc', label: 'Divers', emoji: '🛠️' },
];

const DEFAULT_RECIPES: WpRecipe[] = [
    {
        id: 'acf-customfields',
        wp_term: 'ACF Custom Fields',
        modern_term: 'TypeScript interface + headless CMS (Sanity / Contentful)',
        category: 'cms',
        summary: "Plutôt qu'enregistrer des champs personnalisés via ACF, définis le schéma directement en TypeScript (et/ou dans Sanity si tu veux que le client édite).",
        snippet_lang: 'ts',
        snippet_code: `// types/case-study.ts
export interface CaseStudy {
  slug: string;
  title: string;
  client: string;
  hero_image: string;
  context: string;
  results: { label: string; value: string }[];
  tech_stack: string[];
  publishedAt: string;
}

// Sanity equivalent (sanity/schemas/caseStudy.ts)
export default {
  name: 'caseStudy',
  type: 'document',
  fields: [
    { name: 'title', type: 'string', validation: r => r.required() },
    { name: 'client', type: 'string' },
    { name: 'hero_image', type: 'image', options: { hotspot: true } },
    { name: 'results', type: 'array', of: [{ type: 'object', fields: [
      { name: 'label', type: 'string' },
      { name: 'value', type: 'string' },
    ]}]},
  ],
};`,
        cursor_prompt: `Crée un schéma Sanity pour un type "caseStudy" avec : titre, slug, client, image hero (hotspot), contexte (portable text), résultats (array de {label, value}), stack tech (array string), date de publication. Génère aussi l'interface TypeScript correspondante côté front.`,
        docs_url: 'https://www.sanity.io/docs/schema-types',
    },
    {
        id: 'cf7-react-form',
        wp_term: 'Contact Form 7',
        modern_term: 'React Hook Form + Resend / Formspree',
        category: 'forms',
        summary: "Remplace CF7 (qui dépend de WP) par un formulaire React validé côté client, envoyé via une API d'email transactionnel (Resend / Formspree / SendGrid).",
        snippet_lang: 'tsx',
        snippet_code: `import { useForm } from 'react-hook-form';

type Form = { name: string; email: string; message: string };

export function ContactForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>();

  const onSubmit = async (data: Form) => {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) alert('Erreur, retente.');
    else alert('Merci, message envoyé !');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input {...register('name', { required: true })} placeholder="Ton nom" />
      <input {...register('email', { required: true, pattern: /^\\S+@\\S+$/ })} type="email" placeholder="Email" />
      <textarea {...register('message', { required: true, minLength: 10 })} rows={4} />
      <button disabled={isSubmitting}>{isSubmitting ? 'Envoi…' : 'Envoyer'}</button>
    </form>
  );
}`,
        cursor_prompt: `Crée un formulaire de contact accessible en React + Tailwind avec react-hook-form. Champs : nom, email (regex), message (min 10 caractères). États loading/success/error. Soumission POST vers /api/contact qui appelle Resend pour envoyer un email transactionnel.`,
        docs_url: 'https://react-hook-form.com',
    },
    {
        id: 'woocommerce-stripe',
        wp_term: 'WooCommerce checkout',
        modern_term: 'Stripe Checkout (sessions hosted) ou Shopify Storefront API',
        category: 'ecommerce',
        summary: "Pour des produits simples (1-50 SKUs), utilise Stripe Checkout : tu crées une session, Stripe héberge la page de paiement, tu reçois un webhook quand c'est payé.",
        snippet_lang: 'ts',
        snippet_code: `// app/api/checkout/route.ts (Next.js)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET!);

export async function POST(req: Request) {
  const { items } = await req.json();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: items.map((i: any) => ({
      price_data: {
        currency: 'eur',
        product_data: { name: i.name, images: i.images },
        unit_amount: i.priceCents,
      },
      quantity: i.qty,
    })),
    success_url: \`\${req.headers.get('origin')}/merci\`,
    cancel_url: \`\${req.headers.get('origin')}/panier\`,
  });
  return Response.json({ url: session.url });
}`,
        cursor_prompt: `Crée une route Next.js /api/checkout qui prend une liste d'items du panier et crée une session Stripe Checkout en EUR. Items: { name, images, priceCents, qty }. URLs de retour /merci et /panier. Côté front, ajoute une fonction goToCheckout(items) qui POST puis window.location = url.`,
        docs_url: 'https://stripe.com/docs/payments/checkout',
    },
    {
        id: 'yoast-nextseo',
        wp_term: 'Yoast SEO',
        modern_term: "Next.js Metadata API + génération d'images OG dynamiques",
        category: 'seo',
        summary: "Next.js gère nativement title/description/OG/JSON-LD via l'export `metadata` ou `generateMetadata`. Plus besoin de plugin.",
        snippet_lang: 'tsx',
        snippet_code: `// app/blog/[slug]/page.tsx
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug);
  return {
    title: \`\${post.title} — Studio Marion\`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [{ url: \`/api/og?slug=\${params.slug}\` }],
      type: 'article',
      publishedTime: post.publishedAt,
    },
    twitter: { card: 'summary_large_image' },
    alternates: { canonical: \`/blog/\${params.slug}\` },
  };
}`,
        cursor_prompt: `Implémente generateMetadata pour une page article avec : title (suffixé du nom du studio), description = excerpt, OG image dynamique via /api/og?slug=, type article + publishedTime, twitter summary_large_image, canonical. Bonus : ajoute un JSON-LD Article via un <script type="application/ld+json">.`,
        docs_url: 'https://nextjs.org/docs/app/api-reference/functions/generate-metadata',
    },
    {
        id: 'elementor-shadcn',
        wp_term: 'Sections Elementor (drag-and-drop)',
        modern_term: 'shadcn/ui + Tailwind + composants composables',
        category: 'layout',
        summary: "shadcn/ui te donne des composants accessibles (Button, Dialog, Tabs, Accordion…) que tu copies dans ton repo et personnalises librement avec Tailwind.",
        snippet_lang: 'sh',
        snippet_code: `# Init dans un projet Next.js + Tailwind
npx shadcn@latest init

# Ajouter des composants
npx shadcn@latest add button dialog tabs accordion card sheet

# Le code est copié dans ton repo (components/ui), à toi de le styler.`,
        cursor_prompt: `Initialise shadcn/ui dans un projet Next.js 15 + Tailwind v4. Ajoute Button, Card, Tabs, Sheet, Accordion. Configure le theme avec mes couleurs primaires #7C9A7E et accent #23262B, radius 0.75rem.`,
        docs_url: 'https://ui.shadcn.com/docs',
    },
    {
        id: 'wp-menu-react-nav',
        wp_term: 'wp_nav_menu()',
        modern_term: 'Composant Nav React + Sheet mobile (Framer Motion)',
        category: 'layout',
        summary: "Le menu WP devient un simple composant React avec un état d'ouverture mobile, animé via Framer Motion (ou les sheets shadcn).",
        snippet_lang: 'tsx',
        snippet_code: `'use client';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';

const items = [
  { href: '/', label: 'Accueil' },
  { href: '/services', label: 'Services' },
  { href: '/contact', label: 'Contact' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
      <div className="container flex items-center justify-between h-16">
        <Link href="/" className="font-bold">Marion</Link>
        <nav className="hidden md:flex gap-6">
          {items.map(i => <Link key={i.href} href={i.href}>{i.label}</Link>)}
        </nav>
        <button className="md:hidden" onClick={() => setOpen(true)}><Menu /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-white">
          <button className="absolute top-4 right-4" onClick={() => setOpen(false)}><X /></button>
          <nav className="flex flex-col items-center justify-center h-full gap-6 text-2xl">
            {items.map(i => <Link key={i.href} href={i.href} onClick={() => setOpen(false)}>{i.label}</Link>)}
          </nav>
        </div>
      )}
    </header>
  );
}`,
        cursor_prompt: `Crée un composant Nav React responsive avec sticky header, blur background, menu desktop horizontal, et sheet plein écran mobile animé (entrée slide-from-right). Items configurables via prop. Accessible : focus ring, fermeture sur Escape, blocage du scroll quand ouvert.`,
    },
    {
        id: 'cpt-sanity',
        wp_term: 'Custom Post Types (CPT)',
        modern_term: 'Documents Sanity ou MDX collections (Contentlayer / Velite)',
        category: 'cms',
        summary: "Pour 'projets', 'témoignages', 'membres'... soit un schéma Sanity (le client édite), soit MDX local (commit-driven, parfait pour Marion seule).",
        snippet_lang: 'ts',
        snippet_code: `// content/projects/site-cafe-louise.mdx
---
title: Site Café Louise
client: Café Louise
hero: /projects/cafe-louise/hero.jpg
date: 2026-04-12
results:
  - label: Trafic
    value: +180%
tech: [Next.js, Sanity, Stripe]
---

Le café Louise voulait un site qui transmette son ambiance...

// app/projects/[slug]/page.tsx
import { allProjects } from 'velite/generated';

export default function Project({ params }) {
  const p = allProjects.find(x => x.slug === params.slug);
  return <ProjectLayout {...p} />;
}`,
        cursor_prompt: `Configure Velite pour gérer des fichiers MDX dans content/projects/. Schéma : title, client, hero, date, results (array {label,value}), tech (array string). Génère un type TypeScript et un index allProjects exportable.`,
        docs_url: 'https://velite.js.org',
    },
    {
        id: 'wp-loop-fetch',
        wp_term: 'WP Loop (the_post)',
        modern_term: 'fetch + .map() ou Server Components',
        category: 'content',
        summary: "Le 'Loop' WP = juste itérer sur des données. En React Server Components, tu fetch, tu map, c'est tout.",
        snippet_lang: 'tsx',
        snippet_code: `// app/blog/page.tsx (Server Component)
async function getPosts() {
  const res = await fetch('https://cms.example.com/api/posts', {
    next: { revalidate: 600 }, // ISR: re-cache toutes les 10 min
  });
  return res.json();
}

export default async function BlogPage() {
  const posts = await getPosts();
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {posts.map(p => (
        <li key={p.id}>
          <Link href={\`/blog/\${p.slug}\`}>
            <h2>{p.title}</h2>
            <p>{p.excerpt}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}`,
        cursor_prompt: `Crée une page Next.js Server Component qui fetch des articles depuis une API REST avec ISR (revalidate 600s). Affiche en grille responsive (1/2/3 colonnes). Card avec image hero, titre, excerpt, date. Skeleton loading via un loading.tsx adjacent.`,
    },
    {
        id: 'wp-permalinks-routing',
        wp_term: 'Permalinks & rewrite rules',
        modern_term: 'Routes dynamiques Next.js + redirections',
        category: 'routing',
        summary: "Les /%postname%/ deviennent des dossiers app/[slug]/page.tsx. Pour préserver le SEO d'un ancien site WP, on configure des 301 dans next.config.",
        snippet_lang: 'js',
        snippet_code: `// next.config.mjs
export default {
  async redirects() {
    return [
      // Préserver les anciens slugs WP au format /?p=42
      { source: '/', has: [{ type: 'query', key: 'p', value: '(?<id>.*)' }],
        destination: '/blog/redirect-from-id?id=:id', permanent: true },
      // Catégorie WP -> nouvelle structure
      { source: '/category/:slug', destination: '/blog?cat=:slug', permanent: true },
      // Anciennes pages renommées
      { source: '/a-propos', destination: '/about', permanent: true },
    ];
  },
};`,
        cursor_prompt: `Génère un next.config.mjs avec une fonction async redirects() qui : (1) capture les anciens permaliens WP /?p=ID via query params, (2) redirige /category/:slug vers /blog?cat=:slug en 301, (3) accepte un mapping JSON oldPath→newPath que je vais te fournir. Lis ce fichier mapping si présent.`,
        docs_url: 'https://nextjs.org/docs/app/api-reference/next-config-js/redirects',
    },
    {
        id: 'wp-widgets-slots',
        wp_term: 'Widget areas (sidebars)',
        modern_term: 'Composants composables + slots / parallel routes',
        category: 'layout',
        summary: "En React, les 'widget areas' deviennent juste des emplacements où tu mets les composants que tu veux. Avec Next.js App Router, les Parallel Routes vont encore plus loin.",
        snippet_lang: 'tsx',
        snippet_code: `// Approche simple : layout avec slots
export function PageWithSidebar({
  main, sidebar
}: { main: React.ReactNode; sidebar: React.ReactNode }) {
  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-8">
      <main>{main}</main>
      <aside className="space-y-6">{sidebar}</aside>
    </div>
  );
}

// Usage
<PageWithSidebar
  main={<BlogList />}
  sidebar={<>
    <NewsletterCard />
    <PopularPosts />
    <CategoryCloud />
  </>}
/>`,
        cursor_prompt: `Crée un composant <PageWithSidebar main sidebar /> avec un layout grid responsive (1 colonne mobile, 1fr+320px desktop). La sidebar a un space-y-6 entre ses éléments et reste sticky top-24 sur desktop.`,
    },
    {
        id: 'wp-shortcode-mdx',
        wp_term: 'Shortcodes ([shortcode])',
        modern_term: 'Composants MDX (import direct dans le contenu)',
        category: 'content',
        summary: "Les shortcodes WP étaient des morceaux dynamiques dans le HTML. En MDX, tu importes directement des composants React dans ton markdown.",
        snippet_lang: 'tsx',
        snippet_code: `// content/article.mdx
import Callout from '@/components/Callout';
import VideoPlayer from '@/components/VideoPlayer';

# Mon article

Texte normal en markdown.

<Callout type="warning">
  Ceci remplace ton ancien shortcode \`[warning]\`.
</Callout>

<VideoPlayer src="/videos/demo.mp4" autoplay={false} />

Suite du texte...`,
        cursor_prompt: `Crée un composant <Callout type variant icon /> avec types 'info' | 'warning' | 'success' | 'tip', icon Lucide auto par type, fond pastel + bordure left de la couleur du type, padding 4, dark mode. Markdown-friendly (children en richtext).`,
    },
    {
        id: 'wp-hooks-react-context',
        wp_term: 'Actions / Filters (do_action / apply_filters)',
        modern_term: 'React Context + Custom Hooks + Server Actions',
        category: 'misc',
        summary: "Les hooks WP servent à étendre le comportement. En React, tu utilises Context pour partager de l'état, des Custom Hooks pour la logique réutilisable, et Server Actions pour les mutations.",
        snippet_lang: 'tsx',
        snippet_code: `// hooks/useCart.ts — équivalent d'un filter WP "modify cart"
'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Item = { id: string; qty: number; price: number };
interface CartState {
  items: Item[];
  add: (i: Omit<Item, 'qty'>) => void;
  remove: (id: string) => void;
  total: () => number;
}

export const useCart = create<CartState>()(
  persist((set, get) => ({
    items: [],
    add: (i) => set(s => ({
      items: s.items.find(x => x.id === i.id)
        ? s.items.map(x => x.id === i.id ? { ...x, qty: x.qty + 1 } : x)
        : [...s.items, { ...i, qty: 1 }],
    })),
    remove: (id) => set(s => ({ items: s.items.filter(x => x.id !== id) })),
    total: () => get().items.reduce((acc, i) => acc + i.price * i.qty, 0),
  }), { name: 'cart-storage' })
);`,
        cursor_prompt: `Crée un store Zustand persisté (localStorage) pour un panier e-commerce : add(item), remove(id), updateQty(id, qty), clear(), total(). Items typés { id, name, price, qty, image? }. Expose un sélecteur useCartCount() qui retourne juste la somme des qty.`,
        docs_url: 'https://docs.pmnd.rs/zustand/integrations/persisting-store-data',
    },
];

const CUSTOM_RECIPES_KEY = 'wp_recipes_custom';

function loadCustomRecipes(): WpRecipe[] {
    try {
        const raw = localStorage.getItem(CUSTOM_RECIPES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveCustomRecipes(recipes: WpRecipe[]) {
    localStorage.setItem(CUSTOM_RECIPES_KEY, JSON.stringify(recipes));
}

// ---------------------------------------------------------------------------
// Recipe card
// ---------------------------------------------------------------------------

const RecipeCard: React.FC<{ recipe: WpRecipe; onDelete?: (id: string) => void }> = ({ recipe, onDelete }) => {
    const [copied, setCopied] = useState<'code' | 'prompt' | null>(null);
    const navigate = useNavigate();

    const copy = async (what: 'code' | 'prompt') => {
        const text = what === 'code' ? recipe.snippet_code : recipe.cursor_prompt;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(what);
            setTimeout(() => setCopied(null), 1200);
        } catch { /* noop */ }
    };

    const askFranck = () => {
        const seedMessage = `Aide-moi à migrer "${recipe.wp_term}" depuis WordPress vers ${recipe.modern_term}. Voici ce que je connais déjà : ${recipe.summary}`;
        try { sessionStorage.setItem('marion_franck_seed', seedMessage); } catch { /* noop */ }
        navigate('/');
        // Open Franck via global event
        window.dispatchEvent(new CustomEvent('marion:open-franck'));
    };

    return (
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden">
            <header className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                WordPress
                            </span>
                            <span className="text-slate-300">→</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                Modern
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{recipe.wp_term}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">{recipe.modern_term}</p>
                    </div>
                    {recipe.custom && onDelete && (
                        <button onClick={() => onDelete(recipe.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="Supprimer">
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{recipe.summary}</p>
            </header>

            <div className="p-4 md:p-5 space-y-3">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Snippet</span>
                        <button
                            onClick={() => copy('code')}
                            className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                        >
                            {copied === 'code' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                            {copied === 'code' ? 'Copié' : 'Copier'}
                        </button>
                    </div>
                    <pre className="bg-slate-900 dark:bg-black text-slate-100 rounded-xl p-3 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-64">
                        <code>{recipe.snippet_code}</code>
                    </pre>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Prompt Cursor</span>
                        <button
                            onClick={() => copy('prompt')}
                            className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                        >
                            {copied === 'prompt' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                            {copied === 'prompt' ? 'Copié' : 'Copier'}
                        </button>
                    </div>
                    <div className="bg-fuchsia-50 dark:bg-fuchsia-900/10 border border-fuchsia-200 dark:border-fuchsia-800 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-200 italic">
                        {recipe.cursor_prompt}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={askFranck}
                        className="flex items-center gap-1.5 text-xs font-semibold text-fuchsia-600 dark:text-fuchsia-400 hover:underline"
                    >
                        <MessageSquare size={13} /> Demander à Franck
                    </button>
                    {recipe.docs_url && (
                        <a
                            href={recipe.docs_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
                        >
                            <ExternalLink size={11} /> Docs officielles
                        </a>
                    )}
                </div>
            </div>
        </article>
    );
};

// ---------------------------------------------------------------------------
// Add custom recipe modal
// ---------------------------------------------------------------------------

const AddRecipeModal: React.FC<{ onClose: () => void; onAdd: (r: WpRecipe) => void }> = ({ onClose, onAdd }) => {
    const [wpTerm, setWpTerm] = useState('');
    const [modernTerm, setModernTerm] = useState('');
    const [summary, setSummary] = useState('');
    const [code, setCode] = useState('');
    const [prompt, setPrompt] = useState('');
    const [category, setCategory] = useState<RecipeCategory>('misc');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = () => {
        if (!wpTerm.trim() || !modernTerm.trim() || !summary.trim()) {
            setError('Les 3 premiers champs sont requis.');
            return;
        }
        onAdd({
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            wp_term: wpTerm.trim(),
            modern_term: modernTerm.trim(),
            summary: summary.trim(),
            snippet_code: code.trim() || '// À compléter',
            snippet_lang: 'tsx',
            cursor_prompt: prompt.trim() || 'À compléter',
            category,
            custom: true,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900">
                    <h2 className="font-bold text-slate-800 dark:text-white">Nouvelle recette</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Terme WP</label>
                            <input value={wpTerm} onChange={e => setWpTerm(e.target.value)} placeholder="Ex: Custom Taxonomies" className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-fuchsia-400" />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Catégorie</label>
                            <select value={category} onChange={e => setCategory(e.target.value as RecipeCategory)} className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none">
                                {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                                    <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Équivalent moderne</label>
                        <input value={modernTerm} onChange={e => setModernTerm(e.target.value)} placeholder="Ex: Sanity references + groq" className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-fuchsia-400" />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Résumé</label>
                        <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} placeholder="Pourquoi remplacer, comment l'aborder…" className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-fuchsia-400" />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Snippet de code (optionnel)</label>
                        <textarea value={code} onChange={e => setCode(e.target.value)} rows={6} placeholder="// Ton snippet…" className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono outline-none focus:border-fuchsia-400" />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Prompt Cursor (optionnel)</label>
                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="Cursor : génère…" className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-fuchsia-400" />
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-900">
                    <button onClick={onClose} className="px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Annuler</button>
                    <button onClick={handleSubmit} className="px-4 py-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-sm font-semibold">Ajouter</button>
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const RecipesPage: React.FC = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [activeCat, setActiveCat] = useState<RecipeCategory | 'all'>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [customRecipes, setCustomRecipes] = useState<WpRecipe[]>(() => loadCustomRecipes());

    const allRecipes = useMemo(
        () => [...customRecipes, ...DEFAULT_RECIPES],
        [customRecipes]
    );

    const filtered = useMemo(() => {
        const s = search.trim().toLowerCase();
        return allRecipes.filter(r => {
            if (activeCat !== 'all' && r.category !== activeCat) return false;
            if (!s) return true;
            return (
                r.wp_term.toLowerCase().includes(s)
                || r.modern_term.toLowerCase().includes(s)
                || r.summary.toLowerCase().includes(s)
            );
        });
    }, [allRecipes, search, activeCat]);

    const addCustom = (r: WpRecipe) => {
        const next = [r, ...customRecipes];
        setCustomRecipes(next);
        saveCustomRecipes(next);
    };

    const deleteCustom = (id: string) => {
        const next = customRecipes.filter(r => r.id !== id);
        setCustomRecipes(next);
        saveCustomRecipes(next);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
            <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
                <div>
                    <button onClick={() => navigate(-1)} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 mb-2">
                        <ArrowLeft size={13} /> Retour
                    </button>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <BookOpen className="text-blue-500" /> Recettes WordPress → React
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Pour chaque pattern WP que tu connais bien, son équivalent moderne avec snippet et prompt Cursor.
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-sm font-semibold"
                >
                    <Plus size={14} /> Créer une recette
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 space-y-4">
                    {/* Search + filters */}
                    <div className="space-y-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Chercher une recette…"
                                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-blue-400"
                            />
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {CATEGORIES.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setActiveCat(c.id)}
                                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                                        activeCat === c.id
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {c.emoji} {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid */}
                    {filtered.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Tag size={32} className="mx-auto mb-2 opacity-40" />
                            Aucune recette ne correspond. Tu peux en créer une avec le bouton en haut.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filtered.map(r => <RecipeCard key={r.id} recipe={r} onDelete={r.custom ? deleteCustom : undefined} />)}
                        </div>
                    )}
                </div>

                <aside className="lg:col-span-1 space-y-4">
                    <WpGlossary />

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-fuchsia-50 to-pink-50 dark:from-fuchsia-900/10 dark:to-pink-900/10 p-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2"><Sparkles size={14} className="text-fuchsia-500" /> Atelier Refonte WP</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                            Tu refais un site WP entier ? Lance l'Atelier qui découpe en sections et génère tous les prompts d'un coup.
                        </p>
                        <button
                            onClick={() => navigate('/wp-studio')}
                            className="mt-3 w-full px-3 py-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-xs font-semibold"
                        >
                            Ouvrir l'Atelier
                        </button>
                    </div>
                </aside>
            </div>

            {showAddModal && (
                <AddRecipeModal onClose={() => setShowAddModal(false)} onAdd={addCustom} />
            )}
        </div>
    );
};

export default RecipesPage;
