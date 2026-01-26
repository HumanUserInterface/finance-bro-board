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
 * Parse N26 bank statement format
 */
function parseN26Statement(
  fullText: string,
  pageTexts: string[]
): ParsedBankStatement {
  const transactions: ParsedTransaction[] = [];
  let bankName: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  // Detect N26
  if (fullText.toLowerCase().includes('n26') || fullText.includes('N26 Bank')) {
    bankName = 'N26';
    confidence = 'medium';
  }

  // Find pages that are main account (not "Espace" sub-accounts)
  const mainAccountPages: string[] = [];
  for (const pageText of pageTexts) {
    // Skip "Espace" pages (sub-accounts) and "Vue d'ensemble" (summary) pages
    if (
      pageText.includes('Relevé Espace') ||
      pageText.includes('Espaces vue d\'ensemble') ||
      pageText.includes('Vue d\'ensemble')
    ) {
      continue;
    }
    // Include all other pages that have transaction-like content (dates and amounts)
    if (
      pageText.includes('Relevé de compte') ||
      pageText.includes('Date de réservation') ||
      pageText.match(/\d{2}\.\d{2}\.\d{4}.*[+-]?\d+[,.]?\d*\s*€/)
    ) {
      mainAccountPages.push(pageText);
    }
  }

  console.log('[BANK-PARSER] Found', mainAccountPages.length, 'main account pages');

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

  // Process each main account page
  for (const pageText of mainAccountPages) {
    // Strategy 1: Find amounts with explicit +/- signs and look for nearby dates
    // N26 format typically: DESCRIPTION ... DD.MM.YYYY ... [+/-]XX,XX €

    // Find all amounts with signs (handles both XX,XX € and XX €)
    const amountRegex = /([+-])\s*(\d{1,3}(?:[.\s]\d{3})*(?:[,]\d{1,2})?)\s*€/g;
    let amountMatch;

    while ((amountMatch = amountRegex.exec(pageText)) !== null) {
      const sign = amountMatch[1];
      const amountValue = amountMatch[2].replace(/[\s.]/g, '').replace(',', '.');
      const amount = parseFloat(amountValue);

      if (isNaN(amount) || amount === 0) continue;

      const amountPos = amountMatch.index;

      // Look for a date within 300 chars before the amount
      const textBefore = pageText.substring(Math.max(0, amountPos - 300), amountPos);
      const dateMatch = textBefore.match(/(\d{2})\.(\d{2})\.(\d{4})/);

      if (!dateMatch) continue;

      const formattedDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

      // Extract description: text before the date
      const datePos = textBefore.lastIndexOf(dateMatch[0]);
      let description = textBefore.substring(0, datePos).trim();

      // Clean up description
      description = description
        .replace(/Mastercard.*$/i, '')
        .replace(/Date de valeur.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Get last meaningful part if too long
      if (description.length > 80) {
        const parts = description.split(/\s{2,}/);
        description = parts[parts.length - 1] || description.substring(description.length - 80);
      }

      // Skip internal transfers
      if (
        description.startsWith('De ') ||
        description.startsWith('Vers ') ||
        description.includes('Arrondis') ||
        description.includes('VICTOR MICHEL') ||
        description.includes('IBAN') ||
        description.includes('Relevé') ||
        description.includes('Solde') ||
        description.length < 2
      ) {
        continue;
      }

      // Extract category if present nearby
      let category: string | null = null;
      for (const cat of knownCategories) {
        if (textBefore.includes(cat)) {
          category = cat;
          description = description.replace(cat, '').trim();
          break;
        }
      }

      const finalAmount = sign === '+' ? amount : -amount;

      transactions.push({
        date: formattedDate,
        description: description || 'Transaction',
        amount: Math.abs(finalAmount),
        type: finalAmount > 0 ? 'income' : 'expense',
        category,
      });
    }

    // Strategy 2: Find date patterns and look for amounts after them
    // This catches amounts that might not have explicit +/- signs
    const dateRegex = /(\d{2})\.(\d{2})\.(\d{4})/g;
    let dateMatch;

    while ((dateMatch = dateRegex.exec(pageText)) !== null) {
      const datePos = dateMatch.index + dateMatch[0].length;
      const textAfter = pageText.substring(datePos, datePos + 150);

      // Look for an amount (with or without sign)
      const unsignedAmountMatch = textAfter.match(/^\s*(?:Date de valeur[^€]*?)?\s*([+-]?)(\d{1,3}(?:[.\s]\d{3})*(?:[,]\d{1,2})?)\s*€/);

      if (!unsignedAmountMatch) continue;

      const sign = unsignedAmountMatch[1] || '-'; // Default to expense if no sign
      const amountValue = unsignedAmountMatch[2].replace(/[\s.]/g, '').replace(',', '.');
      const amount = parseFloat(amountValue);

      if (isNaN(amount) || amount === 0) continue;

      const formattedDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

      // Look backwards from date for description
      const textBefore = pageText.substring(Math.max(0, dateMatch.index - 200), dateMatch.index);
      let description = textBefore.trim();

      // Clean up description
      description = description
        .replace(/Mastercard.*$/i, '')
        .replace(/.*Date de valeur[^€]*€\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Get last meaningful part
      if (description.length > 80) {
        const parts = description.split(/\s{2,}/);
        description = parts[parts.length - 1] || description.substring(description.length - 80);
      }

      // Skip internal transfers and headers
      if (
        description.startsWith('De ') ||
        description.startsWith('Vers ') ||
        description.includes('Arrondis') ||
        description.includes('VICTOR MICHEL') ||
        description.includes('IBAN') ||
        description.includes('Relevé') ||
        description.includes('Solde') ||
        description.includes('Description') ||
        description.length < 2
      ) {
        continue;
      }

      const finalAmount = sign === '+' ? amount : -amount;

      transactions.push({
        date: formattedDate,
        description: description || 'Transaction',
        amount: Math.abs(finalAmount),
        type: finalAmount > 0 ? 'income' : 'expense',
        category: null,
      });
    }
  }

  // Alternative parsing: look for specific line patterns
  if (transactions.length === 0) {
    console.log('[BANK-PARSER] Pattern matching found no transactions, trying line-by-line');

    for (const pageText of mainAccountPages) {
      // Split into potential transaction blocks
      const lines = pageText.split(/(?=\d{2}\.\d{2}\.\d{4})/);

      for (const line of lines) {
        // Look for date + amount pattern
        const dateMatch = line.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        const amountMatch = line.match(/([+-])\s*(\d+[,.]?\d*)\s*€/);

        if (!dateMatch || !amountMatch) continue;

        const description = line
          .substring(0, line.indexOf(dateMatch[0]))
          .replace(/Mastercard.*$/i, '')
          .replace(/\s+/g, ' ')
          .trim();

        // Skip internal transfers
        if (
          description.startsWith('De ') ||
          description.startsWith('Vers ') ||
          description.includes('Arrondis') ||
          description.includes('VICTOR MICHEL') ||
          description.length < 3
        ) {
          continue;
        }

        const sign = amountMatch[1];
        const value = parseFloat(amountMatch[2].replace(',', '.'));
        const amount = sign === '+' ? value : -value;

        const formattedDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

        transactions.push({
          date: formattedDate,
          description,
          amount: Math.abs(amount),
          type: amount > 0 ? 'income' : 'expense',
          category: null,
        });
      }
    }
  }

  // Remove duplicates based on date + amount + description
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
  if (uniqueTransactions.length > 5) {
    confidence = 'high';
  } else if (uniqueTransactions.length > 0) {
    confidence = 'medium';
  }

  // Try to extract period
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
