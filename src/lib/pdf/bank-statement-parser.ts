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

          // Extract text from all pages
          let fullText = '';
          const textItems: { x: number; y: number; text: string; page: number }[] = [];

          if (pdfData.Pages) {
            console.log('[BANK-PARSER] Processing', pdfData.Pages.length, 'pages');

            pdfData.Pages.forEach((page, pageIndex) => {
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
                        fullText += decoded + ' ';
                        textItems.push({
                          x: text.x || 0,
                          y: text.y || 0,
                          text: decoded,
                          page: pageIndex,
                        });
                      }
                    }
                  }
                }
              }
              fullText += '\n';
            });
          }

          console.log('[BANK-PARSER] Extracted text length:', fullText.length);

          const result = parseN26Statement(fullText, textItems);
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
  textItems: { x: number; y: number; text: string; page: number }[]
): ParsedBankStatement {
  const transactions: ParsedTransaction[] = [];
  let bankName: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  // Detect N26
  if (fullText.toLowerCase().includes('n26') || fullText.includes('N26 Bank')) {
    bankName = 'N26';
    confidence = 'medium';
  }

  // N26 categories (French)
  const knownCategories = [
    'Revenus',
    'Alimentation et épicerie',
    'Commerces et services',
    'Transfert sortant',
    'Transfert entrant',
    'Loisirs et sorties',
    'Transports et voyages',
    'Abonnements et factures',
    'Santé et bien-être',
    'Éducation',
    'Autres',
    'Retrait',
    'Dépôt',
    'Assurance',
    'Loyer',
  ];

  // Pattern for dates: DD/MM/YYYY or DD.MM.YYYY or DD MM YYYY
  const datePattern = /(\d{1,2})[\/\.\s](\d{1,2})[\/\.\s](\d{4})/g;

  // Pattern for amounts: +X,XX € or -X,XX € or X,XX €
  const amountPattern = /([+-]?\s*\d+[,.\s]*\d*)\s*€/g;

  // Try to extract transactions by looking for date + description + amount patterns
  const lines = fullText.split(/\n/);

  for (const line of lines) {
    // Skip header/footer lines
    if (
      line.includes('IBAN') ||
      line.includes('BIC') ||
      line.includes('Solde') ||
      line.includes('Total') ||
      line.length < 10
    ) {
      continue;
    }

    // Look for a date at the start or in the line
    const dateMatch = line.match(/(\d{1,2})[\/\.\s](\d{1,2})[\/\.\s](\d{4})/);
    if (!dateMatch) continue;

    // Look for an amount
    const amountMatches = [...line.matchAll(/([+-]?\s*[\d\s]+[,.]?\d*)\s*€/g)];
    if (amountMatches.length === 0) continue;

    // Get the last amount in the line (usually the transaction amount)
    const lastAmountMatch = amountMatches[amountMatches.length - 1];
    const amountStr = lastAmountMatch[1];
    const amount = parseAmount(amountStr);
    if (amount === null || amount === 0) continue;

    // Extract description (between date and amount)
    const dateEndIndex = dateMatch.index! + dateMatch[0].length;
    const amountStartIndex = lastAmountMatch.index!;
    let description = line.substring(dateEndIndex, amountStartIndex).trim();

    // Try to find a category
    let category: string | null = null;
    for (const cat of knownCategories) {
      if (line.includes(cat)) {
        category = cat;
        // Remove category from description
        description = description.replace(cat, '').trim();
        break;
      }
    }

    // Clean up description
    description = description.replace(/\s+/g, ' ').trim();
    if (!description) description = 'Transaction';

    // Format date as YYYY-MM-DD
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3];
    const formattedDate = `${year}-${month}-${day}`;

    transactions.push({
      date: formattedDate,
      description,
      amount: Math.abs(amount),
      type: amount > 0 ? 'income' : 'expense',
      category,
      rawLine: line.trim(),
    });
  }

  // If we didn't find transactions with the line-by-line approach, try pattern matching
  if (transactions.length === 0) {
    console.log('[BANK-PARSER] Line-by-line parsing found no transactions, trying pattern matching');

    // More aggressive pattern matching on full text
    const dateMatches = [...fullText.matchAll(datePattern)];
    const amountMatchesAll = [...fullText.matchAll(amountPattern)];

    console.log('[BANK-PARSER] Found', dateMatches.length, 'dates and', amountMatchesAll.length, 'amounts');

    // Try to pair dates with nearby amounts
    for (const dateMatch of dateMatches) {
      const datePos = dateMatch.index!;
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].padStart(2, '0');
      const year = dateMatch[3];

      // Look for amount within 200 characters after the date
      for (const amtMatch of amountMatchesAll) {
        const amtPos = amtMatch.index!;
        if (amtPos > datePos && amtPos - datePos < 200) {
          const amount = parseAmount(amtMatch[1]);
          if (amount !== null && amount !== 0) {
            // Extract text between date and amount as description
            let desc = fullText.substring(datePos + dateMatch[0].length, amtPos).trim();
            desc = desc.replace(/\s+/g, ' ').trim();
            if (!desc) desc = 'Transaction';

            // Check for category
            let category: string | null = null;
            for (const cat of knownCategories) {
              if (desc.includes(cat)) {
                category = cat;
                desc = desc.replace(cat, '').trim();
                break;
              }
            }

            transactions.push({
              date: `${year}-${month}-${day}`,
              description: desc.substring(0, 100), // Limit description length
              amount: Math.abs(amount),
              type: amount > 0 ? 'income' : 'expense',
              category,
            });
            break; // Move to next date
          }
        }
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

  // Look for month name in text
  const monthNames: Record<string, string> = {
    'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03',
    'avril': '04', 'mai': '05', 'juin': '06', 'juillet': '07',
    'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10',
    'novembre': '11', 'décembre': '12', 'decembre': '12',
  };

  for (const [name, num] of Object.entries(monthNames)) {
    const regex = new RegExp(name + '\\s*(\\d{4})', 'i');
    const match = fullText.match(regex);
    if (match) {
      monthName = `${name.charAt(0).toUpperCase() + name.slice(1)} ${match[1]}`;
      break;
    }
  }

  // Get date range from transactions
  if (uniqueTransactions.length > 0) {
    const dates = uniqueTransactions.map((t) => t.date).sort();
    startDate = dates[0];
    endDate = dates[dates.length - 1];
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
    const isNegative = cleaned.includes('-');
    const isPositive = cleaned.includes('+');

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

    // No explicit sign - assume negative for expenses
    return -parsed;
  } catch {
    return null;
  }
}
