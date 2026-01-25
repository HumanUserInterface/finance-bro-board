'use client';

import { useState, useRef } from 'react';

interface PaycheckStepProps {
  salary: number | null;
  onSalaryChange: (salary: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PaycheckStep({ salary, onSalaryChange, onNext, onBack }: PaycheckStepProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editedSalary, setEditedSalary] = useState<string>(
    salary !== null ? salary.toString() : ''
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-paycheck', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      // Set the parsed salary
      if (result.parsedData?.netSalary) {
        onSalaryChange(result.parsedData.netSalary);
        setEditedSalary(result.parsedData.netSalary.toString());
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload paycheck');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        handleFileSelect(file);
      } else {
        setUploadError('Please upload a PDF file');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleManualInput = (value: string) => {
    setEditedSalary(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0) {
      onSalaryChange(parsed);
    }
  };

  const handleNext = () => {
    if (salary !== null && salary > 0) {
      onNext();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Upload Your Paycheck
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Upload your French paycheck PDF and we'll automatically extract your net salary
        </p>
      </div>

      {/* Upload Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileInput}
          className="hidden"
        />

        {isUploading ? (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-600 dark:text-slate-400">Analyzing your paycheck...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-3xl">
              📄
            </div>
            <div>
              <p className="text-lg font-medium text-slate-900 dark:text-slate-100">
                Drop your paycheck here or click to browse
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                PDF files only, max 5MB
              </p>
            </div>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{uploadError}</p>
        </div>
      )}

      {/* Manual Input */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-slate-300 dark:bg-slate-700" />
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Or enter manually
          </span>
          <div className="flex-1 h-px bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Monthly Net Salary (€)
          </label>
          <input
            type="number"
            value={editedSalary}
            onChange={(e) => handleManualInput(e.target.value)}
            placeholder="2500"
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          className="px-6 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={salary === null || salary <= 0}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
