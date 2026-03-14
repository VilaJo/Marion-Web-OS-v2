function escapeHtml(input: string): string {
    return String(input || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function collectCurrentStyles(): string {
    const tags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
    return tags
        .map((tag) => {
            if (tag.tagName.toLowerCase() === 'style') return tag.outerHTML;
            const href = (tag as HTMLLinkElement).href;
            return href ? `<link rel="stylesheet" href="${escapeHtml(href)}" />` : '';
        })
        .join('\n');
}

export async function printHtmlAsPdf(
    html: string,
    filename: string,
    opts?: { pageMarginMm?: number; landscape?: boolean; extraCss?: string }
): Promise<void> {
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
        throw new Error('Popup blocked');
    }

    const title = filename.replace(/\.pdf$/i, '');
    const margin = typeof opts?.pageMarginMm === 'number' ? Math.max(0, opts.pageMarginMm) : 10;
    const orientation = opts?.landscape ? 'landscape' : 'portrait';
    const inheritedStyles = collectCurrentStyles();

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    ${inheritedStyles}
    <style>
      @page { size: A4 ${orientation}; margin: ${margin}mm; }
      html, body { background: #fff; }
      body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      ${opts?.extraCss || ''}
    </style>
  </head>
  <body>${html}</body>
</html>`);
    printWindow.document.close();

    await new Promise<void>((resolve) => {
        const done = () => resolve();
        if (printWindow.document.readyState === 'complete') {
            done();
            return;
        }
        printWindow.addEventListener('load', () => done(), { once: true });
        setTimeout(done, 800);
    });

    printWindow.focus();
    printWindow.print();
    const closeWindow = () => {
        try { printWindow.close(); } catch {}
    };
    printWindow.onafterprint = closeWindow;
    setTimeout(closeWindow, 5000);
}

export async function printElementAsPdf(
    element: HTMLElement,
    filename: string,
    opts?: { pageMarginMm?: number; landscape?: boolean; extraCss?: string }
): Promise<void> {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.classList.remove('hidden');
    clone.style.display = 'block';
    clone.querySelectorAll('.hidden').forEach((node) => node.classList.remove('hidden'));
    clone.querySelectorAll<HTMLElement>('[style]').forEach((node) => {
        if (node.style.display === 'none') node.style.display = 'block';
    });
    await printHtmlAsPdf(clone.outerHTML, filename, opts);
}
