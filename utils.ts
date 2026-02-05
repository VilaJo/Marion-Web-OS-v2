/**
 * Format a number with apostrophes as thousand separators (Swiss/French style)
 * Example: 20000 -> 20'000
 */
export function formatCurrency(amount: number, decimals: number = 2): string {
    const fixed = amount.toFixed(decimals);
    const [integerPart, decimalPart] = fixed.split('.');
    
    // Add apostrophes as thousand separators
    const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    
    return decimalPart ? `${formatted}.${decimalPart}` : formatted;
}

/**
 * Format currency with symbol
 * Example: formatCurrencyWithSymbol(20000, 'CHF') -> "20'000.00 CHF"
 */
export function formatCurrencyWithSymbol(amount: number, currency: string = 'CHF', decimals: number = 2): string {
    return `${formatCurrency(amount, decimals)} ${currency}`;
}
