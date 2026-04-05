import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetDashboardSummary,
  useCreateGrowthPlan,
  useCreateMilestone,
  useCreateTaskAction,
  useCreateHabit,
  getGetDashboardSummaryQueryKey,
  getListGrowthPlansQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface MilestoneInput {
  title: string;
  horizon: "monthly" | "quarterly" | "annual";
  targetDate: string;
}

interface ActionInput {
  title: string;
  description: string;
}

interface HabitInput {
  title: string;
  frequency: "daily" | "weekdays" | "weekly";
}

export default function PlanNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary } = useGetDashboardSummary();
  const createPlan = useCreateGrowthPlan();
  const createMilestone = useCreateMilestone();
  const createAction = useCreateTaskAction();
  const createHabit = useCreateHabit();

  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState("");
  const [summary90, setSummary90] = useState("");
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { title: "", horizon: "monthly", targetDate: "" },
    { title: "", horizon: "quarterly", targetDate: "" },
    { title: "", horizon: "annual", targetDate: "" },
  ]);
  const [actions, setActions] = useState<ActionInput[]>([
    { title: "", description: "" },
    { title: "", description: "" },
    { title: "", description: "" },
  ]);
  const [habits, setHabits] = useState<HabitInput[]>([
    { title: "", frequency: "daily" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title || !direction) {
      toast({ title: "Required fields", description: "Please fill in the title and long-term direction.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const plan = await createPlan.mutateAsync({
        data: {
          title,
          longTermDirection: direction,
          ninetyDaySummary: summary90,
          hypothesisId: summary?.activeHypothesis?.id ?? undefined,
        },
      });

      for (const m of milestones.filter((m) => m.title)) {
        await createMilestone.mutateAsync({
          data: {
            planId: plan.id,
            title: m.title,
            horizon: m.horizon,
            targetDate: m.targetDate || undefined,
          },
        });
      }

      for (const a of actions.filter((a) => a.title)) {
        await createAction.mutateAsync({
          data: {
            planId: plan.id,
            title: a.title,
            description: a.description || undefined,
          },
        });
      }

      for (const h of habits.filter((h) => h.title)) {
        await createHabit.mutateAsync({
          data: {
            planId: plan.id,
            title: h.title,
            frequency: h.frequency,
          },
        });
      }

      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListGrowthPlansQueryKey() });
      toast({ title: "Growth plan created!", description: "Your 90-day journey begins now." });
      setLocation("/plan");
    } catch {
      toast({ title: "Error", description: "Could not create plan. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/plan")} className="mb-4" data-testid="button-back-plan">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to plan
          </Button>
          <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">Create Growth Plan</h1>
          <p className="text-muted-foreground">
            Turn your Ikigai direction into a concrete 90-day plan with milestones, weekly actions, and daily habits.
          </p>
        </div>

        {summary?.activeHypothesis && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-primary font-medium mb-1">Based on your Ikigai direction</p>
              <p className="text-sm font-medium">{summary.activeHypothesis.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.activeHypothesis.summary}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan-title">Plan title</Label>
              <Input
                id="plan-title"
                placeholder="e.g. Building my coaching practice"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-plan-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-direction">Long-term direction</Label>
              <Textarea
                id="plan-direction"
                placeholder="Where are you headed? What does success look like in 1-3 years?"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                rows={3}
                data-testid="textarea-plan-direction"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-summary90">90-day focus</Label>
              <Textarea
                id="plan-summary90"
                placeholder="What specifically will you accomplish in the next 90 days?"
                value={summary90}
                onChange={(e) => setSummary90(e.target.value)}
                rows={2}
                data-testid="textarea-plan-summary"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Milestones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {milestones.map((m, i) => (
              <div key={i} className="space-y-2 pb-4 border-b last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {m.horizon === "monthly" ? "30-day" : m.horizon === "quarterly" ? "60-day" : "90-day"}
                  </span>
                </div>
                <Input
                  placeholder={`${m.horizon === "monthly" ? "30" : m.horizon === "quarterly" ? "60" : "90"}-day milestone`}
                  value={m.title}
                  onChange={(e) => {
                    const updated = [...milestones];
                    updated[i] = { ...updated[i], title: e.target.value };
                    setMilestones(updated);
                  }}
                  data-testid={`input-milestone-${i}`}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Weekly actions</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActions([...actions, { title: "", description: "" }])}
                data-testid="button-add-action"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {actions.map((a, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Action title"
                  value={a.title}
                  onChange={(e) => {
                    const updated = [...actions];
                    updated[i] = { ...updated[i], title: e.target.value };
                    setActions(updated);
                  }}
                  data-testid={`input-action-${i}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActions(actions.filter((_, j) => j !== i))}
                  data-testid={`button-remove-action-${i}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Daily habits</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHabits([...habits, { title: "", frequency: "daily" }])}
                data-testid="button-add-habit"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {habits.map((h, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Habit title"
                  value={h.title}
                  onChange={(e) => {
                    const updated = [...habits];
                    updated[i] = { ...updated[i], title: e.target.value };
                    setHabits(updated);
                  }}
                  data-testid={`input-habit-${i}`}
                />
                <select
                  className="text-sm border border-input rounded-md px-2 bg-background"
                  value={h.frequency}
                  onChange={(e) => {
                    const updated = [...habits];
                    updated[i] = { ...updated[i], frequency: e.target.value as "daily" | "weekdays" | "weekly" };
                    setHabits(updated);
                  }}
                  data-testid={`select-habit-frequency-${i}`}
                >
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekly">Weekly</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHabits(habits.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting}
          data-testid="button-submit-plan"
        >
          {submitting ? "Creating plan..." : "Create Growth Plan"}
        </Button>
      </div>
    </MainLayout>
  );
}
