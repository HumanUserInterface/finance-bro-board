'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
}

export default function BalancingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [rawText, setRawText] = useState<string>('');
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
      setParsedTransactions([]);
      setRawText('');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleParseDocument = async () => {
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      // For now, we'll read the PDF and display raw info
      // In a production app, you'd use a PDF parsing library or server-side processing
      const formData = new FormData();
      formData.append('file', file);

      // Store the file info for display purposes
      setRawText(`File: ${file.name}\nSize: ${(file.size / 1024).toFixed(2)} KB\nType: ${file.type}\n\nPDF parsing requires server-side processing.\nThis is a testing page to verify the upload workflow works.`);

      // Mock parsed transactions for demo
      // In production, this would come from actual PDF parsing
      const mockTransactions: ParsedTransaction[] = [
        { date: '2024-12-01', description: 'Salary - Company XYZ', amount: 2500, type: 'income', category: 'Salary' },
        { date: '2024-12-02', description: 'Supermarket', amount: -45.67, type: 'expense', category: 'Groceries' },
        { date: '2024-12-05', description: 'Netflix', amount: -15.99, type: 'expense', category: 'Subscriptions' },
      ];

      setParsedTransactions(mockTransactions);
    } catch (err) {
      setError('Failed to parse document. Please try again.');
      console.error(err);
    } finally {
      setParsing(false);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setParsedTransactions([]);
    setRawText('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Raw Text / Debug Info */}
      {rawText && (
        <Card>
          <CardHeader>
            <CardTitle>Document Info</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
              {rawText}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Parsed Transactions */}
      {parsedTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Transactions</CardTitle>
            <CardDescription>
              {parsedTransactions.length} transactions found (mock data for testing)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {parsedTransactions.map((tx, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-3 px-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-400 font-mono">
                      {new Date(tx.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}
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
                    {tx.type === 'income' ? '+' : ''}
                    {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Testing Mode</p>
              <p>
                This page is for testing the bank statement import workflow.
                Actual PDF parsing will be implemented with server-side processing
                to extract transaction data from N26 and other bank statements.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
