import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getBuiltInPersonas } from '@/lib/personas';

const emojiMap: Record<string, string> = {
  'chad-alpha': '😎',
  'frugal-frank': '💰',
  'warren-boomer': '📈',
  'crypto-kyle': '🪙',
  'dividend-dave': '💵',
  'index-irene': '📊',
  'yolo-yolanda': '🎉',
  'debt-free-derek': '🔓',
  'minimalist-maya': '✨',
  'side-hustle-sam': '💼',
  'insurance-irma': '🛡️',
  'sustainable-sophie': '🌱',
  'data-driven-dan': '📉',
  'health-first-hannah': '💪',
  'generational-gary': '👴',
  'treat-yourself-tara': '🎁',
  'comparison-carl': '🔍',
};

const riskColors: Record<string, string> = {
  conservative: 'bg-blue-100 text-blue-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  aggressive: 'bg-orange-100 text-orange-800',
  yolo: 'bg-red-100 text-red-800',
};

export default function BoardPage() {
  const personas = getBuiltInPersonas();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your Board of Advisors</h1>
        <p className="text-muted-foreground">
          17 unique financial perspectives to deliberate on your purchases
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {personas.map((persona) => (
          <Card key={persona.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{emojiMap[persona.id] || '👤'}</span>
                  <div>
                    <CardTitle className="text-lg">{persona.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {persona.title}
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={riskColors[persona.traits.riskTolerance]}
                >
                  {persona.traits.riskTolerance}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {persona.archetype}
                </p>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {persona.backstory}
              </p>
              <div className="pt-2 border-t">
                <p className="text-xs italic text-muted-foreground">
                  &ldquo;{persona.traits.catchphrases[0]}&rdquo;
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
