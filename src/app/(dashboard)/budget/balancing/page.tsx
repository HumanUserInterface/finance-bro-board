'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, Download, Trash2 } from 'lucide-react';

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string | null;
  selected?: boolean;
}

interface ParsedStatement {
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
}

export default function BalancingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedStatement, setParsedStatement] = useState<ParsedStatement | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [importSuccess, setImportSuccess] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setParsedStatement(null);
      setSelectedTransactions(new Set());
      setImportSuccess(null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleParseDocument = async () => {
    if (!file) return;

    setParsing(true);
    setError(null);
    setImportSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/parse-bank-statement', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse document');
      }

      setParsedStatement({
        transactions: data.transactions.map((tx: ParsedTransaction) => ({ ...tx, selected: true })),
        period: data.period,
        summary: data.summary,
        bankName: data.bankName,
        confidence: data.confidence,
      });

      // Select all transactions by default
      setSelectedTransactions(new Set(data.transactions.map((_: ParsedTransaction, i: number) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse document');
      console.error(err);
    } finally {
      setParsing(false);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setParsedStatement(null);
    setSelectedTransactions(new Set());
    setError(null);
    setImportSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleTransaction = (index: number) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTransactions(newSelected);
  };

  const toggleAllTransactions = () => {
    if (!parsedStatement) return;
    if (selectedTransactions.size === parsedStatement.transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(parsedStatement.transactions.map((_, i) => i)));
    }
  };

  const handleImportTransactions = async () => {
    if (!parsedStatement || selectedTransactions.size === 0) return;

    setImporting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const transactionsToImport = parsedStatement.transactions
        .filter((_, index) => selectedTransactions.has(index))
        .map((tx) => ({
          user_id: user.id,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          category: tx.category || (tx.type === 'income' ? 'Income' : 'Expense'),
          date: tx.date,
          notes: `Imported from bank statement${parsedStatement.bankName ? ` (${parsedStatement.bankName})` : ''}`,
        }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase.from('transactions') as any).insert(transactionsToImport);

      if (insertError) {
        throw new Error(insertError.message);
      }

      setImportSuccess(transactionsToImport.length);
      // Clear selection after successful import
      setSelectedTransactions(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import transactions');
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">High confidence</span>;
      case 'medium':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Medium confidence</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Low confidence</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Balancing</h1>
        <p className="text-muted-foreground">Import bank statements to reconcile your finances</p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Bank Statement
          </CardTitle>
          <CardDescription>
            Upload your N26 or other bank statement PDF to extract transactions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!file ? (
            <div
              onClick={handleUploadClick}
              className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
            >
              <FileText className="mx-auto h-12 w-12 text-slate-400 mb-4" />
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                Click to select a PDF bank statement
              </p>
              <p className="text-xs text-slate-400">
                Supported: N26, and other bank PDFs
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleClearFile}>
                    Remove
                  </Button>
                  <Button size="sm" onClick={handleParseDocument} disabled={parsing}>
                    {parsing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Parsing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Parse Document
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Success Message */}
      {importSuccess !== null && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-green-700 dark:text-green-300">
                Successfully imported {importSuccess} transaction{importSuccess !== 1 ? 's' : ''}!
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parsed Statement Summary */}
      {parsedStatement && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-3">
                  Statement Summary
                  {parsedStatement.bankName && (
                    <span className="text-sm font-normal text-slate-500">({parsedStatement.bankName})</span>
                  )}
                </CardTitle>
                <CardDescription>
                  {parsedStatement.period.month || (parsedStatement.period.startDate && parsedStatement.period.endDate
                    ? `${parsedStatement.period.startDate} to ${parsedStatement.period.endDate}`
                    : 'Period not detected')}
                </CardDescription>
              </div>
              {getConfidenceBadge(parsedStatement.confidence)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-500">Transactions</p>
                <p className="text-2xl font-semibold">{parsedStatement.summary.transactionCount}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4">
                <p className="text-sm text-green-600">Income</p>
                <p className="text-2xl font-semibold text-green-700">+{parsedStatement.summary.totalIncome.toFixed(2)}€</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4">
                <p className="text-sm text-red-600">Expenses</p>
                <p className="text-2xl font-semibold text-red-700">-{parsedStatement.summary.totalExpenses.toFixed(2)}€</p>
              </div>
              <div className={`rounded-lg p-4 ${parsedStatement.summary.netChange >= 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                <p className="text-sm text-slate-500">Net Change</p>
                <p className={`text-2xl font-semibold ${parsedStatement.summary.netChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {parsedStatement.summary.netChange >= 0 ? '+' : ''}{parsedStatement.summary.netChange.toFixed(2)}€
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parsed Transactions */}
      {parsedStatement && parsedStatement.transactions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Extracted Transactions</CardTitle>
                <CardDescription>
                  {selectedTransactions.size} of {parsedStatement.transactions.length} selected for import
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={toggleAllTransactions}>
                  {selectedTransactions.size === parsedStatement.transactions.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleImportTransactions}
                  disabled={importing || selectedTransactions.size === 0}
                >
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Import Selected ({selectedTransactions.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {parsedStatement.transactions.map((tx, index) => (
                <div
                  key={index}
                  onClick={() => toggleTransaction(index)}
                  className={`flex items-center justify-between py-3 px-4 rounded-lg cursor-pointer transition-colors ${
                    selectedTransactions.has(index)
                      ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                      : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.has(index)}
                      onChange={() => toggleTransaction(index)}
                      className="h-4 w-4 rounded border-slate-300"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm text-slate-400 font-mono w-20">
                      {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      {tx.category && (
                        <p className="text-xs text-slate-500">{tx.category}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`font-mono font-medium ${
                      tx.type === 'income'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {tx.amount.toFixed(2)}€
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No transactions found */}
      {parsedStatement && parsedStatement.transactions.length === 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/50">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-700 dark:text-yellow-300">No transactions found</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  The parser could not extract transactions from this PDF. This might happen if:
                </p>
                <ul className="text-sm text-yellow-600 dark:text-yellow-400 list-disc ml-4 mt-2">
                  <li>The PDF format is not yet supported</li>
                  <li>The statement is scanned (image-based) rather than text-based</li>
                  <li>The file is password protected or corrupted</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
