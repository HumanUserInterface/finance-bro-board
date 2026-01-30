import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, CheckCircle, XCircle, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"

interface MemberVote {
  vote: 'approve' | 'reject'
  reasoning: string
  confidence: number
  keyFactors: string[]
  catchphrase: string
}

interface MemberResult {
  id: string
  persona_slug: string
  persona_name: string
  final_vote: MemberVote
}

export default async function DeliberationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch deliberation with purchase and member results
  const { data: deliberation, error: delibError } = await supabase
    .from('deliberations')
    .select('*')
    .eq('id', id)
    .single()

  if (delibError || !deliberation) {
    notFound()
  }

  // Fetch purchase details
  const { data: purchase } = await supabase
    .from('purchase_requests')
    .select('*')
    .eq('id', deliberation.purchase_id)
    .single()

  // Fetch member results
  const { data: memberResults } = await supabase
    .from('member_results')
    .select('*')
    .eq('deliberation_id', id)
    .order('created_at', { ascending: true })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isApproved = deliberation.final_decision === 'approve'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/history">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Board Deliberation</h1>
          <p className="text-muted-foreground">
            {purchase?.item || 'Unknown item'} • {formatDate(deliberation.created_at)}
          </p>
        </div>
      </div>

      {/* Purchase Details */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Request</CardTitle>
          <CardDescription>What you wanted to buy</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Item</p>
              <p className="font-medium">{purchase?.item || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price</p>
              <p className="font-medium">{purchase ? formatCurrency(purchase.price) : '$0'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Category</p>
              <p className="font-medium capitalize">{purchase?.category || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Urgency</p>
              <p className="font-medium capitalize">{purchase?.urgency || 'Unknown'}</p>
            </div>
            {purchase?.description && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Context</p>
                <p className="font-medium">{purchase.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Board Verdict */}
      <Card className={isApproved ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isApproved ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                Board Verdict
              </CardTitle>
              <CardDescription>The final decision</CardDescription>
            </div>
            <Badge
              variant={isApproved ? 'default' : 'destructive'}
              className={isApproved ? 'bg-green-600' : ''}
            >
              {isApproved ? 'Approved' : 'Rejected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{deliberation.approve_count}</p>
                <p className="text-sm text-muted-foreground">Approve</p>
              </div>
              <div className="text-2xl text-muted-foreground">vs</div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{deliberation.reject_count}</p>
                <p className="text-sm text-muted-foreground">Reject</p>
              </div>
              {deliberation.is_unanimous && (
                <Badge variant="outline" className="ml-4">
                  Unanimous
                </Badge>
              )}
            </div>
            {deliberation.summary && (
              <p className="text-muted-foreground">{deliberation.summary}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Individual Votes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Individual Votes
          </CardTitle>
          <CardDescription>What each board member thinks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {((memberResults as unknown as MemberResult[]) || []).map((result) => {
              const vote = result.final_vote as MemberVote
              const approved = vote.vote === 'approve'
              return (
                <div
                  key={result.id}
                  className={`p-4 rounded-lg border ${
                    approved ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{result.persona_name}</h3>
                      <p className="text-sm text-muted-foreground italic">
                        &ldquo;{vote.catchphrase}&rdquo;
                      </p>
                    </div>
                    <Badge variant={approved ? 'default' : 'destructive'} className={approved ? 'bg-green-600' : ''}>
                      {approved ? 'Approve' : 'Reject'} ({vote.confidence}%)
                    </Badge>
                  </div>
                  <p className="text-sm mb-3">{vote.reasoning}</p>
                  <div className="flex flex-wrap gap-2">
                    {vote.keyFactors.map((factor, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {factor}
                      </Badge>
                    ))}
                  </div>
                </div>
              )
            })}
            {(!memberResults || memberResults.length === 0) && (
              <p className="text-muted-foreground text-center py-8">No votes recorded</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button variant="outline" asChild>
          <Link href="/history">View All Decisions</Link>
        </Button>
        <Button asChild>
          <Link href="/decide">New Decision</Link>
        </Button>
      </div>
    </div>
  )
}
