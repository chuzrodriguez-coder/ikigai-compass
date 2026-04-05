import { useParams, useLocation } from "wouter";
import {
  useGetHypothesis,
  useAcceptHypothesis,
  useUpdateHypothesis,
  getGetHypothesisQueryKey,
  getListHypothesesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, ArrowLeft, Lightbulb, Shield, GitBranch } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const UNCERTAINTY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-red-100 text-red-800 border-red-200",
};

export default function HypothesisDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: hyp, isLoading } = useGetHypothesis(id, {
    query: { enabled: !!id, queryKey: getGetHypothesisQueryKey(id) },
  });
  const acceptHypothesis = useAcceptHypothesis();
  const updateHypothesis = useUpdateHypothesis();

  const [resonanceScore, setResonanceScore] = useState<number | null>(null);

  const handleAccept = () => {
    if (!hyp) return;
    acceptHypothesis.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Hypothesis accepted", description: "This is now your active Ikigai direction." });
          queryClient.invalidateQueries({ queryKey: getListHypothesesQueryKey() });
        },
      }
    );
  };

  const handleResonanceChange = (value: number[]) => {
    const score = value[0];
    setResonanceScore(score);
    updateHypothesis.mutate(
      { id, data: { resonanceScore: score } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetHypothesisQueryKey(id) });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  if (!hyp) {
    return (
      <MainLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Hypothesis not found.</p>
          <Button variant="link" onClick={() => setLocation("/hypotheses")}>Back to hypotheses</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/hypotheses")} className="mb-4" data-testid="button-back-hypotheses">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All hypotheses
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-serif font-semibold text-foreground leading-tight" data-testid="hypothesis-title">
                {hyp.title}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">{hyp.summary}</p>
            </div>
            {hyp.status === "accepted" ? (
              <Badge className="bg-primary text-primary-foreground shrink-0">Active</Badge>
            ) : (
              <span className={cn("text-xs px-2 py-1 rounded-full border font-medium shrink-0", UNCERTAINTY_COLORS[hyp.uncertaintyLevel ?? "medium"])}>
                {hyp.uncertaintyLevel} confidence
              </span>
            )}
          </div>
        </div>

        {hyp.themes && (hyp.themes as string[]).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(hyp.themes as string[]).map((theme) => (
              <Badge key={theme} variant="secondary">{theme}</Badge>
            ))}
          </div>
        )}

        {hyp.detailedExplanation && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">What this means for you</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed" data-testid="hypothesis-explanation">
                {hyp.detailedExplanation}
              </p>
            </CardContent>
          </Card>
        )}

        {hyp.supportingEvidence && (hyp.supportingEvidence as string[]).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Supporting evidence from your reflections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {(hyp.supportingEvidence as string[]).map((evidence, i) => (
                  <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 font-medium">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{evidence}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {hyp.suggestedExperiments && (hyp.suggestedExperiments as string[]).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                Suggested experiments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Small actions to test whether this direction feels right.</p>
              <ul className="space-y-3">
                {(hyp.suggestedExperiments as string[]).map((exp, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground">
                    <span className="mt-0.5 h-5 w-5 rounded-full bg-amber-100 text-amber-800 text-xs flex items-center justify-center shrink-0 font-medium">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{exp}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {hyp.alternativeInterpretations && (hyp.alternativeInterpretations as string[]).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                Alternative interpretations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(hyp.alternativeInterpretations as string[]).map((alt, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed pl-4 border-l-2 border-muted">
                    {alt}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">How much does this resonate?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Not at all</span>
                <span className="font-medium text-foreground">
                  {resonanceScore ?? hyp.resonanceScore ?? 5}/10
                </span>
                <span>Deeply resonates</span>
              </div>
              <Slider
                defaultValue={[hyp.resonanceScore ?? 5]}
                min={0}
                max={10}
                step={1}
                onValueCommit={handleResonanceChange}
                className="w-full"
                data-testid="slider-resonance"
              />
            </div>
          </CardContent>
        </Card>

        {hyp.status !== "accepted" && (
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={handleAccept}
              disabled={acceptHypothesis.isPending}
              data-testid="button-accept-hypothesis"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Accept as my Ikigai direction
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
