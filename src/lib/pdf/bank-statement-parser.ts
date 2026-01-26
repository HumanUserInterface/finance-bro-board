import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

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
  console.log('[BANK-PARSER] Starting PDF parsing with pdfjs-dist');

  // Convert Buffer to Uint8Array
  const data = new Uint8Array(buffer);

  // Load the PDF document
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  console.log('[BANK-PARSER] PDF loaded, pages:', doc.numPages);

  // Extract text from all pages
  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    // Sort items by y position (top to bottom) then x position (left to right)
    const items = textContent.items as Array<{ str: string; transform: number[] }>;
    items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5]; // Higher y = earlier (PDF y is bottom-up)
      if (Math.abs(yDiff) > 5) return yDiff;
      return a.transform[4] - b.transform[4]; // Lower x = earlier
    });

    // Group items by approximate y position into lines
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let lastY = items.length > 0 ? items[0].transform[5] : 0;

    for (const item of items) {
      const y = item.transform[5];
      if (Math.abs(y - lastY) > 5) {
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
        currentLine = [];
        lastY = y;
      }
      if (item.str.trim()) {
        currentLine.push(item.str.trim());
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    // Join lines with column separator
    const pageText = lines.map(line => line.join(' | ')).join('\n');
    pageTexts.push(pageText);
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

  // Clean up
  await doc.destroy();

  return result;
}

/**
 * Parse N26 bank statement format - Custom parser for Victor's N26 statements
 */
function parseN26Statement(fullText: string, pageTexts: string[]): ParsedBankStatement {
  const transactions: ParsedTransaction[] = [];
  const bankName = 'N26';
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

  // Only use main account pages (Relevé de compte), not Espace sub-accounts
  // This matches the "Vue d'ensemble" summary which shows main account totals
  const transactionPages: string[] = [];
  for (const pageText of pageTexts) {
    // Skip all summary pages
    if (pageText.includes("Vue d'ensemble") || pageText.includes('Espaces vue')) continue;
    // Skip Espace pages (sub-accounts) - their transactions are already reflected in main account
    if (pageText.includes('Relevé Espace')) continue;
    // Include main account pages (Relevé de compte)
    if (pageText.includes('Relevé de compte')) {
      transactionPages.push(pageText);
    }
  }

  console.log('[BANK-PARSER] Found', transactionPages.length, 'main account pages');

  // Process each transaction page
  for (const pageText of transactionPages) {
    const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Transaction line pattern: "DESCRIPTION | DD.MM.YYYY | [+/-]XX,XX€"
    // The line format from pdfjs is: columns joined by " | "
    const transactionPattern = /^(.+?)\s*\|\s*(\d{2})\.(\d{2})\.(\d{4})\s*\|\s*([+-])?(\d{1,3}(?:\.\d{3})*,\d{2})\s*€$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const match = line.match(transactionPattern);
      if (!match) continue;

      const description = match[1].trim();
      const day = match[2];
      const month = match[3];
      const year = match[4];
      const sign = match[5] || '-';
      const amountStr = match[6];

      const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
      if (isNaN(amount) || amount === 0) continue;

      const transactionDate = `${year}-${month}-${day}`;

      // Skip round-ups
      if (description.includes('Arrondis')) continue;

      // Skip headers
      if (description === 'Description') continue;

      // Skip garbage
      if (description.length < 2) continue;
      if (description.match(/^FR\d/)) continue; // IBAN

      // Look at the next line for category (if it starts with "Mastercard")
      let category: string | null = null;
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.startsWith('Mastercard')) {
          for (const cat of knownCategories) {
            if (nextLine.includes(cat)) {
              category = cat;
              break;
            }
          }
        } else {
          // Check if next line is a standalone category
          for (const cat of knownCategories) {
            if (nextLine === cat) {
              category = cat;
              break;
            }
          }
        }
      }

      const finalAmount = sign === '+' ? amount : -amount;

      transactions.push({
        date: transactionDate,
        description,
        amount: Math.abs(finalAmount),
        type: finalAmount > 0 ? 'income' : 'expense',
        category,
        rawLine: line,
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

  const periodMatch = fullText.match(/(\d{2})\.(\d{2})\.(\d{4})\s*jusqu['']au\s*(\d{2})\.(\d{2})\.(\d{4})/);
  if (periodMatch) {
    startDate = `${periodMatch[3]}-${periodMatch[2]}-${periodMatch[1]}`;
    endDate = `${periodMatch[6]}-${periodMatch[5]}-${periodMatch[4]}`;

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
