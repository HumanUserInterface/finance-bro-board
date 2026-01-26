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

    // Join lines
    const pageText = lines.map(line => line.join(' ')).join('\n');
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

  // Filter to only main account pages (not Espace pages)
  const mainAccountPages: string[] = [];
  for (const pageText of pageTexts) {
    // Skip "Relevé Espace" pages (sub-account statements)
    if (pageText.includes('Relevé Espace')) continue;
    // Skip "Vue d'ensemble" and "Espaces vue d'ensemble" summary pages
    if (pageText.includes("Vue d'ensemble") || pageText.includes('Espaces vue')) continue;
    // Only include main account pages (Relevé de compte)
    if (pageText.includes('Relevé de compte')) {
      mainAccountPages.push(pageText);
    }
  }

  console.log('[BANK-PARSER] Found', mainAccountPages.length, 'main account pages');

  // Process each main account page
  for (const pageText of mainAccountPages) {
    const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Find transactions by looking for amount patterns
    // Amount format: [+/-]XX,XX€ or [+/-]X.XXX,XX€
    const amountPattern = /([+-])(\d{1,3}(?:\.\d{3})*,\d{2})€/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line contains an amount at the end
      const amountMatch = line.match(new RegExp(amountPattern.source + '$'));
      if (!amountMatch) continue;

      const sign = amountMatch[1];
      const amountStr = amountMatch[2];
      const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
      if (isNaN(amount) || amount === 0) continue;

      // The line format is typically: "DD.MM.YYYY [+/-]XX,XX€"
      // The description is on preceding lines
      const dateMatch = line.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (!dateMatch) continue;

      const transactionDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

      // Look backwards for description
      let description = '';
      let category: string | null = null;

      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const prevLine = lines[j];

        // Stop conditions
        if (prevLine.match(/(\d{2})\.(\d{2})\.(\d{4})\s*([+-])(\d{1,3}(?:\.\d{3})*,\d{2})€$/)) break; // Previous transaction
        if (prevLine.includes('Relevé de compte')) break;
        if (prevLine.includes('Description Date')) break;
        if (prevLine.includes('VICTOR MICHEL PASCAL POULAIN')) break;
        if (prevLine.includes('Rue du Gros Gérard')) break;
        if (prevLine.match(/^\d+\s*\/\s*\d+$/)) break; // Page number

        // Skip metadata
        if (prevLine.startsWith('Date de valeur')) continue;
        if (prevLine.startsWith('IBAN:')) continue;
        if (prevLine.match(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2,}/)) continue; // BIC pattern
        if (prevLine.includes('Émis le')) continue;
        if (prevLine.match(/^N°\s*\d+\/\d+$/)) continue;

        // Check for Mastercard + category line
        if (prevLine.startsWith('Mastercard')) {
          for (const cat of knownCategories) {
            if (prevLine.includes(cat)) {
              category = cat;
              break;
            }
          }
          continue;
        }

        // Check for standalone category line
        const matchedCategory = knownCategories.find(c => prevLine === c);
        if (matchedCategory) {
          category = matchedCategory;
          continue;
        }

        // This should be the description
        description = prevLine;
        break;
      }

      // Skip if no valid description
      if (!description) continue;
      if (description.length < 2) continue;

      // Skip internal transfers (De/Vers)
      if (description.startsWith('De ')) continue;
      if (description.startsWith('Vers ')) continue;

      // Skip round-ups
      if (description.includes('Arrondis')) continue;

      // Skip metadata garbage
      if (description.includes('Montant original')) continue;
      if (description.match(/^FR\d/)) continue; // IBAN
      if (description === 'Description') continue;

      const finalAmount = sign === '+' ? amount : -amount;

      transactions.push({
        date: transactionDate,
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
