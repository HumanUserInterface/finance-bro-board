import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'path';

// Set worker path for server-side
const workerPath = path.join(
  process.cwd(),
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
);
pdfjs.GlobalWorkerOptions.workerSrc = workerPath;

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string | null;
  rawLine?: string;
  isInternalTransfer: boolean;
  internalAccount: string | null; // The N26 "Espace" involved
  transferDirection: 'from' | 'to' | null; // Direction of internal transfer
}

export interface InternalAccountSummary {
  name: string;
  totalIn: number;  // Money received from this account
  totalOut: number; // Money sent to this account
  netFlow: number;  // totalIn - totalOut
  transactionCount: number;
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
    // Breakdown by type
    externalIncome: number;
    externalExpenses: number;
    internalTransfers: number;
  };
  internalAccounts: InternalAccountSummary[];
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

  // Load PDF with worker disabled
  const loadingTask = pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;

  console.log('[BANK-PARSER] PDF loaded, pages:', doc.numPages);

  // Extract text from each page
  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    // Get text items and sort by position
    const items = textContent.items as Array<{ str: string; transform: number[] }>;

    // Sort by y (top to bottom) then x (left to right)
    items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 5) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    // Group into lines and join text
    let currentY = items.length > 0 ? items[0].transform[5] : 0;
    let currentLine: string[] = [];
    const lines: string[] = [];

    for (const item of items) {
      const y = item.transform[5];
      if (Math.abs(y - currentY) > 5) {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(' '));
        }
        currentLine = [];
        currentY = y;
      }
      if (item.str.trim()) {
        currentLine.push(item.str.trim());
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }

    pageTexts.push(lines.join('\n'));
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

    // pdfjs-dist format: "DESCRIPTION DD.MM.YYYY [+/-]XX,XX€"
    // e.g., "CAGNARD 01.12.2025 -9,00€" or "De Plaisirs 01.12.2025 +40,00€"
    const transactionPattern = /^(.+?)\s+(\d{2})\.(\d{2})\.(\d{4})\s+([+-])?(\d{1,3}(?:\.\d{3})*,\d{2})€$/;

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

      // Skip headers and metadata
      if (description === 'Description Date de réservation') continue;
      if (description.includes('VICTOR MICHEL PASCAL')) continue;
      if (description.match(/^\d+\s*\/\s*\d+$/)) continue; // Page number
      if (description.match(/^IBAN:/)) continue;
      if (description.length < 2) continue;

      // Look at the next line for category
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
          // Check for standalone category
          const matchedCategory = knownCategories.find(c => nextLine === c);
          if (matchedCategory) {
            category = matchedCategory;
          }
        }
      }

      const finalAmount = sign === '+' ? amount : -amount;

      // Detect internal transfers (De/Vers)
      let isInternalTransfer = false;
      let internalAccount: string | null = null;
      let transferDirection: 'from' | 'to' | null = null;

      if (description.startsWith('De ')) {
        isInternalTransfer = true;
        internalAccount = description.substring(3); // Remove "De "
        transferDirection = 'from';
      } else if (description.startsWith('Vers ')) {
        isInternalTransfer = true;
        internalAccount = description.substring(5); // Remove "Vers "
        transferDirection = 'to';
      }

      transactions.push({
        date: transactionDate,
        description,
        amount: Math.abs(finalAmount),
        type: finalAmount > 0 ? 'income' : 'expense',
        category,
        rawLine: line,
        isInternalTransfer,
        internalAccount,
        transferDirection,
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
  let externalIncome = 0;
  let externalExpenses = 0;
  let internalTransfers = 0;

  // Track internal accounts
  const accountMap = new Map<string, InternalAccountSummary>();

  for (const tx of uniqueTransactions) {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
      if (tx.isInternalTransfer) {
        internalTransfers += tx.amount;
      } else {
        externalIncome += tx.amount;
      }
    } else {
      totalExpenses += tx.amount;
      if (tx.isInternalTransfer) {
        internalTransfers += tx.amount;
      } else {
        externalExpenses += tx.amount;
      }
    }

    // Track internal account flows
    if (tx.isInternalTransfer && tx.internalAccount) {
      const accountName = tx.internalAccount;
      if (!accountMap.has(accountName)) {
        accountMap.set(accountName, {
          name: accountName,
          totalIn: 0,
          totalOut: 0,
          netFlow: 0,
          transactionCount: 0,
        });
      }
      const account = accountMap.get(accountName)!;
      account.transactionCount++;
      if (tx.transferDirection === 'from') {
        // "De X" means money came FROM that account (we received it)
        account.totalOut += tx.amount; // It left that account
      } else {
        // "Vers X" means money went TO that account (we sent it)
        account.totalIn += tx.amount; // It entered that account
      }
      account.netFlow = account.totalIn - account.totalOut;
    }
  }

  // Convert account map to sorted array
  const internalAccounts = Array.from(accountMap.values())
    .sort((a, b) => b.transactionCount - a.transactionCount);

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
      externalIncome,
      externalExpenses,
      internalTransfers,
    },
    internalAccounts,
    bankName,
    confidence,
    rawText: '',
  };
}
