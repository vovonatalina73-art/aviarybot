const pdf = require('pdf-parse');
const fs = require('fs');

/**
 * Extracts payment information from a PDF file.
 * @param {Buffer} dataBuffer - The raw buffer of the PDF file.
 * @returns {Promise<Object>} Extracted data { value, date, payer, rawText }
 */
async function validatePayment(dataBuffer) {
    try {
        const data = await pdf(dataBuffer);
        const text = data.text;

        // Regex Patterns (adapted for Brazilian context)
        // Value: R$ 1.234,56 or 1.234,56
        const valuePattern = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2}))/i;

        // Date: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        const datePattern = /(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/;

        // Payer Name (Simplified: Looks for "Pagador:", "Nome:", "Origem:", etc.)
        // This is tricky and might need refinement based on bank layouts.
        const payerPattern = /(?:Pagador|Nome|Origem|De|Nome do Pagador)[:\s]+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)/i;

        const valueMatch = text.match(valuePattern);
        const dateMatch = text.match(datePattern);
        const payerMatch = text.match(payerPattern);

        return {
            isValid: !!(valueMatch || dateMatch), // Basic validation
            value: valueMatch ? valueMatch[1] : null,
            date: dateMatch ? dateMatch[1] : null,
            payer: payerMatch ? payerMatch[1].trim() : null,
            rawText: text.substring(0, 500) // snippet for debugging
        };

    } catch (error) {
        console.error('Error parsing PDF:', error);
        return { isValid: false, error: error.message };
    }
}

module.exports = { validatePayment };
