'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface MonthlyIncomeUpdateProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

interface CurrentIncome {
  salary: number | null;
  apl: number;
  primeActivite: number;
}

export function MonthlyIncomeUpdate({ isOpen, onClose, onUpdate }: MonthlyIncomeUpdateProps) {
  const [activeTab, setActiveTab] = useState<'paycheck' | 'benefits'>('paycheck');
  const [currentIncome, setCurrentIncome] = useState<CurrentIncome>({
    salary: null,
    apl: 0,
    primeActivite: 0,
  });
  const [newSalary, setNewSalary] = useState<number | null>(null);
  const [newApl, setNewApl] = useState(0);
  const [newPrimeActivite, setNewPrimeActivite] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current income when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadCurrentIncome();
    }
  }, [isOpen]);

  const loadCurrentIncome = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: incomeSources } = await supabase
        .from('income_sources')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (incomeSources) {
        const salary = incomeSources.find((s) => s.type === 'salary');
        const apl = incomeSources.find((s) => s.type === 'apl');
        const prime = incomeSources.find((s) => s.type === 'prime_activite');

        setCurrentIncome({
          salary: salary?.amount || null,
          apl: apl?.amount || 0,
          primeActivite: prime?.amount || 0,
        });

        setNewApl(apl?.amount || 0);
        setNewPrimeActivite(prime?.amount || 0);
      }
    } catch (error) {
      console.error('Error loading current income:', error);
    }
  };

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

      if (result.parsedData?.netSalary) {
        setNewSalary(result.parsedData.netSalary);
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

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      // Update salary if changed
      if (newSalary !== null && newSalary !== currentIncome.salary) {
        const { data: existingSalary } = await supabase
          .from('income_sources')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'salary')
          .eq('is_active', true)
          .single();

        if (existingSalary) {
          await supabase
            .from('income_sources')
            .update({ amount: newSalary, updated_at: new Date().toISOString() })
            .eq('id', existingSalary.id);
        } else {
          await supabase.from('income_sources').insert({
            user_id: user.id,
            name: 'Monthly Salary',
            type: 'salary',
            amount: newSalary,
            frequency: 'monthly',
          });
        }
      }

      // Update APL if changed
      if (newApl !== currentIncome.apl) {
        const { data: existingApl } = await supabase
          .from('income_sources')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'apl')
          .eq('is_active', true)
          .single();

        if (newApl > 0) {
          if (existingApl) {
            await supabase
              .from('income_sources')
              .update({ amount: newApl, updated_at: new Date().toISOString() })
              .eq('id', existingApl.id);
          } else {
            await supabase.from('income_sources').insert({
              user_id: user.id,
              name: 'APL',
              type: 'apl',
              amount: newApl,
              frequency: 'monthly',
            });
          }
        } else if (existingApl) {
          // If set to 0, deactivate
          await supabase.from('income_sources').update({ is_active: false }).eq('id', existingApl.id);
        }
      }

      // Update Prime d'Activité if changed
      if (newPrimeActivite !== currentIncome.primeActivite) {
        const { data: existingPrime } = await supabase
          .from('income_sources')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'prime_activite')
          .eq('is_active', true)
          .single();

        if (newPrimeActivite > 0) {
          if (existingPrime) {
            await supabase
              .from('income_sources')
              .update({ amount: newPrimeActivite, updated_at: new Date().toISOString() })
              .eq('id', existingPrime.id);
          } else {
            await supabase.from('income_sources').insert({
              user_id: user.id,
              name: 'Prime d\'Activité',
              type: 'prime_activite',
              amount: newPrimeActivite,
              frequency: 'monthly',
            });
          }
        } else if (existingPrime) {
          await supabase
            .from('income_sources')
            .update({ is_active: false })
            .eq('id', existingPrime.id);
        }
      }

      // Update profile
      await supabase
        .from('profiles')
        .update({ monthly_income_last_updated: new Date().toISOString() })
        .eq('id', user.id);

      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving income:', error);
      setUploadError('Failed to save income updates');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const salaryDifference =
    newSalary !== null && currentIncome.salary !== null
      ? newSalary - currentIncome.salary
      : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Update Monthly Income
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('paycheck')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'paycheck'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Paycheck
          </button>
          <button
            onClick={() => setActiveTab('benefits')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'benefits'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Benefits
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'paycheck' ? (
            <div className="space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400'
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
                  <div className="space-y-3">
                    <div className="w-12 h-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-600 dark:text-slate-400">Analyzing paycheck...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-4xl">📄</div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Upload new paycheck
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">PDF only, max 5MB</p>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-800 dark:text-red-200 text-sm">{uploadError}</p>
                </div>
              )}

              {currentIncome.salary !== null && (
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Current salary</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    €{currentIncome.salary.toFixed(2)}
                  </p>
                </div>
              )}

              {newSalary !== null && (
                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-blue-600 dark:text-blue-400">New salary</p>
                  <div className="flex items-end gap-3">
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      €{newSalary.toFixed(2)}
                    </p>
                    {salaryDifference !== null && (
                      <p
                        className={`text-lg font-semibold ${
                          salaryDifference > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {salaryDifference > 0 ? '+' : ''}€{salaryDifference.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    APL (Housing Aid)
                  </label>
                  <input
                    type="number"
                    value={newApl}
                    onChange={(e) => setNewApl(parseFloat(e.target.value) || 0)}
                    min="0"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  {newApl !== currentIncome.apl && (
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Changed from €{currentIncome.apl.toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Prime d'Activité (Activity Bonus)
                  </label>
                  <input
                    type="number"
                    value={newPrimeActivite}
                    onChange={(e) => setNewPrimeActivite(parseFloat(e.target.value) || 0)}
                    min="0"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  {newPrimeActivite !== currentIncome.primeActivite && (
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Changed from €{currentIncome.primeActivite.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
