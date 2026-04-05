import { useLocation } from "wouter";
import {
  useListHypotheses,
  useAcceptHypothesis,
  useDeleteHypothesis,
  getListHypothesesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { IkigaiDiagram } from "@/components/ikigai-diagram";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Trash2, ArrowRight, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

const UNCERTAINTY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-red-100 text-red-800 border-red-200",
};

export default function Hypotheses() {
  const [, setLocation] = useLocation();
  const { data: hypotheses, isLoading } = useListHypotheses();
  const acceptHypothesis = useAcceptHypothesis();
  const deleteHypothesis = useDeleteHypothesis();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAccept = (id: number, title: string) => {
    acceptHypothesis.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Hypothesis accepted", description: `"${title}" is now your active Ikigai direction.` });
          queryClient.invalidateQueries({ queryKey: getListHypothesesQueryKey() });
        },
        onError: () => {
          toast({ title: "Error", description: "Could not accept hypothesis", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this hypothesis?")) return;
    deleteHypothesis.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Hypothesis deleted" });
          queryClient.invalidateQueries({ queryKey: getListHypothesesQueryKey() });
        },
      }
    );
  };

  const activeHypothesis = hypotheses?.find((h) => h.status === "accepted");
  const draftHypotheses = hypotheses?.filter((h) => h.status === "draft") ?? [];
  const archivedHypotheses = hypotheses?.filter((h) => h.status === "archived") ?? [];

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!hypotheses || hypotheses.length === 0) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <Compass className="h-16 w-16 text-muted-foreground/40" />
          <div>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-2">
              Your compass awaits
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Complete your Discovery flow and we will synthesize thoughtful Ikigai hypotheses based on your reflections.
            </p>
          </div>
          <Button onClick={() => setLocation("/discover")} data-testid="button-start-discovery">
            Start Discovery
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">Ikigai Hypotheses</h1>
          <p className="text-muted-foreground">
            These are synthesized interpretations of your self-discovery. Explore each one. Accept the one that resonates most.
          </p>
        </div>

        {activeHypothesis && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Your Active Direction</h2>
            <div className="grid md:grid-cols-2 gap-6 items-start">
              <Card className="border-primary/30 bg-primary/5" data-testid={`card-hypothesis-${activeHypothesis.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl font-serif leading-snug">{activeHypothesis.title}</CardTitle>
                    <Badge className="bg-primary text-primary-foreground shrink-0">Active</Badge>
                  </div>
                  <CardDescription className="text-base leading-relaxed pt-1">{activeHypothesis.summary}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button variant="outline" size="sm" onClick={() => setLocation(`/hypotheses/${activeHypothesis.id}`)}>
                    View full details
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </CardFooter>
              </Card>
              <div className="flex items-center justify-center p-4">
                <IkigaiDiagram hypothesis={activeHypothesis.title} size={240} />
              </div>
            </div>
          </div>
        )}

        {draftHypotheses.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              {activeHypothesis ? "Other Hypotheses" : "Your Hypotheses"}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {draftHypotheses.map((hyp) => (
                <Card key={hyp.id} className="flex flex-col" data-testid={`card-hypothesis-${hyp.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg font-serif leading-snug">{hyp.title}</CardTitle>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium shrink-0", UNCERTAINTY_COLORS[hyp.uncertaintyLevel ?? "medium"])}>
                        {hyp.uncertaintyLevel} confidence
                      </span>
                    </div>
                    <CardDescription className="leading-relaxed">{hyp.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    {hyp.themes && (hyp.themes as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(hyp.themes as string[]).map((theme) => (
                          <Badge key={theme} variant="secondary" className="text-xs">{theme}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex gap-2 pt-0">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAccept(hyp.id, hyp.title)}
                      disabled={acceptHypothesis.isPending}
                      data-testid={`button-accept-hypothesis-${hyp.id}`}
                    >
                      <CheckCircle className="mr-2 h-3 w-3" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation(`/hypotheses/${hyp.id}`)}
                      data-testid={`button-view-hypothesis-${hyp.id}`}
                    >
                      Details
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(hyp.id)}
                      data-testid={`button-delete-hypothesis-${hyp.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}

        {archivedHypotheses.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Archived</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {archivedHypotheses.map((hyp) => (
                <Card key={hyp.id} className="opacity-60" data-testid={`card-hypothesis-archived-${hyp.id}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-serif">{hyp.title}</CardTitle>
                    <CardDescription className="text-sm">{hyp.summary}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
