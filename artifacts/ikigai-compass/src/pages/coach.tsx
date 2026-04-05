import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListCoachingSessions,
  useCreateCoachingSession,
  getListCoachingSessionsQueryKey,
  CreateCoachingSessionBodyType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const SESSION_TYPES: { value: CreateCoachingSessionBodyType; label: string; description: string }[] = [
  { value: CreateCoachingSessionBodyType.general, label: "General coaching", description: "Explore whatever is on your mind" },
  { value: CreateCoachingSessionBodyType.obstacle, label: "Working through an obstacle", description: "Get help with something that is blocking you" },
  { value: CreateCoachingSessionBodyType.replan, label: "Replanning", description: "Rethink your direction or adjust your plan" },
  { value: CreateCoachingSessionBodyType.reflection, label: "Reflection", description: "Reflect on what you have learned or experienced" },
  { value: CreateCoachingSessionBodyType.celebration, label: "Celebration", description: "Acknowledge a win or milestone" },
];

const TYPE_COLORS: Record<string, string> = {
  general: "bg-blue-100 text-blue-800 border-blue-200",
  obstacle: "bg-orange-100 text-orange-800 border-orange-200",
  replan: "bg-violet-100 text-violet-800 border-violet-200",
  reflection: "bg-teal-100 text-teal-800 border-teal-200",
  celebration: "bg-amber-100 text-amber-800 border-amber-200",
};

export default function Coach() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useListCoachingSessions();
  const createSession = useCreateCoachingSession();

  const [showDialog, setShowDialog] = useState(false);
  const [selectedType, setSelectedType] = useState<CreateCoachingSessionBodyType>(CreateCoachingSessionBodyType.general);
  const [sessionTitle, setSessionTitle] = useState("");

  const handleCreate = () => {
    if (!sessionTitle.trim()) {
      toast({ title: "Title required", description: "Give your session a brief title.", variant: "destructive" });
      return;
    }
    createSession.mutate(
      { data: { type: selectedType, title: sessionTitle } },
      {
        onSuccess: (session) => {
          queryClient.invalidateQueries({ queryKey: getListCoachingSessionsQueryKey() });
          setShowDialog(false);
          setLocation(`/coach/${session.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Could not start session", variant: "destructive" });
        },
      }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">AI Coach</h1>
            <p className="text-muted-foreground">
              A thoughtful guide to help you reflect, navigate obstacles, and move toward what matters.
            </p>
          </div>
          <Button onClick={() => setShowDialog(true)} data-testid="button-new-session">
            <Plus className="mr-2 h-4 w-4" />
            New session
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-6">
            <MessageSquare className="h-16 w-16 text-muted-foreground/40" />
            <div>
              <h2 className="text-xl font-serif font-semibold text-foreground mb-2">
                Ready when you are
              </h2>
              <p className="text-muted-foreground">
                Start a coaching session whenever you need guidance, reflection, or support.
              </p>
            </div>
            <Button onClick={() => setShowDialog(true)} data-testid="button-start-first-session">
              Start your first session
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setLocation(`/coach/${session.id}`)}
                data-testid={`card-session-${session.id}`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn("text-xs border", TYPE_COLORS[session.type])} variant="outline">
                          {SESSION_TYPES.find((t) => t.value === session.type)?.label ?? session.type}
                        </Badge>
                        {session.status === "active" && (
                          <Badge variant="outline" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <p className="font-medium text-foreground truncate">{session.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(session.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent data-testid="dialog-new-session">
            <DialogHeader>
              <DialogTitle>Start a coaching session</DialogTitle>
              <DialogDescription>Choose what kind of session would be most helpful right now.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid gap-2">
                {SESSION_TYPES.map((type) => (
                  <button
                    key={type.value}
                    className={cn(
                      "text-left p-3 rounded-lg border transition-colors",
                      selectedType === type.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    )}
                    onClick={() => setSelectedType(type.value)}
                    data-testid={`option-session-type-${type.value}`}
                  >
                    <p className="font-medium text-sm">{type.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-title">Session title</Label>
                <Input
                  id="session-title"
                  placeholder="What do you want to explore?"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  data-testid="input-session-title"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createSession.isPending}
                data-testid="button-create-session"
              >
                {createSession.isPending ? "Starting..." : "Start session"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
