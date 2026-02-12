/**
 * Export utilities - Generic CSV and XLSX generation helpers.
 * Used across FinanceDashboard, GoalsKPIs, ClientExport, etc.
 */

// ============================================================================
// CSV Export
// ============================================================================

export interface CSVColumn {
    header: string;
    key: string;
    /** Optional formatter for the cell value */
    format?: (value: any, row: any) => string;
}

/**
 * Generate and download a CSV file.
 * Uses semicolon as delimiter (European/Swiss format) and UTF-8 BOM for Excel compatibility.
 */
export function exportCSV(
    data: Record<string, any>[],
    columns: CSVColumn[],
    filename: string,
    options?: { delimiter?: string; bom?: boolean }
) {
    const delimiter = options?.delimiter ?? ';';
    const bom = options?.bom !== false ? '\uFEFF' : '';

    const headers = columns.map(c => c.header).join(delimiter);
    const rows = data.map(row =>
        columns.map(col => {
            const raw = col.format ? col.format(row[col.key], row) : row[col.key];
            const str = String(raw ?? '');
            // Escape delimiter and quotes
            if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(delimiter)
    );

    const csvContent = bom + [headers, ...rows].join('\n');
    downloadBlob(csvContent, filename, 'text/csv;charset=utf-8');
}

/**
 * Shorthand for simple CSV export from arrays (for backward compatibility).
 */
export function exportSimpleCSV(
    headers: string[],
    rows: (string | number)[][],
    filename: string,
    delimiter = ';'
) {
    const bom = '\uFEFF';
    const csvContent = bom + [
        headers.join(delimiter),
        ...rows.map(r => r.map(cell => {
            const str = String(cell ?? '');
            if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(delimiter))
    ].join('\n');
    downloadBlob(csvContent, filename, 'text/csv;charset=utf-8');
}

// ============================================================================
// XLSX Export (Open XML format, no external dependencies)
// ============================================================================

export interface XLSXSheet {
    name: string;
    columns: CSVColumn[];
    data: Record<string, any>[];
}

/**
 * Generate and download an XLSX file using a minimal Open XML implementation.
 * Supports multiple sheets. No external dependencies required.
 */
export async function exportXLSX(sheets: XLSXSheet[], filename: string) {
    // We use a simplified XLSX generation approach:
    // An XLSX file is a ZIP containing XML files.
    // We generate the minimum required XML structure.

    const { createXLSXBlob } = await generateXLSXContent(sheets);
    downloadBlobDirect(createXLSXBlob, filename);
}

/**
 * Single-sheet shorthand for XLSX export.
 */
export async function exportSingleSheetXLSX(
    data: Record<string, any>[],
    columns: CSVColumn[],
    filename: string,
    sheetName = 'Données'
) {
    await exportXLSX([{ name: sheetName, columns, data }], filename);
}

// ============================================================================
// Helpers
// ============================================================================

function downloadBlob(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    downloadBlobDirect(blob, filename);
}

function downloadBlobDirect(blob: Blob, filename: string) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Clean up the object URL after download
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/**
 * Escape special XML characters.
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Convert column index to Excel letter (0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA).
 */
function colLetter(idx: number): string {
    let s = '';
    let n = idx;
    while (n >= 0) {
        s = String.fromCharCode((n % 26) + 65) + s;
        n = Math.floor(n / 26) - 1;
    }
    return s;
}

/**
 * Generate the XLSX content as a Blob using native compression (if available) or fallback.
 */
async function generateXLSXContent(sheets: XLSXSheet[]): Promise<{ createXLSXBlob: Blob }> {
    // Shared strings table
    const sharedStrings: string[] = [];
    const ssMap = new Map<string, number>();

    function getSSIndex(str: string): number {
        const existing = ssMap.get(str);
        if (existing !== undefined) return existing;
        const idx = sharedStrings.length;
        sharedStrings.push(str);
        ssMap.set(str, idx);
        return idx;
    }

    // Build sheet XML data
    const sheetXMLs: string[] = [];
    for (const sheet of sheets) {
        let rows = '';
        // Header row
        rows += '<row r="1">';
        sheet.columns.forEach((col, ci) => {
            const ref = `${colLetter(ci)}1`;
            const ssIdx = getSSIndex(col.header);
            rows += `<c r="${ref}" t="s"><v>${ssIdx}</v></c>`;
        });
        rows += '</row>';

        // Data rows
        sheet.data.forEach((dataRow, ri) => {
            const rowNum = ri + 2;
            rows += `<row r="${rowNum}">`;
            sheet.columns.forEach((col, ci) => {
                const ref = `${colLetter(ci)}${rowNum}`;
                const raw = col.format ? col.format(dataRow[col.key], dataRow) : dataRow[col.key];
                if (raw === null || raw === undefined) {
                    // Empty cell
                } else if (typeof raw === 'number' && !isNaN(raw)) {
                    rows += `<c r="${ref}"><v>${raw}</v></c>`;
                } else {
                    const ssIdx = getSSIndex(String(raw));
                    rows += `<c r="${ref}" t="s"><v>${ssIdx}</v></c>`;
                }
            });
            rows += '</row>';
        });

        const lastCol = colLetter(Math.max(sheet.columns.length - 1, 0));
        const lastRow = sheet.data.length + 1;
        const dimension = `A1:${lastCol}${lastRow}`;

        sheetXMLs.push(
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="${dimension}"/>
<sheetData>${rows}</sheetData>
</worksheet>`
        );
    }

    // Shared strings XML
    const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map(s => `<si><t>${escapeXml(s)}</t></si>`).join('\n')}
</sst>`;

    // Content Types
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`;

    // Rels
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    // Workbook XML
    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('\n')}
</sheets>
</workbook>`;

    // Workbook rels
    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

    // Use a simple ZIP implementation (no compression, store method)
    const files: { path: string; content: string }[] = [
        { path: '[Content_Types].xml', content: contentTypes },
        { path: '_rels/.rels', content: rels },
        { path: 'xl/workbook.xml', content: workbookXml },
        { path: 'xl/_rels/workbook.xml.rels', content: wbRels },
        { path: 'xl/sharedStrings.xml', content: ssXml },
        ...sheetXMLs.map((xml, i) => ({ path: `xl/worksheets/sheet${i + 1}.xml`, content: xml })),
    ];

    const blob = buildZipBlob(files);
    return { createXLSXBlob: blob };
}

/**
 * Build a minimal ZIP file from a list of text files.
 * Uses STORE (no compression) for simplicity.
 */
function buildZipBlob(files: { path: string; content: string }[]): Blob {
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];
    const centralDir: Uint8Array[] = [];
    let offset = 0;

    for (const file of files) {
        const nameBytes = encoder.encode(file.path);
        const contentBytes = encoder.encode(file.content);
        const crc = crc32(contentBytes);

        // Local file header
        const localHeader = new Uint8Array(30 + nameBytes.length);
        const lhView = new DataView(localHeader.buffer);
        lhView.setUint32(0, 0x04034b50, true); // signature
        lhView.setUint16(4, 20, true); // version needed
        lhView.setUint16(6, 0, true); // flags
        lhView.setUint16(8, 0, true); // compression (STORE)
        lhView.setUint16(10, 0, true); // mod time
        lhView.setUint16(12, 0, true); // mod date
        lhView.setUint32(14, crc, true); // crc-32
        lhView.setUint32(18, contentBytes.length, true); // compressed size
        lhView.setUint32(22, contentBytes.length, true); // uncompressed size
        lhView.setUint16(26, nameBytes.length, true); // filename length
        lhView.setUint16(28, 0, true); // extra field length
        localHeader.set(nameBytes, 30);

        // Central directory entry
        const cdEntry = new Uint8Array(46 + nameBytes.length);
        const cdView = new DataView(cdEntry.buffer);
        cdView.setUint32(0, 0x02014b50, true); // signature
        cdView.setUint16(4, 20, true); // version made by
        cdView.setUint16(6, 20, true); // version needed
        cdView.setUint16(8, 0, true); // flags
        cdView.setUint16(10, 0, true); // compression
        cdView.setUint16(12, 0, true); // mod time
        cdView.setUint16(14, 0, true); // mod date
        cdView.setUint32(16, crc, true); // crc-32
        cdView.setUint32(20, contentBytes.length, true); // compressed size
        cdView.setUint32(24, contentBytes.length, true); // uncompressed size
        cdView.setUint16(28, nameBytes.length, true); // filename length
        cdView.setUint16(30, 0, true); // extra field length
        cdView.setUint16(32, 0, true); // comment length
        cdView.setUint16(34, 0, true); // disk number
        cdView.setUint16(36, 0, true); // internal attrs
        cdView.setUint32(38, 0, true); // external attrs
        cdView.setUint32(42, offset, true); // local header offset
        cdEntry.set(nameBytes, 46);

        parts.push(localHeader, contentBytes);
        centralDir.push(cdEntry);
        offset += localHeader.length + contentBytes.length;
    }

    // Central directory
    const cdOffset = offset;
    let cdSize = 0;
    for (const entry of centralDir) {
        parts.push(entry);
        cdSize += entry.length;
    }

    // End of central directory
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // signature
    eocdView.setUint16(4, 0, true); // disk number
    eocdView.setUint16(6, 0, true); // CD disk number
    eocdView.setUint16(8, files.length, true); // entries on this disk
    eocdView.setUint16(10, files.length, true); // total entries
    eocdView.setUint32(12, cdSize, true); // CD size
    eocdView.setUint32(16, cdOffset, true); // CD offset
    eocdView.setUint16(20, 0, true); // comment length
    parts.push(eocd);

    return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * CRC-32 implementation for ZIP file generation.
 */
function crc32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}
