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
import { Gavel, Loader2, CheckCircle2, XCircle, Clock, AlertCircle, Trash2, RotateCcw } from 'lucide-react';
import type { Tables } from '@/types/database';

type PurchaseRequest = Tables<'purchase_requests'>;

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

export default function DeliberatePage() {
  const [recentRequests, setRecentRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  function getStatusBadge(status: PurchaseRequest['status']) {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-black/5 text-black"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'deliberating':
        return <Badge variant="secondary" className="bg-black/10 text-black"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Deliberating</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-black/5 text-black"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="secondary" className="bg-black/5 text-black"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      case 'failed':
        return <Badge variant="secondary" className="bg-black/20 text-black"><AlertCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      default:
        return null;
    }
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
                    <div>
                      <p className="font-medium">{request.item}</p>
                      <p className="text-sm text-muted-foreground">
                        ${request.price.toLocaleString('en-US', { minimumFractionDigits: 2 })} &bull; {request.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(request.status)}
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
                        onClick={() => handleDelete(request.id)}
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
    </div>
  );
}
