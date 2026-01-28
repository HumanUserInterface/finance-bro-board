'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Gavel, Loader2, CheckCircle2, XCircle, Clock, AlertCircle, Trash2, RotateCcw, TrendingUp, Wallet, PiggyBank, AlertTriangle } from 'lucide-react';
import type { Tables } from '@/types/database';

type PurchaseRequest = Tables<'purchase_requests'>;
type Deliberation = Tables<'deliberations'>;
type MemberResult = Tables<'member_results'>;

// Extended financial context type from the API
interface FinancialContextWithAnalysis {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyBills: number;
  discretionaryBudget: number;
  totalSavings: number;
  analysis?: {
    health: {
      score: number;
      riskLevel: string;
      savingsRate: number;
      emergencyFundMonths: number;
      recommendations: string[];
    };
    affordability: {
      recommendation: string;
      percentageOfMonthlyIncome: number;
      percentageOfDisposableIncome: number;
      percentageOfSavings: number;
    };
  };
  insights?: {
    budgetAssessment: string;
    affordabilityVerdict: string;
    keyFinancialConcerns: string[];
    financialRecommendation: string;
    riskFactors: string[];
  };
}

const categories = [
  'Electronics',
  'Clothing',
  'Food & Dining',
  'Entertainment',
  'Home & Garden',
  'Health & Fitness',
  'Transportation',
  'Education',
  'Travel',
  'Subscriptions',
  'Other',
];

const urgencyLevels = [
  { value: 'low', label: 'Low - Can wait' },
  { value: 'medium', label: 'Medium - Would like soon' },
  { value: 'high', label: 'High - Need it now' },
];

