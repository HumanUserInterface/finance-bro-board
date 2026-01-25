'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Check, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import type { Tables } from '@/types/database';

type Profile = Tables<'profiles'>;

const currencies = [
  { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'British Pound (£)', symbol: '£' },
  { value: 'CAD', label: 'Canadian Dollar (C$)', symbol: 'C$' },
  { value: 'AUD', label: 'Australian Dollar (A$)', symbol: 'A$' },
  { value: 'JPY', label: 'Japanese Yen (¥)', symbol: '¥' },
  { value: 'CHF', label: 'Swiss Franc (CHF)', symbol: 'CHF' },
];

const timezones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('UTC');

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single() as any);

    if (!error && data) {
      setProfile(data as Profile);
      setDisplayName((data as Profile).display_name || '');
      setCurrency((data as Profile).currency || 'USD');
      setTimezone((data as Profile).timezone || 'UTC');
    }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any)
      .update({
        display_name: displayName || null,
        currency,
        timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function handleDeleteAllData() {
    if (deleteConfirm !== 'DELETE') {
      return;
    }

    setDeleting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setDeleting(false);
      return;
    }

    try {
      // Delete all user data in order (respecting foreign key constraints)
      await supabase.from('member_results').delete().eq('deliberation_id', null); // Will be cascaded from deliberations
      await supabase.from('deliberations').delete().eq('user_id', user.id);
      await supabase.from('purchase_requests').delete().eq('user_id', user.id);
      await supabase.from('transactions').delete().eq('user_id', user.id);
      await supabase.from('expenses').delete().eq('user_id', user.id);
      await supabase.from('bills').delete().eq('user_id', user.id);
      await supabase.from('savings_goals').delete().eq('user_id', user.id);
      await supabase.from('savings_accounts').delete().eq('user_id', user.id);
      await supabase.from('income_sources').delete().eq('user_id', user.id);
      await supabase.from('expense_categories').delete().eq('user_id', user.id);

      // Reset profile to defaults
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any)
        .update({
          display_name: null,
          currency: 'USD',
          timezone: 'UTC',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      setDeleteConfirm('');
      setDeleting(false);

      // Refresh the page to show clean state
      window.location.reload();
    } catch (error) {
      console.error('Error deleting data:', error);
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            Configure your display preferences and currency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                This is how you&apos;ll appear in the app
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                All amounts will be displayed in this currency
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Used for bill due dates and reminders
              </p>
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Saved!
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Manage your account settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">Email</p>
            <p className="text-sm text-muted-foreground">{profile?.id ? 'Logged in' : 'Not logged in'}</p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Testing & Debugging
          </CardTitle>
          <CardDescription>
            Dangerous operations for testing purposes only
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete All Data
              </p>
              <p className="text-sm text-muted-foreground">
                This will permanently delete all your financial data including income, expenses,
                bills, savings goals, transactions, purchase requests, and deliberations.
                Your profile will be reset to defaults. This action cannot be undone.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deleteConfirm">
                Type <span className="font-mono font-bold">DELETE</span> to confirm
              </Label>
              <Input
                id="deleteConfirm"
                placeholder="DELETE"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="font-mono"
              />
            </div>
            <Button
              variant="destructive"
              onClick={handleDeleteAllData}
              disabled={deleteConfirm !== 'DELETE' || deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting All Data...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
