import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { History, CheckCircle, XCircle, ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

interface DeliberationWithPurchase {
  id: string
  final_decision: string
  approve_count: number
  reject_count: number
  is_unanimous: boolean
  summary: string | null
  created_at: string
  purchase_id: string
  purchase?: {
    item: string
    price: number
    category: string
  }
}

export default async function HistoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  let deliberations: DeliberationWithPurchase[] = []

  if (user) {
    // Fetch deliberations
    const { data: delibData } = await supabase
      .from('deliberations')
      .select('id, final_decision, approve_count, reject_count, is_unanimous, summary, created_at, purchase_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (delibData && delibData.length > 0) {
      // Fetch all related purchases
      const purchaseIds = delibData.map(d => d.purchase_id)
      const { data: purchaseData } = await supabase
        .from('purchase_requests')
        .select('id, item, price, category')
        .in('id', purchaseIds)

      const purchaseMap = new Map(
        (purchaseData || []).map(p => [p.id, { item: p.item, price: p.price, category: p.category }])
      )

      deliberations = delibData.map(d => ({
        ...d,
        purchase: purchaseMap.get(d.purchase_id),
      }))
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Deliberation History</h1>
        <p className="text-muted-foreground">View past purchase decisions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Past Deliberations</CardTitle>
          <CardDescription>All your previous board discussions</CardDescription>
        </CardHeader>
        <CardContent>
          {deliberations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">No deliberations yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                When you ask the board about a purchase, it will appear here
              </p>
              <Button asChild>
                <Link href="/decide">Start a Deliberation</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {deliberations.map((deliberation) => {
                const isApproved = deliberation.final_decision === 'approve'
                const purchase = deliberation.purchase
                return (
                  <Link
                    key={deliberation.id}
                    href={`/decide/${deliberation.id}`}
                    className="block"
                  >
                    <div className={`p-4 rounded-lg border transition-colors hover:bg-muted/50 ${
                      isApproved ? 'border-green-200' : 'border-red-200'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {isApproved ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                          )}
                          <div>
                            <h3 className="font-medium">{purchase?.item || 'Unknown item'}</h3>
                            <p className="text-sm text-muted-foreground">
                              {purchase ? formatCurrency(purchase.price) : '$0'} • {purchase?.category || 'Unknown category'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={isApproved ? 'default' : 'destructive'}
                                className={isApproved ? 'bg-green-600' : ''}
                              >
                                {isApproved ? 'Approved' : 'Rejected'}
                              </Badge>
                              {deliberation.is_unanimous && (
                                <Badge variant="outline" className="text-xs">Unanimous</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {deliberation.approve_count}-{deliberation.reject_count} • {formatDate(deliberation.created_at)}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
