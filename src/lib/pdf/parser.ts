import PDFParser from 'pdf2json';

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
  return new Promise((resolve, reject) => {
    try {
      console.log('[PARSER] Starting PDF parsing with pdf2json');

      const pdfParser = new PDFParser();

      // Handle parsing completion
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          console.log('[PARSER] PDF parsed successfully');

          // Extract text from all pages
          let fullText = '';

          if (pdfData.Pages) {
            console.log('[PARSER] Processing', pdfData.Pages.length, 'pages');

            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const text of page.Texts) {
                  if (text.R) {
                    for (const run of text.R) {
                      if (run.T) {
                        // Decode URL-encoded text, fallback to original if malformed
                        try {
                          fullText += decodeURIComponent(run.T) + ' ';
                        } catch {
                          fullText += run.T + ' ';
                        }
                      }
                    }
                  }
                }
              }
              fullText += '\n';
            }
          }

          console.log('[PARSER] Extracted text length:', fullText.length);
          console.log('[PARSER] First 500 chars:', fullText.substring(0, 500));

          const text = fullText;

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
          // Priority order: "Net à payer" is the actual monthly salary, not cumulative
          // Note: PDF extraction adds spaces within words, so use \s* between characters
          const netSalaryPatterns = [
            /n\s*e\s*t\s+(?:à\s+)?p\s*a\s*y\s*e\s*r(?:\s+a\s*v\s*a\s*n\s*t\s+i\s*m\s*p[ôo]\s*t)?[:\s]+([0-9,.\s]+)\s*€?/i,
            /n\s*e\s*t\s+p\s*a\s*y\s*[eé](?:\s+e\s*n\s+e\s*u\s*r\s*o\s*s)?[:\s]+([0-9,.\s]+)\s*€?/i,
            /m\s*o\s*n\s*t\s*a\s*n\s*t\s+n\s*e\s*t[:\s]+([0-9,.\s]+)\s*€?/i,
          ];

          // Patterns for gross salary
          // Priority: "Rémunération brute" for monthly
          const grossSalaryPatterns = [
            /r\s*[eé]\s*m\s*u\s*n\s*[eé]\s*r\s*a\s*t\s*i\s*o\s*n\s+b\s*r\s*u\s*t\s*e[:\s]+([0-9,.\s]+)\s*€?/i,
            /b\s*r\s*u\s*t\s+(?!.*c\s*u\s*m\s*u\s*l)[:\s]+([0-9,.\s]+)\s*€?/i,
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
              // Monthly salary should be between 100 and 20,000 EUR
              // (avoid picking up cumulative amounts which are usually 3-12x larger)
              if (cleanedAmount !== null && cleanedAmount > 100 && cleanedAmount < 20000) {
                result.netSalary = cleanedAmount;
                result.confidence = 'high';
                console.log(`[PARSER] Found net salary: ${cleanedAmount} using pattern: ${pattern}`);
                break;
              } else if (cleanedAmount !== null) {
                console.log(`[PARSER] Skipped amount ${cleanedAmount} (outside reasonable monthly range)`);
              }
            }
          }

          // Try to extract gross salary
          for (const pattern of grossSalaryPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              const cleanedAmount = cleanFrenchNumber(match[1]);
              // Monthly gross should be between 100 and 25,000 EUR
              if (cleanedAmount !== null && cleanedAmount > 100 && cleanedAmount < 25000) {
                result.grossSalary = cleanedAmount;
                console.log(`[PARSER] Found gross salary: ${cleanedAmount} using pattern: ${pattern}`);
                break;
              } else if (cleanedAmount !== null) {
                console.log(`[PARSER] Skipped gross amount ${cleanedAmount} (outside reasonable monthly range)`);
              }
            }
          }

          // Try to extract month
          for (const pattern of monthPatterns) {
            const match = text.match(pattern);
            if (match) {
              result.month = match[0];
              console.log(`[PARSER] Found month: ${result.month}`);
              break;
            }
          }

          // Try to extract employer
          const lines = text.split('\n').slice(0, 10);
          for (const line of lines) {
            if (
              line.match(/\b(SA|SAS|SARL|EURL|SNC)\b/) ||
              (line.length > 5 && line.length < 60 && line === line.toUpperCase())
            ) {
              result.employer = line.trim();
              console.log(`[PARSER] Found employer: ${result.employer}`);
              break;
            }
          }

          // Adjust confidence
          if (result.netSalary && result.month) {
            result.confidence = 'high';
          } else if (result.netSalary) {
            result.confidence = 'medium';
          }

          console.log('[PARSER] Parsing complete:', {
            netSalary: result.netSalary,
            confidence: result.confidence,
            hasMonth: !!result.month,
            hasEmployer: !!result.employer
          });

          resolve(result);
        } catch (error) {
          console.error('[PARSER] Error processing PDF data:', error);
          reject(new Error('Failed to process PDF data'));
        }
      });

      // Handle parsing errors
      pdfParser.on('pdfParser_dataError', (error) => {
        console.error('[PARSER] PDF parsing error:', error);
        reject(new Error('Failed to parse PDF document'));
      });

      // Start parsing
      pdfParser.parseBuffer(buffer);
    } catch (error) {
      console.error('[PARSER] Error:', error);
      reject(new Error('Failed to parse PDF document'));
    }
  });
}

/**
 * Cleans and converts French-formatted numbers to standard decimal
 */
function cleanFrenchNumber(numberStr: string): number | null {
  try {
    // First, extract only the number part (remove non-numeric except , . and spaces)
    let cleaned = numberStr.trim();

    // Remove currency symbols
    cleaned = cleaned.replace(/[€$£]/g, '');

    // Remove all spaces first to avoid "1 327" becoming "1327" vs keeping space
    cleaned = cleaned.replace(/\s+/g, '');

    const commaCount = (cleaned.match(/,/g) || []).length;
    const dotCount = (cleaned.match(/\./g) || []).length;

    if (commaCount === 1 && dotCount === 0) {
      // French format: "1327,35" -> replace comma with dot
      cleaned = cleaned.replace(',', '.');
    } else if (commaCount === 0 && dotCount === 1) {
      // English format: "1327.35" -> already correct
      // Do nothing
    } else if (commaCount > 1 || dotCount > 1) {
      // Multiple separators - determine decimal separator
      const lastCommaIdx = cleaned.lastIndexOf(',');
      const lastDotIdx = cleaned.lastIndexOf('.');

      if (lastCommaIdx > lastDotIdx) {
        // Last separator is comma, it's the decimal: "1.327,35"
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // Last separator is dot, it's the decimal: "1,327.35"
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
 */
export function validatePaycheckData(data: ParsedPaycheckData): boolean {
  if (!data.netSalary) {
    return false;
  }

  if (data.netSalary < 500 || data.netSalary > 50000) {
    return false;
  }

  if (data.grossSalary && data.netSalary >= data.grossSalary) {
    return false;
  }

  return true;
}
