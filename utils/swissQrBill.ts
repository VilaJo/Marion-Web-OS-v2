/**
 * Swiss QR-bill v2.0 — validation IBAN, QR-IBAN, génération de référence.
 *
 * Spec: SIX Group "Implementation Guidelines QR-bill v2.3" + ISO 11649 (RF).
 *
 * Le payload final est assemblé côté backend (`api/ai_bp.py::generate_qr`) qui
 * encode le QR via segno ; ce module fournit la couche front (validation +
 * calcul des références) consommée par InvoiceBuilder.
 *
 * Test vectors :
 *  - QR-IBAN test : CH4431999123000889012 (Bank Cler test)
 *  - IBAN normal  : CH9300762011623852957 (UBS test, NON ou SCOR)
 *  - SCOR sample  : RF18539007547034 (mod 97 = 1)
 */

// ---------------------------------------------------------------------------
// IBAN — validation modulo 97 (ISO 7064)
// ---------------------------------------------------------------------------

/** Retire espaces, normalise majuscules. */
export function normalizeIban(iban: string): string {
    return (iban || '').replace(/\s+/g, '').toUpperCase();
}

/** Vérifie le checksum IBAN (mod 97 = 1). */
export function isValidIban(rawIban: string): boolean {
    const iban = normalizeIban(rawIban);
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(iban)) return false;
    if (iban.length < 5) return false;
    // Bouger les 4 premiers caractères à la fin
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    // Convertir chaque lettre en sa valeur numérique (A=10, B=11, ..., Z=35)
    const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
    // Modulo 97 en streaming pour éviter BigInt
    let rem = 0;
    for (const c of numeric) {
        rem = (rem * 10 + (c.charCodeAt(0) - 48)) % 97;
    }
    return rem === 1;
}

/** Un QR-IBAN suisse est un IBAN CH/LI dont l'IID (positions 5-9) est entre 30000 et 31999. */
export function isQrIban(rawIban: string): boolean {
    const iban = normalizeIban(rawIban);
    if (!/^(CH|LI)\d{2}\d{5}/.test(iban)) return false;
    const iid = parseInt(iban.slice(4, 9), 10);
    return iid >= 30000 && iid <= 31999;
}

// ---------------------------------------------------------------------------
// QR Reference (QRR) — 27 chiffres + checksum modulo 10 récursif
// ---------------------------------------------------------------------------

/**
 * Table de transition pour le modulo 10 récursif (Pochon, "ESR Reference").
 * Lignes = "carry" précédent, colonnes = chiffre courant.
 */
const MOD10_TABLE: number[][] = [
    [0, 9, 4, 6, 8, 2, 7, 1, 3, 5],
    [9, 4, 6, 8, 2, 7, 1, 3, 5, 0],
    [4, 6, 8, 2, 7, 1, 3, 5, 0, 9],
    [6, 8, 2, 7, 1, 3, 5, 0, 9, 4],
    [8, 2, 7, 1, 3, 5, 0, 9, 4, 6],
    [2, 7, 1, 3, 5, 0, 9, 4, 6, 8],
    [7, 1, 3, 5, 0, 9, 4, 6, 8, 2],
    [1, 3, 5, 0, 9, 4, 6, 8, 2, 7],
    [3, 5, 0, 9, 4, 6, 8, 2, 7, 1],
    [5, 0, 9, 4, 6, 8, 2, 7, 1, 3],
];

/** Calcule le check-digit modulo 10 récursif pour une chaîne de 26 chiffres. */
export function computeQrrCheckDigit(digits26: string): number {
    if (!/^\d{26}$/.test(digits26)) {
        throw new Error('QRR check-digit requires exactly 26 digits');
    }
    let carry = 0;
    for (const c of digits26) {
        carry = MOD10_TABLE[carry][c.charCodeAt(0) - 48];
    }
    return (10 - carry) % 10;
}

/**
 * Construit une QR Reference (27 chiffres) à partir d'une "base" (max 26 chiffres,
 * complétée avec des zéros à gauche). Typiquement on encode le numéro de facture.
 *
 * Ex : buildQrReference('F2026-0001')
 *   → digits = "00000000000000000020260001" (26)
 *   → checksum = computeQrrCheckDigit(digits)
 *   → "000000000000000000202600015"
 */