function getAffordabilityColor(verdict: string): string {
  switch (verdict) {
    case 'easily_affordable':
      return 'text-green-600 bg-green-100';
    case 'affordable':
      return 'text-green-600 bg-green-50';
    case 'stretch':
      return 'text-yellow-600 bg-yellow-100';
    case 'risky':
    case 'not_recommended':
      return 'text-orange-600 bg-orange-100';
    case 'unaffordable':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

function getRiskColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'low':
      return 'text-green-600';
    case 'moderate':
      return 'text-yellow-600';
    case 'high':
      return 'text-orange-600';
    case 'critical':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

export default function DeliberatePage() {
  const [recentRequests, setRecentRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [deliberation, setDeliberation] = useState<Deliberation | null>(null);
  const [memberResults, setMemberResults] = useState<MemberResult[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const supabase = createClient();

  // Form state
  const [item, setItem] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<string>('medium');
  const [context, setContext] = useState('');

  useEffect(() => {
    fetchRecentRequests();
  }, []);

  async function fetchRecentRequests() {
    const { data, error } = await supabase
      .from('purchase_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setRecentRequests(data);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      return;
    }

    // Create the purchase request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: request, error } = await (supabase.from('purchase_requests') as any)
      .insert({
        user_id: user.id,
        item,
        price: parseFloat(price),
        category,
        description: description || null,
        urgency,
        context: context || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating request:', error);
      setSubmitting(false);
      return;
    }

    // Trigger deliberation API
    try {
      const response = await fetch('/api/deliberate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: request.id }),
      });

      if (!response.ok) {
        console.error('Deliberation failed');
      }
    } catch (err) {
      console.error('Error triggering deliberation:', err);
    }

    // Reset form and refresh
    setItem('');
    setPrice('');
    setCategory('');
    setDescription('');
    setUrgency('medium');
    setContext('');
    setSubmitting(false);
    fetchRecentRequests();
  }

  function getStatusBadge(status: PurchaseRequest['status'], clickable = false) {
    const baseClass = clickable ? 'cursor-pointer hover:opacity-80' : '';
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className={`bg-black/5 text-black ${baseClass}`}><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'deliberating':
        return <Badge variant="secondary" className={`bg-black/10 text-black ${baseClass}`}><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Deliberating</Badge>;
      case 'approved':
        return <Badge variant="secondary" className={`bg-green-100 text-green-800 ${baseClass}`}><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="secondary" className={`bg-red-100 text-red-800 ${baseClass}`}><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      case 'failed':
        return <Badge variant="secondary" className={`bg-black/20 text-black ${baseClass}`}><AlertCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      default:
        return null;
    }
  }

  async function openDetails(request: PurchaseRequest) {
    if (request.status !== 'approved' && request.status !== 'rejected') return;

    setSelectedRequest(request);
    setDetailOpen(true);
    setLoadingDetails(true);

    // Fetch deliberation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: delib } = await (supabase
      .from('deliberations')
      .select('*')
      .eq('purchase_id', request.id)
      .single() as any);

    if (delib) {
      setDeliberation(delib as Deliberation);

      // Fetch member results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: results } = await (supabase
        .from('member_results')
        .select('*')
        .eq('deliberation_id', delib.id)
        .order('persona_name') as any);

      if (results) {
        setMemberResults(results);
      }
    }

    setLoadingDetails(false);
  }

  async function handleDelete(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('purchase_requests') as any)
      .delete()
      .eq('id', id);
    fetchRecentRequests();
  }

  async function handleRetry(request: PurchaseRequest) {
    // Update status to pending first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('purchase_requests') as any)
      .update({ status: 'deliberating' })
      .eq('id', request.id);

    fetchRecentRequests();

    // Trigger deliberation API
    try {
      const response = await fetch('/api/deliberate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: request.id }),
      });

      if (!response.ok) {
        console.error('Deliberation failed');
      }
    } catch (err) {
      console.error('Error triggering deliberation:', err);
    }

    fetchRecentRequests();
  }

  // Extract financial context from deliberation
  const financialContext = deliberation?.financial_context as FinancialContextWithAnalysis | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Submit for Deliberation</h1>
        <p className="text-muted-foreground">
          Let your board of 17 financial advisors vote on your purchase
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Submission Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5" />
              New Purchase Request
            </CardTitle>
            <CardDescription>
              Describe what you want to buy and let the board decide
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="item">What do you want to buy?</Label>
                <Input
                  id="item"
                  placeholder="e.g., AirPods Pro, New Laptop, Gym Membership"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="249.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="urgency">How urgent is this?</Label>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {urgencyLevels.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Why do you want this? What will you use it for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="context">Additional Context (Optional)</Label>
                <Textarea
                  id="context"
                  placeholder="Any additional info the board should know? e.g., I've been saving for this, my old one broke, etc."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting || !category}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting to Board...
                  </>
                ) : (
                  <>
                    <Gavel className="mr-2 h-4 w-4" />
                    Submit for Deliberation
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
            <CardDescription>Your latest purchase deliberations</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : recentRequests.length === 0 ? (
              <div className="text-center py-8">
                <Gavel className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No requests yet.</p>
                <p className="text-sm text-muted-foreground">Submit your first purchase for deliberation!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div
                      className={request.status === 'approved' || request.status === 'rejected' ? 'cursor-pointer hover:opacity-70' : ''}
                      onClick={() => openDetails(request)}
                    >
                      <p className="font-medium">{request.item}</p>
                      <p className="text-sm text-muted-foreground">
                        ${request.price.toLocaleString('en-US', { minimumFractionDigits: 2 })} &bull; {request.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div onClick={() => openDetails(request)}>
                        {getStatusBadge(request.status, request.status === 'approved' || request.status === 'rejected')}
                      </div>
                      {request.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRetry(request)}
                          title="Retry deliberation"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleDelete(request.id); }}
                        title="Delete request"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRequest?.item}
              {selectedRequest && getStatusBadge(selectedRequest.status)}
            </DialogTitle>
            <DialogDescription>
              ${selectedRequest?.price.toLocaleString('en-US', { minimumFractionDigits: 2 })} &bull; {selectedRequest?.category}
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : deliberation ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="p-4 bg-black/5 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Final Decision</span>
                  <span className={`text-lg font-bold ${deliberation.final_decision === 'approve' ? 'text-green-600' : 'text-red-600'}`}>
                    {deliberation.final_decision === 'approve' ? 'APPROVED' : 'REJECTED'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="text-green-600">{deliberation.approve_count} approve</span>
                  <span className="text-red-600">{deliberation.reject_count} reject</span>
                  {deliberation.is_unanimous && <span className="font-medium">Unanimous</span>}
                </div>
              </div>

              {/* Financial Analysis Section */}
              {financialContext?.analysis && financialContext?.insights && (
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Financial Analysis
                  </h3>

                  {/* Affordability Badge */}
                  <div className="flex items-center gap-3">
                    <Badge className={getAffordabilityColor(financialContext.insights.affordabilityVerdict)}>
                      {financialContext.insights.affordabilityVerdict.replace('_', ' ')}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {financialContext.insights.budgetAssessment}
                    </span>
                  </div>

                  {/* Health Score */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <TrendingUp className="h-3 w-3" />
                        Health Score
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">{financialContext.analysis.health.score}</span>
                        <span className="text-sm text-muted-foreground">/100</span>
                      </div>
                      <Progress value={financialContext.analysis.health.score} className="h-1.5 mt-1" />
                    </div>

                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Wallet className="h-3 w-3" />
                        Budget Impact
                      </div>
                      <div className="text-xl font-bold">
                        {financialContext.analysis.affordability.percentageOfDisposableIncome.toFixed(1)}%
                      </div>
                      <span className="text-xs text-muted-foreground">of disposable income</span>
                    </div>

                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <PiggyBank className="h-3 w-3" />
                        Savings Impact
                      </div>
                      <div className="text-xl font-bold">
                        {financialContext.analysis.affordability.percentageOfSavings.toFixed(1)}%
                      </div>
                      <span className="text-xs text-muted-foreground">of total savings</span>
                    </div>

                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Risk Level
                      </div>
                      <div className={`text-xl font-bold capitalize ${getRiskColor(financialContext.analysis.health.riskLevel)}`}>
                        {financialContext.analysis.health.riskLevel}
                      </div>
                    </div>
                  </div>

                  {/* Key Concerns */}
                  {financialContext.insights.keyFinancialConcerns.length > 0 && (
                    <div className="p-3 border rounded-lg bg-yellow-50 border-yellow-200">
                      <div className="flex items-center gap-2 text-sm font-medium text-yellow-800 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        Key Concerns
                      </div>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        {financialContext.insights.keyFinancialConcerns.map((concern, i) => (
                          <li key={i}>• {concern}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendation */}
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium mb-1">Financial Recommendation</div>
                    <p className="text-sm text-muted-foreground">
                      {financialContext.insights.financialRecommendation}
                    </p>
                  </div>
                </div>
              )}

              {/* Individual Votes */}
              <div>
                <h3 className="font-semibold mb-3">Board Member Votes</h3>
                <div className="space-y-3">
                  {memberResults.map((result) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const vote = result.final_vote as any;
                    return (
                      <div key={result.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{result.persona_name}</span>
                          <Badge className={vote?.vote === 'approve' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {vote?.vote === 'approve' ? 'Approve' : 'Reject'} ({vote?.confidence}%)
                          </Badge>
                        </div>
                        {vote?.reasoning && (
                          <p className="text-sm text-muted-foreground mb-2">{vote.reasoning}</p>
                        )}
                        {vote?.keyFactors && vote.keyFactors.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {vote.keyFactors.map((factor: string, i: number) => (
                              <span key={i} className="text-xs bg-black/5 px-2 py-0.5 rounded">
                                {factor}
                              </span>
                            ))}
                          </div>
                        )}
                        {vote?.catchphrase && (
                          <p className="text-xs italic text-muted-foreground mt-2">&ldquo;{vote.catchphrase}&rdquo;</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No deliberation data found.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
