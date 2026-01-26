import PDFParser from 'pdf2json';

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string | null;
  rawLine?: string;
}

export interface ParsedBankStatement {
  transactions: ParsedTransaction[];
  period: {
    startDate: string | null;
    endDate: string | null;
    month: string | null;
  };
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netChange: number;
    transactionCount: number;
  };
  bankName: string | null;
  confidence: 'high' | 'medium' | 'low';
  rawText: string;
}

/**
 * Parses a bank statement PDF (N26 format) and extracts transactions
 */
export async function parseBankStatement(buffer: Buffer): Promise<ParsedBankStatement> {
  return new Promise((resolve, reject) => {
    try {
      console.log('[BANK-PARSER] Starting PDF parsing');

      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          console.log('[BANK-PARSER] PDF parsed successfully');

          // Extract text from all pages with page markers
          const pageTexts: string[] = [];

          if (pdfData.Pages) {
            console.log('[BANK-PARSER] Processing', pdfData.Pages.length, 'pages');

            pdfData.Pages.forEach((page) => {
              let pageText = '';
              if (page.Texts) {
                for (const text of page.Texts) {
                  if (text.R) {
                    for (const run of text.R) {
                      if (run.T) {
                        let decoded: string;
                        try {
                          decoded = decodeURIComponent(run.T);
                        } catch {
                          decoded = run.T;
                        }
                        pageText += decoded + ' ';
                      }
                    }
                  }
                }
              }
              pageTexts.push(pageText);
            });
          }

          const fullText = pageTexts.join('\n---PAGE---\n');
          console.log('[BANK-PARSER] Extracted text length:', fullText.length);

          const result = parseN26Statement(fullText, pageTexts);
          result.rawText = fullText;

          console.log('[BANK-PARSER] Parsing complete:', {
            transactionCount: result.transactions.length,
            totalIncome: result.summary.totalIncome,
            totalExpenses: result.summary.totalExpenses,
            confidence: result.confidence,
          });

          resolve(result);
        } catch (error) {
          console.error('[BANK-PARSER] Error processing PDF data:', error);
          reject(new Error('Failed to process PDF data'));
        }
      });

      pdfParser.on('pdfParser_dataError', (error) => {
        console.error('[BANK-PARSER] PDF parsing error:', error);
        reject(new Error('Failed to parse PDF document'));
      });

      pdfParser.parseBuffer(buffer);
    } catch (error) {
      console.error('[BANK-PARSER] Error:', error);
      reject(new Error('Failed to parse PDF document'));
    }
  });
}

/**
 * Parse N26 bank statement format - Custom parser for Victor's N26 statements
 */
