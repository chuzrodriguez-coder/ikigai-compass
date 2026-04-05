import { useLocation } from "wouter";
import {
  useGetDashboardSummary,
  useGetGrowthPlan,
  useUpdateTaskAction,
  useUpdateMilestone,
  getGetDashboardSummaryQueryKey,
  getGetGrowthPlanQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type PlanMilestone = {
  id: number;
  planId: number;
  title: string;
  description?: string;
  targetDate?: string | null;
  completedAt?: string | null;
  status: "pending" | "in_progress" | "completed" | "skipped";
  horizon: "monthly" | "quarterly" | "annual";
  createdAt: string;
  updatedAt: string;
};

type PlanAction = {
  id: number;
  planId: number;
  milestoneId?: number | null;
  title: string;
  description?: string | null;
  weekOf?: string | null;
  status: "pending" | "completed" | "skipped";
  completedAt?: string | null;
  createdAt: string;
};

type PlanHabit = {
  id: number;
  planId: number;
  title: string;
  description?: string | null;
  frequency: "daily" | "weekdays" | "weekly";
  isActive: boolean;
  createdAt: string;
};
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Plus, Target, Calendar, CheckCircle2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const HORIZON_COLORS: Record<string, string> = {
  monthly: "bg-blue-100 text-blue-800 border-blue-200",
  quarterly: "bg-violet-100 text-violet-800 border-violet-200",
  annual: "bg-amber-100 text-amber-800 border-amber-200",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-primary",
  completed: "text-green-600",
  skipped: "text-muted-foreground line-through",
};

export default function Plan() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const activePlanId = summary?.activePlan?.id;

  const { data: plan, isLoading: loadingPlan } = useGetGrowthPlan(activePlanId!, {
    query: {
      enabled: !!activePlanId,
      queryKey: getGetGrowthPlanQueryKey(activePlanId!),
    },
  });

  const updateAction = useUpdateTaskAction();
  const updateMilestone = useUpdateMilestone();

  const handleCompleteAction = (id: number) => {
    updateAction.mutate(
      { id, data: { status: "completed" } },
      {
        onSuccess: () => {
          toast({ title: "Action completed", description: "Keep up the momentum." });
          queryClient.invalidateQueries({ queryKey: getGetGrowthPlanQueryKey(activePlanId!) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
      }
    );
  };

  const handleCompleteMilestone = (id: number, title: string) => {
    updateMilestone.mutate(
      { id, data: { status: "completed" } },
      {
        onSuccess: () => {
          toast({ title: "Milestone achieved!", description: title });
          queryClient.invalidateQueries({ queryKey: getGetGrowthPlanQueryKey(activePlanId!) });
        },
      }
    );
  };

  if (loadingSummary) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  if (!summary?.hasPlan || !activePlanId) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <Target className="h-16 w-16 text-muted-foreground/40" />
          <div>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-2">
              Create your 90-day Growth Plan
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {!summary?.hasHypothesis
                ? "First, complete your Discovery and accept an Ikigai hypothesis. Then you can build your growth plan."
                : "Turn your Ikigai direction into concrete milestones, weekly actions, and daily habits."}
            </p>
          </div>
          {summary?.hasHypothesis ? (
            <Button onClick={() => setLocation("/plan/new")} data-testid="button-create-plan">
              <Plus className="mr-2 h-4 w-4" />
              Create Growth Plan
            </Button>
          ) : (
            <Button onClick={() => setLocation("/hypotheses")} data-testid="button-to-hypotheses">
              Go to Hypotheses
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </MainLayout>
    );
  }

  const milestones = (plan?.milestones ?? []) as unknown as PlanMilestone[];
  const actions = (plan?.actions ?? []) as unknown as PlanAction[];
  const habits = (plan?.habits ?? []) as unknown as PlanHabit[];

  const pendingActions = actions.filter((a) => a.status === "pending");
  const completedActions = actions.filter((a) => a.status === "completed");

  return (
    <MainLayout>
      <div className="space-y-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-foreground mb-1" data-testid="plan-title">
              {plan?.title ?? "Growth Plan"}
            </h1>
            <p className="text-muted-foreground leading-relaxed max-w-2xl">
              {plan?.longTermDirection}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocation("/plan/new")} data-testid="button-edit-plan">
            Edit plan
          </Button>
        </div>

        {plan?.ninetyDaySummary && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-primary mb-1">90-Day Focus</p>
              <p className="text-foreground leading-relaxed">{plan.ninetyDaySummary}</p>
            </CardContent>
          </Card>
        )}

        {milestones.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Milestones
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {milestones.map((m) => (
                <Card key={m.id} className={cn("relative", m.status === "completed" && "opacity-60")} data-testid={`card-milestone-${m.id}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge className={cn("text-xs", HORIZON_COLORS[m.horizon] ?? "")} variant="outline">
                        {m.horizon}
                      </Badge>
                      {m.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2 text-muted-foreground"
                          onClick={() => handleCompleteMilestone(m.id, m.title)}
                          data-testid={`button-complete-milestone-${m.id}`}
                        >
                          Mark done
                        </Button>
                      )}
                    </div>
                    <p className={cn("text-sm font-medium", STATUS_COLORS[m.status])}>{m.title}</p>
                    {m.targetDate && (
                      <p className="text-xs text-muted-foreground mt-1">Target: {String(m.targetDate).split("T")[0]}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {pendingActions.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Weekly Actions
              <span className="text-xs text-muted-foreground font-normal ml-1">
                ({completedActions.length}/{actions.length} completed)
              </span>
            </h2>
            <Card>
              <CardContent className="pt-4 divide-y divide-border">
                {pendingActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-start gap-3 py-3"
                    data-testid={`action-item-${action.id}`}
                  >
                    <Checkbox
                      id={`action-${action.id}`}
                      checked={action.status === "completed"}
                      onCheckedChange={() => handleCompleteAction(action.id)}
                      data-testid={`checkbox-action-${action.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <label htmlFor={`action-${action.id}`} className="text-sm font-medium cursor-pointer">
                        {action.title}
                      </label>
                      {action.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                      )}
                      {action.weekOf && (
                        <p className="text-xs text-muted-foreground mt-0.5">Week of {String(action.weekOf).split("T")[0]}</p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {habits.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4">Daily Habits</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {habits.map((habit) => (
                <div
                  key={habit.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    habit.isActive ? "bg-card" : "opacity-50"
                  )}
                  data-testid={`habit-item-${habit.id}`}
                >
                  <div className={cn("h-2 w-2 rounded-full", habit.isActive ? "bg-primary" : "bg-muted")} />
                  <div>
                    <p className="text-sm font-medium">{habit.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{habit.frequency}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
