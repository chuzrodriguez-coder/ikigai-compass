import React from "react";
import { Link } from "wouter";
import { 
  useGetDashboardSummary, 
  useGetMomentumHistory, 
  useGetRecentActivity,
  useUpdateTaskAction,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IkigaiDiagram } from "@/components/ikigai-diagram";
import { Compass, Target, CheckCircle2, ShieldAlert, ArrowRight, Play, CheckSquare } from "lucide-react";
import { format, parseISO } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: history, isLoading: loadingHistory } = useGetMomentumHistory();
  const { data: activities, isLoading: loadingActivities } = useGetRecentActivity();
  const updateTask = useUpdateTaskAction();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleActionComplete = (id: number) => {
    updateTask.mutate({ id, data: { status: "completed" } }, {
      onSuccess: () => {
        toast({ title: "Action completed", description: "Great job maintaining momentum!" });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      }
    });
  };

  if (loadingSummary) {
    return (
      <MainLayout>
        <div className="space-y-8">
          <div>
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 pb-12">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Welcome back, {summary?.user?.displayName || "Explorer"}</h1>
          <p className="text-muted-foreground mt-2">
            Here's where you stand on your journey today.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-full">
            <Link href="/checkin">
              <CheckSquare className="mr-2 h-4 w-4" /> Start Check-in
            </Link>
          </Button>
          {summary?.hasPlan && (
            <Button asChild variant="secondary" className="rounded-full">
              <Link href="/plan">
                <Target className="mr-2 h-4 w-4" /> View Plan
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/obstacles">
              <ShieldAlert className="mr-2 h-4 w-4" /> Log Obstacle
            </Link>
          </Button>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Momentum Score */}
          <Card className="md:col-span-1 bg-gradient-to-br from-card to-accent/20 border-accent/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Momentum</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative h-32 w-32 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                    <circle 
                      cx="50" cy="50" r="45" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="8" 
                      strokeDasharray={`${(summary?.momentumScore || 0) * 2.83} 283`}
                      className="text-primary transition-all duration-1000 ease-out" 
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-bold font-serif">{summary?.momentumScore || 0}</span>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="font-medium text-foreground">{summary?.momentumLabel || "Getting Started"}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">{summary?.momentumExplanation}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Hypothesis */}
          <Card className="md:col-span-2 overflow-hidden flex flex-col">
            {summary?.hasHypothesis ? (
              <div className="flex flex-col md:flex-row h-full">
                <div className="p-6 flex-1 flex flex-col justify-center">
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-primary border-primary/20 bg-primary/10 w-fit mb-4">
                    Active Hypothesis
                  </div>
                  <h3 className="text-2xl font-serif font-bold mb-2">{summary.activeHypothesis?.title}</h3>
                  <p className="text-muted-foreground line-clamp-2 mb-6">{summary.activeHypothesis?.summary}</p>
                  <Button variant="ghost" className="w-fit p-0 hover:bg-transparent text-primary" asChild>
                    <Link href={`/hypotheses/${summary.activeHypothesis?.id}`}>
                      View details <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="hidden md:flex items-center justify-center p-6 bg-accent/20 w-64 border-l">
                  <IkigaiDiagram className="w-40 h-40 opacity-70" title="Ikigai" />
                </div>
              </div>
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-center h-full bg-accent/10">
                <Compass className="h-12 w-12 text-primary/40 mb-4" />
                <h3 className="text-xl font-serif font-bold mb-2">Find Your Direction</h3>
                <p className="text-muted-foreground max-w-md mb-6">You haven't defined your Ikigai hypothesis yet. Complete the discovery flow to synthesize your insights.</p>
                <Button asChild>
                  <Link href={summary?.discoveryComplete ? "/hypotheses" : "/discover"}>
                    {summary?.discoveryComplete ? "View Hypotheses" : "Start Discovery"}
                  </Link>
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Second Row: Plan Progress & History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Weekly Action Plan</CardTitle>
              <CardDescription>Your focus for this week</CardDescription>
            </CardHeader>
            <CardContent>
              {summary?.hasPlan ? (
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>{summary.completedActionsThisWeek} of {summary.pendingActionsCount + summary.completedActionsThisWeek} actions completed</span>
                      <span className="font-medium text-primary">
                        {summary.pendingActionsCount + summary.completedActionsThisWeek > 0 
                          ? Math.round((summary.completedActionsThisWeek / (summary.pendingActionsCount + summary.completedActionsThisWeek)) * 100) 
                          : 0}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-secondary/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${summary.pendingActionsCount + summary.completedActionsThisWeek > 0 ? (summary.completedActionsThisWeek / (summary.pendingActionsCount + summary.completedActionsThisWeek)) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  
                  {summary.upcomingMilestones?.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">Upcoming Milestones</h4>
                      <div className="space-y-3">
                        {summary.upcomingMilestones.slice(0, 3).map(m => (
                          <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover-elevate">
                            <div className="mt-0.5">
                              {m.status === 'completed' ? (
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{m.title}</p>
                              {m.targetDate && <p className="text-xs text-muted-foreground mt-1">Due {format(parseISO(m.targetDate), 'MMM d, yyyy')}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/plan">View Full Plan</Link>
                  </Button>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Target className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">No active growth plan</p>
                  <Button asChild variant="secondary">
                    <Link href="/plan/new">Create a Plan</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Momentum History</CardTitle>
              <CardDescription>Your energy and satisfaction over time</CardDescription>
            </CardHeader>
            <CardContent>
              {history && history.length > 0 ? (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...history].reverse()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <XAxis dataKey="week" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Line type="monotone" dataKey="momentumScore" name="Momentum" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="energyAvg" name="Energy" stroke="hsl(var(--secondary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-12 text-center flex flex-col items-center justify-center h-[250px] bg-muted/20 rounded-lg border border-dashed">
                  <p className="text-muted-foreground text-sm">Not enough data yet. Complete check-ins to build your history.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
