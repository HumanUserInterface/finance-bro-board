// @ts-ignore - pdf-parse doesn't have proper ESM types
import * as pdfParse from 'pdf-parse';

export interface ParsedPaycheckData {
  netSalary: number | null;
  grossSalary: number | null;
  month: string | null;
  employer: string | null;
  confidence: 'high' | 'medium' | 'low';
  rawText: string;
}

/**
 * Parses a French paycheck PDF and extracts salary information
 * @param buffer The PDF file buffer
 * @returns Parsed paycheck data with confidence level
 */
export async function parseFrenchPaycheck(buffer: Buffer): Promise<ParsedPaycheckData> {
  try {
    // Parse PDF to text
    // @ts-ignore - pdf-parse doesn't have proper ESM types
    const pdf = pdfParse.default || pdfParse;
    const data = await pdf(buffer);
    const text = data.text;

    // Initialize result
    const result: ParsedPaycheckData = {
      netSalary: null,
      grossSalary: null,
      month: null,
      employer: null,
      confidence: 'low',
      rawText: text,
    };

    // Patterns for net salary in French paychecks
    // Common patterns: "Net à payer: 2,500.00" or "Salaire net 2 500,00 €"
    const netSalaryPatterns = [
      /net\s+(?:à\s+)?payer[:\s]+([0-9,.\s]+)/i,
      /salaire\s+net[:\s]+([0-9,.\s]+)/i,
      /net\s+imposable[:\s]+([0-9,.\s]+)/i,
      /net\s+pay[eé][:\s]+([0-9,.\s]+)/i,
      /montant\s+net[:\s]+([0-9,.\s]+)/i,
    ];

    // Patterns for gross salary
    const grossSalaryPatterns = [
      /salaire\s+brut[:\s]+([0-9,.\s]+)/i,
      /brut[:\s]+([0-9,.\s]+)/i,
      /montant\s+brut[:\s]+([0-9,.\s]+)/i,
    ];

    // Patterns for month
    const monthPatterns = [
      /(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i,
      /(\d{1,2})\/(\d{4})/,
      /période[:\s]+(\d{1,2})\/(\d{4})/i,
    ];

    // Try to extract net salary
    for (const pattern of netSalaryPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleanedAmount = cleanFrenchNumber(match[1]);
        if (cleanedAmount !== null && cleanedAmount > 0 && cleanedAmount < 1000000) {
          result.netSalary = cleanedAmount;
          result.confidence = 'high';
          break;
        }
      }
    }

    // Try to extract gross salary
    for (const pattern of grossSalaryPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleanedAmount = cleanFrenchNumber(match[1]);
        if (cleanedAmount !== null && cleanedAmount > 0 && cleanedAmount < 1000000) {
          result.grossSalary = cleanedAmount;
          break;
        }
      }
    }

    // Try to extract month
    for (const pattern of monthPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.month = match[0];
        break;
      }
    }

    // Try to extract employer (usually at the top of the document)
    // Take first few lines and look for company name patterns
    const lines = text.split('\n').slice(0, 10);
    for (const line of lines) {
      // Look for lines with "SA", "SAS", "SARL", "EURL" or all caps company names
      if (
        line.match(/\b(SA|SAS|SARL|EURL|SNC)\b/) ||
        (line.length > 5 && line.length < 60 && line === line.toUpperCase())
      ) {
        result.employer = line.trim();
        break;
      }
    }

    // Adjust confidence based on what we found
    if (result.netSalary && result.month) {
      result.confidence = 'high';
    } else if (result.netSalary) {
      result.confidence = 'medium';
    }

    return result;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF document');
  }
}

/**
 * Cleans and converts French-formatted numbers to standard decimal
 * Handles formats like: "2 500,00", "2.500,00", "2500.00", "2,500.00"
 * @param numberStr The number string to clean
 * @returns The parsed number or null if invalid
 */
function cleanFrenchNumber(numberStr: string): number | null {
  try {
    // Remove all whitespace
    let cleaned = numberStr.replace(/\s+/g, '');

    // Remove currency symbols
    cleaned = cleaned.replace(/[€$£]/g, '');

    // Determine if comma or dot is the decimal separator
    // In French: comma is decimal, space or dot is thousands separator
    // In English: dot is decimal, comma is thousands separator

    // Count commas and dots
    const commaCount = (cleaned.match(/,/g) || []).length;
    const dotCount = (cleaned.match(/\./g) || []).length;

    if (commaCount === 1 && dotCount === 0) {
      // French format: "2500,00" -> replace comma with dot
      cleaned = cleaned.replace(',', '.');
    } else if (commaCount === 0 && dotCount === 1) {
      // English format: "2500.00" -> already correct
      // Do nothing
    } else if (commaCount > 1 || dotCount > 1) {
      // Multiple separators - assume thousands separators
      // Remove all commas and dots except the last one
      const lastCommaIdx = cleaned.lastIndexOf(',');
      const lastDotIdx = cleaned.lastIndexOf('.');

      if (lastCommaIdx > lastDotIdx) {
        // Last separator is comma, it's the decimal
        cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
      } else {
        // Last separator is dot, it's the decimal
        cleaned = cleaned.replace(/,/g, '');
      }
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Validates if a parsed paycheck looks reasonable
 * @param data The parsed paycheck data
 * @returns true if the data looks valid
 */
export function validatePaycheckData(data: ParsedPaycheckData): boolean {
  // Must have at least a net salary
  if (!data.netSalary) {
    return false;
  }

  // Net salary should be reasonable (between 500 and 50,000 EUR/month)
  if (data.netSalary < 500 || data.netSalary > 50000) {
    return false;
  }

  // If we have both gross and net, net should be less than gross
  if (data.grossSalary && data.netSalary >= data.grossSalary) {
    return false;
  }

  return true;
}
