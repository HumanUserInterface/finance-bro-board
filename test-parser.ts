import { readFileSync, writeFileSync } from 'fs';
import { parseBankStatement } from './src/lib/pdf/bank-statement-parser';

async function test() {
  const buffer = readFileSync('/Users/victorpoulain/Library/Mobile Documents/com~apple~CloudDocs/Personnel/Downloads/Décembre.pdf');

  console.log('Starting parse...');
  const result = await parseBankStatement(buffer);

  // Debug: save raw text
  writeFileSync('/tmp/pdf-text.txt', result.rawText);
  console.log('Raw text saved to /tmp/pdf-text.txt');

  console.log('\n=== RESULTS ===');
  console.log('Transactions:', result.transactions.length);
  console.log('');
  console.log('=== TOTALS ===');
  console.log('Total Income:', result.summary.totalIncome.toFixed(2), '€');
  console.log('Total Expenses:', result.summary.totalExpenses.toFixed(2), '€');
  console.log('Net Change:', result.summary.netChange.toFixed(2), '€');
  console.log('');
  console.log('=== BREAKDOWN ===');
  console.log('External Income:', result.summary.externalIncome.toFixed(2), '€');
  console.log('External Expenses:', result.summary.externalExpenses.toFixed(2), '€');
  console.log('Internal Transfers:', result.summary.internalTransfers.toFixed(2), '€');
  console.log('');
  console.log('=== INTERNAL ACCOUNTS (N26 Espaces) ===');
  result.internalAccounts.forEach((acc) => {
    console.log(`${acc.name}:`);
    console.log(`  Sent to: ${acc.totalIn.toFixed(2)}€ | Received from: ${acc.totalOut.toFixed(2)}€ | Net: ${acc.netFlow >= 0 ? '+' : ''}${acc.netFlow.toFixed(2)}€ (${acc.transactionCount} txns)`);
  });
  console.log('');
  console.log('=== EXTERNAL TRANSACTIONS ===');
  const externalTxns = result.transactions.filter(tx => !tx.isInternalTransfer);
  externalTxns.slice(0, 10).forEach((tx, i) => {
    const sign = tx.type === 'income' ? '+' : '-';
    const cat = tx.category ? ' [' + tx.category + ']' : '';
    console.log((i+1) + '. ' + tx.date + ' | ' + tx.description + ' | ' + sign + tx.amount.toFixed(2) + '€' + cat);
  });
  if (externalTxns.length > 10) {
    console.log(`... and ${externalTxns.length - 10} more external transactions`);
  }
}
test().catch(console.error);