function parseN26Statement(
  fullText: string,
  pageTexts: string[]
): ParsedBankStatement {
  const transactions: ParsedTransaction[] = [];
  let bankName: string | null = 'N26';
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  // N26 categories (French)
  const knownCategories = [
    'Bars et restaurants',
    'Shopping',
    'Courses alimentaires',
    'Multimédia & Télécom',
    'Frais professionnels',
    'Santé et pharmacie',
    'Transports',
    'Loisirs',
    'Revenus',
  ];

  // Find ONLY main account pages (Relevé de compte), skip Espace pages
  const mainAccountPages: string[] = [];
  for (const pageText of pageTexts) {
    // Skip "Relevé Espace" pages (sub-account statements)
    if (pageText.includes('Relevé Espace') || pageText.includes('Relev%C3%A9 Espace')) {
      continue;
    }
    // Skip "Vue d'ensemble" and "Espaces vue d'ensemble" summary pages
    if (
      pageText.includes('Vue d\'ensemble') ||
      pageText.includes('Vue d%E2%80%99ensemble') ||
      pageText.includes('Espaces vue')
    ) {
      continue;
    }
    // Only include main account pages (Relevé de compte)
    if (
      pageText.includes('Relevé de compte') ||
      pageText.includes('Relev%C3%A9 de compte')
    ) {
      mainAccountPages.push(pageText);
    }
  }

  console.log('[BANK-PARSER] Found', mainAccountPages.length, 'main account pages');

  // Process each main account page
  for (const pageText of mainAccountPages) {
    // Look for transaction patterns:
    // Format: MERCHANT_NAME [category] DD.MM.YYYY [+/-]XX,XX€
    // Or with "Date de valeur" in between

    // Strategy: Find all amounts with € and trace back to find description and date
    const amountPattern = /([+-])(\d{1,3}(?:\.\d{3})*,\d{2})€/g;
    let match;

    while ((match = amountPattern.exec(pageText)) !== null) {
      const sign = match[1];
      const amountStr = match[2];
      const amountPos = match.index;

      // Parse amount (French format: 1.234,56 -> 1234.56)
      const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
      if (isNaN(amount) || amount === 0) continue;

      // Look backwards for a date (DD.MM.YYYY format)
      const textBefore = pageText.substring(Math.max(0, amountPos - 500), amountPos);

      // Find the most recent date before this amount
      const dateMatches = [...textBefore.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)];
      if (dateMatches.length === 0) continue;

      const lastDateMatch = dateMatches[dateMatches.length - 1];
      const formattedDate = `${lastDateMatch[3]}-${lastDateMatch[2]}-${lastDateMatch[1]}`;
      const datePos = lastDateMatch.index!;

      // Extract description: text before the date
      let descriptionText = textBefore.substring(0, datePos).trim();

      // Clean up the description - get the last meaningful segment
      // Remove "Date de valeur DD.MM.YYYY" patterns
      descriptionText = descriptionText.replace(/Date de valeur\s*\d{2}\.\d{2}\.\d{4}/gi, '');

      // Split by multiple spaces or special patterns and get meaningful parts
      const segments = descriptionText.split(/\s{2,}|\n/).filter(s => s.trim().length > 0);

      // Get the last few meaningful segments
      let description = '';
      for (let i = segments.length - 1; i >= 0 && i >= segments.length - 3; i--) {
        const seg = segments[i].trim();
        // Skip if it's just a category or metadata
        if (seg.length > 1 && !seg.match(/^\d+\s*\/\s*\d+$/)) {
          description = seg + (description ? ' ' + description : '');
        }
      }

      description = description.trim();

      // Skip internal transfers between N26 spaces
      if (
        description.startsWith('De ') ||
        description.startsWith('Vers ') ||
        description.includes('Arrondis')
      ) {
        continue;
      }

      // Skip header/footer/metadata
      if (
        description.includes('VICTOR MICHEL') ||
        description.includes('POULAIN') ||
        description.includes('IBAN') ||
        description.includes('BIC') ||
        description.includes('Relevé') ||
        description.includes('Description') ||
        description.includes('Montant') ||
        description.includes('Émis le') ||
        description.includes('Emis le') ||
        description.match(/^\d+\s*\/\s*\d+$/) || // Page numbers like "1 / 38"
        description.length < 2
      ) {
        continue;
      }

      // Clean description further
      description = description
        .replace(/Mastercard\s*•?\s*/gi, '')
        .replace(/Date de valeur.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Skip if description is still garbage
      if (description.length < 2 || description.match(/^\d+$/)) continue;

      // Detect category from the text around the transaction
      let category: string | null = null;
      for (const cat of knownCategories) {
        if (textBefore.includes(cat)) {
          category = cat;
          // Remove category from description if present
          description = description.replace(cat, '').trim();
          break;
        }
      }

      // Final cleanup
      description = description.replace(/^•\s*/, '').trim();
      if (description.length < 2) continue;

      const finalAmount = sign === '+' ? amount : -amount;

      transactions.push({
        date: formattedDate,
        description,
        amount: Math.abs(finalAmount),
        type: finalAmount > 0 ? 'income' : 'expense',
        category,
      });
    }
  }

  // Remove duplicates (same date + amount + description)
  const uniqueTransactions = transactions.filter((tx, index, self) =>
    index === self.findIndex((t) =>
      t.date === tx.date && t.amount === tx.amount && t.description === tx.description
    )
  );

  // Sort by date descending
  uniqueTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate summary
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const tx of uniqueTransactions) {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpenses += tx.amount;
    }
  }

  // Update confidence based on results
  if (uniqueTransactions.length > 10) {
    confidence = 'high';
  } else if (uniqueTransactions.length > 0) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Extract period from the document
  let startDate: string | null = null;
  let endDate: string | null = null;
  let monthName: string | null = null;

  // Look for period in format "01.12.2025 jusqu'au 31.12.2025"
  const periodMatch = fullText.match(/(\d{2})\.(\d{2})\.(\d{4})\s*jusqu['']au\s*(\d{2})\.(\d{2})\.(\d{4})/);
  if (periodMatch) {
    startDate = `${periodMatch[3]}-${periodMatch[2]}-${periodMatch[1]}`;
    endDate = `${periodMatch[6]}-${periodMatch[5]}-${periodMatch[4]}`;

    // Get month name
    const monthNames: Record<string, string> = {
      '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril',
      '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août',
      '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre',
    };
    monthName = `${monthNames[periodMatch[2]] || periodMatch[2]} ${periodMatch[3]}`;
  }

  return {
    transactions: uniqueTransactions,
    period: {
      startDate,
      endDate,
      month: monthName,
    },
    summary: {
      totalIncome,
      totalExpenses,
      netChange: totalIncome - totalExpenses,
      transactionCount: uniqueTransactions.length,
    },
    bankName,
    confidence,
    rawText: '',
  };
}

/**
 * Parse French formatted amount
 */
function parseAmount(amountStr: string): number | null {
  try {
    let cleaned = amountStr.trim();

    // Check for sign
    const isNegative = cleaned.startsWith('-');
    const isPositive = cleaned.startsWith('+');

    // Remove signs and spaces
    cleaned = cleaned.replace(/[+-]/g, '').replace(/\s+/g, '');

    // Handle French decimal format (comma as decimal separator)
    if (cleaned.includes(',') && !cleaned.includes('.')) {
      cleaned = cleaned.replace(',', '.');
    } else if (cleaned.includes(',') && cleaned.includes('.')) {
      // Format like 1.234,56 -> 1234.56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }

    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return null;

    // Apply sign
    if (isNegative) return -parsed;
    if (isPositive) return parsed;

    // No explicit sign - default to negative (expense)
    return -parsed;
  } catch {
    return null;
  }
}
