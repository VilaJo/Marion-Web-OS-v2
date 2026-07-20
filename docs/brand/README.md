# Charte graphique — Eonora Tech

Charte officielle appliquée à toute l'interface de **Eonora Tech OS** (à partir de la v2.10.0).

![Charte graphique Eonora Tech](./eonora-charte.png)

## Tokens de marque

| Rôle | Nom | Hex |
|------|-----|-----|
| Fond clair (ultra-épuration) | `--eonora-bg` / `cream` | `#FAF7F2` |
| CTA / boutons primaires (sage) | `--eonora-sage` / `sage` | `#7C9A7E` |
| Sage — survol / pressé | `--eonora-sage-dark` | `#647D66` |
| Sage — secondaire / dégradé doux | `--eonora-sage-light` | `#A7C1A3` |
| Cartes mode sombre | `--eonora-charcoal` / `charcoal` | `#23262B` |
| Fond mode sombre | `--eonora-charcoal-deep` | `#1A1C20` |
| Dégradé — violet | `--eonora-violet` / `eo-violet` | `#7C3AED` |
| Dégradé — bleu | `--eonora-blue` / `eo-blue` | `#3B82F6` |
| Dégradé — cyan | `--eonora-cyan` / `eo-cyan` | `#22D3EE` |

**Dégradé signature :** `linear-gradient(90deg, #7C3AED 0%, #3B82F6 50%, #22D3EE 100%)`
(disponible via la classe utilitaire `bg-eonora-gradient`).

## Où sont définis les tokens

- **Variables CSS** : `:root` dans `index.css`.
- **Config Tailwind (CDN runtime)** : bloc `tailwind.config` dans `index.html`
  (couleurs `sage`, `charcoal`, `cream`, `eo-*` ; `backgroundImage.eonora-gradient` ;
  remappage de l'échelle `orange` vers des teintes sage).
- **Accent runtime** : `--brand-color` est posé par `App.tsx` d'après la couleur
  d'accentuation choisie dans les Paramètres (sage par défaut).

## Principes

- **Clair d'abord** : monde crème `#FAF7F2`, beaucoup d'espace, cartes douces.
- **Sombre = charcoal** : cartes contrastées + accents sage, sobre et « techno ».
- **Sage pour agir** : les boutons d'action principaux sont sage, texte blanc.
- **Dégradé pour accentuer** : logo, icônes accentuées, surbrillances — pas en aplat de fond.
- **Minimaliste** : typographie sans-serif nette (Montserrat titres / Raleway corps),
  angles légèrement arrondis, ombres discrètes. Éviter la surcharge (glow, pastilles inutiles).

## Exceptions

- `components/InvoiceBuilder.tsx` n'est pas retouché (préférence produit) ; il hérite
  uniquement des tokens globaux.
