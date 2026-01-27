'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { TrendingDown, Loader2, Upload, ZoomOut } from 'lucide-react';
import { Sankey, Tooltip, Layer, Rectangle } from 'recharts';
import type { Tables } from '@/types/database';

type Transaction = Tables<'transactions'>;

// Time period options for Sankey
const sankeyPeriods = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: '3-months', label: 'Last 3 Months' },
  { value: '6-months', label: 'Last 6 Months' },
  { value: 'this-year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

function getSankeyDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  let startDate: string;

  switch (period) {
    case 'this-month':
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      break;
    case 'last-month':
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate = lastMonth.toISOString().split('T')[0];
      break;
    case '3-months':
      const threeMonths = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      startDate = threeMonths.toISOString().split('T')[0];
      break;
    case '6-months':
      const sixMonths = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      startDate = sixMonths.toISOString().split('T')[0];
      break;
    case 'this-year':
      startDate = `${now.getFullYear()}-01-01`;
      break;
    case 'all':
    default:
      startDate = '2000-01-01';
      break;
  }

  return { startDate, endDate };
}

export default function MoneyFlowPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sankeyPeriod, setSankeyPeriod] = useState('6-months');
  const [loading, setLoading] = useState(true);
  const [sankeyZoom, setSankeyZoom] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const sankeyContainerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Measure container width for responsive Sankey
  useEffect(() => {
    const measureWidth = () => {
      if (sankeyContainerRef.current) {
        setContainerWidth(sankeyContainerRef.current.offsetWidth);
      }
    };
    measureWidth();
    window.addEventListener('resize', measureWidth);
    return () => window.removeEventListener('resize', measureWidth);
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [sankeyPeriod]);

  async function fetchTransactions() {
    setLoading(true);
    const { startDate, endDate } = getSankeyDateRange(sankeyPeriod);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase
      .from('transactions')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate) as any);
    if (data) {
      setTransactions(data);
    }
    setLoading(false);
  }

  // Prepare Sankey data from transactions with 4 levels:
  // Income → Expense Type (Essential/Discretionary/Savings) → Category → Merchant
  const sankeyData = useMemo(() => {
    if (transactions.length === 0) return null;

    // Map categories to expense types
    const categoryToType: Record<string, 'essential' | 'discretionary'> = {
      // Essential - things you need
      'Courses alimentaires': 'essential',
      'Groceries': 'essential',
      'Bills & Utilities': 'essential',
      'Health & Fitness': 'essential',
      'Santé et pharmacie': 'essential',
      'Transportation': 'essential',
      'Transports': 'essential',
      'Gas': 'essential',
      'Home': 'essential',
      'Rent': 'essential',
      'Insurance': 'essential',
      'Multimédia & Télécom': 'essential',
      'Frais professionnels': 'essential',
      // Discretionary - things you want
      'Shopping': 'discretionary',
      'Bars et restaurants': 'discretionary',
      'Food & Dining': 'discretionary',
      'Entertainment': 'discretionary',
      'Loisirs': 'discretionary',
      'Travel': 'discretionary',
      'Personal Care': 'discretionary',
      'Subscriptions': 'discretionary',
      'Gifts': 'discretionary',
      'Education': 'discretionary',
      'Other': 'discretionary',
    };

    // Calculate totals
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    // Group expenses by category, type, and merchant
    const categoryTotals: Record<string, number> = {};
    const typeTotals: Record<string, number> = { essential: 0, discretionary: 0 };
    const merchantsByCategory: Record<string, Record<string, number>> = {};

    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const cat = t.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
        const expenseType = categoryToType[cat] || 'discretionary';
        typeTotals[expenseType] += t.amount;

        // Group by merchant/description within category
        if (!merchantsByCategory[cat]) {
          merchantsByCategory[cat] = {};
        }
        // Clean up description - take first part before common separators
        let merchant = t.description || 'Unknown';
        // Truncate long names
        if (merchant.length > 20) {
          merchant = merchant.substring(0, 20) + '...';
        }
        merchantsByCategory[cat][merchant] = (merchantsByCategory[cat][merchant] || 0) + t.amount;
      });

    const totalExpenses = typeTotals.essential + typeTotals.discretionary;
    const savings = Math.max(0, totalIncome - totalExpenses);

    // Build nodes array
    const nodes: { name: string }[] = [
      { name: `Income (€${totalIncome.toFixed(0)})` },
      { name: `Essential (€${typeTotals.essential.toFixed(0)})` },
      { name: `Discretionary (€${typeTotals.discretionary.toFixed(0)})` },
    ];

    if (savings > 0) {
      nodes.push({ name: `Savings (€${savings.toFixed(0)})` });
    }
    const savingsIndex = savings > 0 ? 3 : -1;
    let currentIndex = savings > 0 ? 4 : 3;

    // Get top categories per type
    const essentialCategories = Object.entries(categoryTotals)
      .filter(([cat]) => (categoryToType[cat] || 'discretionary') === 'essential')
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);

    const discretionaryCategories = Object.entries(categoryTotals)
      .filter(([cat]) => (categoryToType[cat] || 'discretionary') === 'discretionary')
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);

    const allCategories = [...essentialCategories, ...discretionaryCategories];

    // Add category nodes and track indices
    const categoryIndices: Record<string, number> = {};
    allCategories.forEach(([cat, amount]) => {
      nodes.push({ name: `${cat} (€${amount.toFixed(0)})` });
      categoryIndices[cat] = currentIndex++;
    });

    // Add merchant nodes for each category (top 3 per category)
    const merchantIndices: Record<string, Record<string, number>> = {};
    allCategories.forEach(([cat]) => {
      merchantIndices[cat] = {};
      const merchants = Object.entries(merchantsByCategory[cat] || {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      merchants.forEach(([merchant, amount]) => {
        nodes.push({ name: `${merchant} (€${amount.toFixed(0)})` });
        merchantIndices[cat][merchant] = currentIndex++;
      });
    });

    // Build links
    const links: { source: number; target: number; value: number }[] = [];

    // Level 1: Income → Types
    if (typeTotals.essential > 0) {
      links.push({ source: 0, target: 1, value: typeTotals.essential });
    }
    if (typeTotals.discretionary > 0) {
      links.push({ source: 0, target: 2, value: typeTotals.discretionary });
    }
    if (savings > 0) {
      links.push({ source: 0, target: savingsIndex, value: savings });
    }

    // Level 2: Types → Categories
    essentialCategories.forEach(([cat, amount]) => {
      links.push({ source: 1, target: categoryIndices[cat], value: amount });
    });
    discretionaryCategories.forEach(([cat, amount]) => {
      links.push({ source: 2, target: categoryIndices[cat], value: amount });
    });

    // Level 3: Categories → Merchants
    allCategories.forEach(([cat]) => {
      const merchants = Object.entries(merchantsByCategory[cat] || {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      merchants.forEach(([merchant, amount]) => {
        links.push({
          source: categoryIndices[cat],
          target: merchantIndices[cat][merchant],
          value: amount,
        });
      });
    });

    return { nodes, links, categoryToType, categoryTotals, merchantsByCategory, typeTotals, totalIncome, savings };
  }, [transactions]);

  // Filtered Sankey data when zoomed into a specific category
  const zoomedSankeyData = useMemo(() => {
    if (!sankeyZoom || !sankeyData) return null;

    const { merchantsByCategory, categoryTotals } = sankeyData;
    const categoryAmount = categoryTotals[sankeyZoom] || 0;

    // Build zoomed view: Category → All merchants
    const nodes: { name: string }[] = [
      { name: `${sankeyZoom} (€${categoryAmount.toFixed(0)})` },
    ];

    const merchants = Object.entries(merchantsByCategory[sankeyZoom] || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15); // Show more merchants when zoomed

    merchants.forEach(([merchant, amount]) => {
      nodes.push({ name: `${merchant} (€${Number(amount).toFixed(0)})` });
    });

    const links = merchants.map(([, amount], index) => ({
      source: 0,
      target: index + 1,
      value: amount as number,
    }));

    return { nodes, links };
  }, [sankeyZoom, sankeyData]);

  // Data to display (zoomed or full)
  const displaySankeyData = sankeyZoom ? zoomedSankeyData : sankeyData;

  // Handle node click for zoom
  const handleNodeClick = useCallback((data: { name: string }) => {
    const name = data.name;
    // Extract category name (remove amount)
    const categoryMatch = name.match(/^(.+?)\s*\(€/);
    if (!categoryMatch) return;

    const categoryName = categoryMatch[1];

    // Don't zoom on Income, Essential, Discretionary, Savings, or merchants
    const nonZoomableKeywords = ['Income', 'Essential', 'Discretionary', 'Savings'];
    if (nonZoomableKeywords.some(kw => categoryName.includes(kw))) return;

    // Check if this is a category (not a merchant) - merchants have shorter names typically
    if (sankeyData?.categoryTotals[categoryName]) {
      setSankeyZoom(categoryName);
    }
  }, [sankeyData]);

  // Custom node for Sankey with multi-level colors and click handling
  const SankeyNode = useCallback(({ x, y, width, height, index, payload }: {
    x: number; y: number; width: number; height: number; index: number; payload: { name: string }
  }) => {
    const name = payload.name;
    let color = '#9ca3af'; // default gray for merchants
    let isClickable = false;

    // Level 0: Income (green)
    if (index === 0 && !sankeyZoom) {
      color = '#16a34a';
    }
    // Level 1: Essential (amber/orange)
    else if (name.includes('Essential')) {
      color = '#f59e0b';
    }
    // Level 1: Discretionary (red)
    else if (name.includes('Discretionary')) {
      color = '#dc2626';
    }
    // Level 1: Savings (blue)
    else if (name.includes('Savings')) {
      color = '#3b82f6';
    }
    // Zoomed category header
    else if (sankeyZoom && index === 0) {
      const essentialKeywords = ['Courses', 'Groceries', 'Bills', 'Health', 'Santé', 'Transport', 'Gas', 'Home', 'Rent', 'Insurance', 'Multimédia', 'Télécom', 'Frais'];
      const isEssential = essentialKeywords.some(kw => name.includes(kw));
      color = isEssential ? '#f59e0b' : '#dc2626';
    }
    // Level 2: Known categories
    else {
      const essentialKeywords = ['Courses', 'Groceries', 'Bills', 'Health', 'Santé', 'Transport', 'Gas', 'Home', 'Rent', 'Insurance', 'Multimédia', 'Télécom', 'Frais'];
      const discretionaryKeywords = ['Shopping', 'Bars', 'restaurants', 'Food', 'Dining', 'Entertainment', 'Loisirs', 'Travel', 'Personal', 'Subscriptions', 'Gifts', 'Education', 'Other'];

      const isEssentialCategory = essentialKeywords.some(kw => name.includes(kw));
      const isDiscretionaryCategory = discretionaryKeywords.some(kw => name.includes(kw));

      if (isEssentialCategory) {
        color = '#fbbf24';
        isClickable = true;
      } else if (isDiscretionaryCategory) {
        color = '#f87171';
        isClickable = true;
      }
    }

    const isLeftSide = index === 0;

    return (
      <Layer key={`node-${index}`}>
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={height}
          fill={color}
          fillOpacity={0.9}
          style={{ cursor: isClickable ? 'pointer' : 'default' }}
          onClick={() => isClickable && handleNodeClick(payload)}
        />
        <text
          x={isLeftSide ? x - 8 : x + width + 8}
          y={y + height / 2}
          textAnchor={isLeftSide ? 'end' : 'start'}
          dominantBaseline="middle"
          fontSize={Math.max(9, Math.min(11, containerWidth / 100))}
          fill="#333"
          style={{ cursor: isClickable ? 'pointer' : 'default' }}
          onClick={() => isClickable && handleNodeClick(payload)}
        >
          {payload.name}
        </text>
      </Layer>
    );
  }, [sankeyZoom, handleNodeClick, containerWidth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Money Flow</h1>
          <p className="text-muted-foreground">Visualize how your money flows from income to expenses</p>
        </div>
      </div>

      {/* Money Flow Sankey Diagram */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Money Flow Diagram
                {sankeyZoom && (
                  <Badge variant="secondary" className="ml-2">{sankeyZoom}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {sankeyZoom ? 'Click "Zoom Out" to see full view' : 'Use buttons below to zoom into a category'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {sankeyZoom && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSankeyZoom(null)}
                >
                  <ZoomOut className="h-4 w-4 mr-1" />
                  Zoom Out
                </Button>
              )}
              <Select value={sankeyPeriod} onValueChange={(v) => { setSankeyPeriod(v); setSankeyZoom(null); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sankeyPeriods.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div ref={sankeyContainerRef} className="w-full">
            {displaySankeyData && displaySankeyData.links.length > 0 ? (
              <>
                <div className={`w-full overflow-x-auto ${sankeyZoom ? 'h-[400px]' : 'h-[500px]'}`}>
                  <Sankey
                    width={Math.max(containerWidth - 40, 600)}
                    height={sankeyZoom ? 380 : 480}
                    data={displaySankeyData}
                    node={SankeyNode}
                    nodePadding={sankeyZoom ? 8 : 12}
                    nodeWidth={10}
                    linkCurvature={0.5}
                    margin={{
                      top: 10,
                      right: Math.min(200, containerWidth * 0.2),
                      bottom: 10,
                      left: Math.min(120, containerWidth * 0.12)
                    }}
                  >
                    <Tooltip
                      formatter={(value) => [`€${Number(value).toFixed(2)}`, 'Amount']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e5e5' }}
                    />
                  </Sankey>
                </div>
                {/* Category zoom buttons */}
                {!sankeyZoom && sankeyData && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="text-sm text-muted-foreground mr-2 self-center">Zoom into:</span>
                    {Object.entries(sankeyData.categoryTotals)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 8)
                      .map(([cat, amount]) => (
                        <Button
                          key={cat}
                          variant="outline"
                          size="sm"
                          onClick={() => setSankeyZoom(cat)}
                          className="text-xs"
                        >
                          {cat} (€{amount.toFixed(0)})
                        </Button>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No transaction data available.</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Import transactions from your bank statement to see money flow.
                </p>
                <Link href="/bank/import">
                  <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Import Transactions
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {sankeyData && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-widest text-green-600">Total Income</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-green-700">
                €{sankeyData.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-widest text-amber-600">Essential</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-amber-700">
                €{sankeyData.typeTotals.essential.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-widest text-red-600">Discretionary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-red-700">
                €{sankeyData.typeTotals.discretionary.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-widest text-blue-600">Savings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-blue-700">
                €{sankeyData.savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