export function buildQrReference(seed: string): string {
    const onlyDigits = (seed || '').replace(/\D/g, '');
    if (onlyDigits.length > 26) {
        throw new Error('QRR seed must contain at most 26 digits');
    }
    const padded = onlyDigits.padStart(26, '0');
    const checksum = computeQrrCheckDigit(padded);
    return `${padded}${checksum}`;
}

/** Valide une QR Reference (27 chiffres, dernier = check-digit mod 10 récursif). */
export function isValidQrReference(reference: string): boolean {
    const r = (reference || '').replace(/\s+/g, '');
    if (!/^\d{27}$/.test(r)) return false;
    const body = r.slice(0, 26);
    const check = parseInt(r.slice(26), 10);
    return computeQrrCheckDigit(body) === check;
}

/** Formate une QRR en groupes de 5 chiffres (lecture humaine sur le récépissé). */
export function formatQrReference(reference: string): string {
    const r = (reference || '').replace(/\s+/g, '');
    if (r.length !== 27) return reference;
    // Format SIX : "XX XXXXX XXXXX XXXXX XXXXX XXXXX" (5 groupes de 5 + 2 en tête)
    return `${r.slice(0, 2)} ${r.slice(2, 7)} ${r.slice(7, 12)} ${r.slice(12, 17)} ${r.slice(17, 22)} ${r.slice(22, 27)}`;
}

// ---------------------------------------------------------------------------
// Creditor Reference (SCOR) — ISO 11649 "RF" + mod 97
// ---------------------------------------------------------------------------

/**
 * Calcule le check-digit (2 digits) ISO 11649 pour une référence sans le "RF".
 * Algorithme :
 *   1. Append "RF00" à la fin de la ref
 *   2. Convertir lettres → chiffres (A=10 ... Z=35)
 *   3. mod 97
 *   4. check = 98 - mod
 */
function computeScorCheckDigits(refBody: string): string {
    const cleaned = (refBody || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const enlarged = cleaned + 'RF00';
    const numeric = enlarged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
    let rem = 0;
    for (const c of numeric) {
        rem = (rem * 10 + (c.charCodeAt(0) - 48)) % 97;
    }
    const check = 98 - rem;
    return check.toString().padStart(2, '0');
}

/** Construit une Creditor Reference RF (ISO 11649). Max 21 chars utiles. */
export function buildCreditorReference(seed: string): string {
    const cleaned = (seed || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length === 0 || cleaned.length > 21) {
        throw new Error('SCOR seed must be 1..21 alphanumeric characters');
    }
    const check = computeScorCheckDigits(cleaned);
    return `RF${check}${cleaned}`;
}

/** Valide une SCOR (RF + 2 digits check + 1..21 alphanum). */
export function isValidCreditorReference(reference: string): boolean {
    const r = (reference || '').toUpperCase().replace(/\s+/g, '');
    if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(r)) return false;
    const body = r.slice(4);
    const expected = computeScorCheckDigits(body);
    return r.slice(2, 4) === expected;
}

// ---------------------------------------------------------------------------
// Sélection automatique du type de référence selon l'IBAN
// ---------------------------------------------------------------------------

export type QrReferenceMode = 'QRR' | 'SCOR' | 'NON';

export function chooseReferenceMode(iban: string, preferred: QrReferenceMode = 'NON'): QrReferenceMode {
    if (isQrIban(iban)) return 'QRR'; // QR-IBAN ⇒ QRR obligatoire
    if (preferred === 'QRR') return 'NON'; // QRR impossible sans QR-IBAN ⇒ fallback NON
    return preferred;
}

/**
 * Génère la référence appropriée pour le mode choisi à partir d'un identifiant
 * (numéro de facture). Retourne `undefined` pour le mode NON.
 */
export function generateReferenceForMode(mode: QrReferenceMode, invoiceNumber: string): string | undefined {
    if (mode === 'QRR') return buildQrReference(invoiceNumber);
    if (mode === 'SCOR') return buildCreditorReference(invoiceNumber);
    return undefined;
}
