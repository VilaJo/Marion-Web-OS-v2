/**
 * Replace {client}, {montant}, {numero}, {echeance} in relance email templates.
 */
export function applyRelanceTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) =>
        vars[key] !== undefined && vars[key] !== '' ? vars[key] : `{${key}}`,
    );
}
