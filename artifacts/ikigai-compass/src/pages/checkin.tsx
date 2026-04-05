import { useState } from "react";
import { useLocation } from "wouter";
import {
  useCreateCheckIn,
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  getListCheckInsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const ENERGY_LABELS = ["Depleted", "Low", "Neutral", "Good", "Vibrant"];
const SATISFACTION_LABELS = ["Frustrated", "Unsatisfied", "Neutral", "Satisfied", "Fulfilling"];

function MomentumResult({ score, label, explanation }: { score: number; label: string; explanation: string }) {
  const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-amber-600" : "text-red-500";
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-6 pb-6 text-center">
        <TrendingUp className={cn("h-10 w-10 mx-auto mb-3", color)} />
        <p className="text-4xl font-bold text-foreground mb-1">{Math.round(score)}</p>
        <p className={cn("font-semibold mb-2", color)}>{label}</p>
        <p className="text-sm text-muted-foreground">{explanation}</p>
      </CardContent>
    </Card>
  );
}

export default function CheckIn() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary } = useGetDashboardSummary();
  const createCheckIn = useCreateCheckIn();

  const [period, setPeriod] = useState("this-week");
  const [plannedActions, setPlannedActions] = useState("");
  const [actualActions, setActualActions] = useState("");
  const [blockers, setBlockers] = useState("");
  const [energyLevel, setEnergyLevel] = useState(3);
  const [satisfactionLevel, setSatisfactionLevel] = useState(3);
  const [nextSteps, setNextSteps] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; label: string; explanation: string } | null>(null);

  const handleSubmit = async () => {
    createCheckIn.mutate(
      {
        data: {
          planId: summary?.activePlan?.id ?? undefined,
          period,
          plannedActions: plannedActions || undefined,
          actualActions: actualActions || undefined,
          blockers: blockers || undefined,
          energyLevel,
          satisfactionLevel,
          nextSteps: nextSteps || undefined,
        },
      },
      {
        onSuccess: (checkIn) => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListCheckInsQueryKey() });
          const score = checkIn.momentumScore ?? 0;
          const label = getMomentumLabel(score);
          const explanation = getMomentumExplanation(score);
          setResult({ score, label, explanation });
          setSubmitted(true);
          toast({ title: "Check-in submitted!", description: "Your momentum has been updated." });
        },
        onError: () => {
          toast({ title: "Error", description: "Could not submit check-in", variant: "destructive" });
        },
      }
    );
  };

  if (submitted && result) {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">Check-in submitted</h1>
            <p className="text-muted-foreground">Well done for taking time to reflect. Here is your momentum snapshot.</p>
          </div>
          <MomentumResult score={result.score} label={result.label} explanation={result.explanation} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setLocation("/dashboard")} data-testid="button-go-dashboard">
              Back to dashboard
            </Button>
            <Button onClick={() => { setSubmitted(false); setResult(null); }} data-testid="button-new-checkin">
              New check-in
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">Accountability Check-In</h1>
          <p className="text-muted-foreground leading-relaxed">
            Take a moment to honestly reflect on your progress. This builds awareness and momentum.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="period-select">Period</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger id="period-select" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-week">This week</SelectItem>
              <SelectItem value="this-month">This month</SelectItem>
              <SelectItem value="last-week">Last week</SelectItem>
              <SelectItem value="last-month">Last month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="planned-actions">What did you plan to do?</Label>
          <Textarea
            id="planned-actions"
            placeholder="What commitments or intentions did you set for this period?"
            value={plannedActions}
            onChange={(e) => setPlannedActions(e.target.value)}
            rows={3}
            data-testid="textarea-planned-actions"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="actual-actions">What actually happened?</Label>
          <Textarea
            id="actual-actions"
            placeholder="Be honest — what did you actually do? What got done?"
            value={actualActions}
            onChange={(e) => setActualActions(e.target.value)}
            rows={3}
            data-testid="textarea-actual-actions"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="blockers">What got in the way?</Label>
          <Textarea
            id="blockers"
            placeholder="Any obstacles, distractions, or unexpected challenges?"
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            rows={2}
            data-testid="textarea-blockers"
          />
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">How did you feel this period?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Energy level</Label>
                <span className="text-sm font-medium text-primary">{ENERGY_LABELS[energyLevel - 1]}</span>
              </div>
              <Slider
                value={[energyLevel]}
                onValueChange={(v) => setEnergyLevel(v[0])}
                min={1}
                max={5}
                step={1}
                data-testid="slider-energy"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Depleted</span>
                <span>Vibrant</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Satisfaction level</Label>
                <span className="text-sm font-medium text-primary">{SATISFACTION_LABELS[satisfactionLevel - 1]}</span>
              </div>
              <Slider
                value={[satisfactionLevel]}
                onValueChange={(v) => setSatisfactionLevel(v[0])}
                min={1}
                max={5}
                step={1}
                data-testid="slider-satisfaction"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Frustrated</span>
                <span>Fulfilling</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Label htmlFor="next-steps">What are your next steps?</Label>
          <Textarea
            id="next-steps"
            placeholder="What will you focus on or commit to next?"
            value={nextSteps}
            onChange={(e) => setNextSteps(e.target.value)}
            rows={2}
            data-testid="textarea-next-steps"
          />
        </div>

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={createCheckIn.isPending}
          data-testid="button-submit-checkin"
        >
          <CheckSquare className="mr-2 h-4 w-4" />
          {createCheckIn.isPending ? "Submitting..." : "Submit check-in"}
        </Button>
      </div>
    </MainLayout>
  );
}

function getMomentumLabel(score: number): string {
  if (score >= 80) return "Strong Momentum";
  if (score >= 60) return "Good Momentum";
  if (score >= 40) return "Building Momentum";
  if (score >= 20) return "Getting Started";
  return "Ready to Begin";
}

function getMomentumExplanation(score: number): string {
  if (score >= 80) return "You are making excellent progress. Keep going.";
  if (score >= 60) return "You are moving in the right direction. Stay consistent.";
  if (score >= 40) return "Progress is happening. Each step counts.";
  if (score >= 20) return "Your journey is beginning. Small steps lead to big change.";
  return "Complete your first check-in to start tracking momentum.";
}
