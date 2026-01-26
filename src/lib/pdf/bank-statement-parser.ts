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
    // Only include main account pages
    if (pageText.includes('Relevé de compte') || pageText.includes('Date de réservation')) {
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
    // Split by common transaction patterns
    // N26 format: MERCHANT_NAME [category info] DD.MM.YYYY [+/-]XX,XX€

    // Look for amount patterns with explicit + or - sign
    const transactionPattern = /([A-Z][A-Za-z0-9\s\*\.\-,\/&']+?)(?:Mastercard[^€]*?)?(\d{2}\.\d{2}\.\d{4})\s*([+-]?\d+[,.]?\d*)\s*€/g;

    let match;
    while ((match = transactionPattern.exec(pageText)) !== null) {
      let description = match[1].trim();
      const dateStr = match[2];
      const amountStr = match[3];

      // Skip internal transfers between N26 spaces
      if (
        description.startsWith('De ') ||
        description.startsWith('Vers ') ||
        description.includes('Arrondis')
      ) {
        continue;
      }

      // Skip header/footer text
      if (
        description.includes('VICTOR MICHEL') ||
        description.includes('IBAN') ||
        description.includes('Relevé') ||
        description.includes('Description') ||
        description.includes('Émis le') ||
        description.includes('Date de valeur') ||
        description.length < 3
      ) {
        continue;
      }

      // Parse amount
      const amount = parseAmount(amountStr);
      if (amount === null || amount === 0) continue;

      // Parse date (DD.MM.YYYY -> YYYY-MM-DD)
      const [day, month, year] = dateStr.split('.');
      const formattedDate = `${year}-${month}-${day}`;

      // Extract category if present
      let category: string | null = null;
      for (const cat of knownCategories) {
        if (pageText.includes(cat) && description.length < 50) {
          // Check if category is near this transaction
          const descIndex = pageText.indexOf(description);
          const catIndex = pageText.indexOf(cat);
          if (Math.abs(descIndex - catIndex) < 100) {
            category = cat;
            break;
          }
        }
      }

      // Clean up description
      description = description
        .replace(/Mastercard.*$/, '')
        .replace(/Date de valeur.*$/, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Skip if description is too short after cleaning
      if (description.length < 2) continue;

      transactions.push({
        date: formattedDate,
        description,
        amount: Math.abs(amount),
        type: amount > 0 ? 'income' : 'expense',
        category,
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
