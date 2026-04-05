import { useState } from "react";
import {
  useListObstacles,
  useCreateObstacle,
  useUpdateObstacle,
  getListObstaclesQueryKey,
  CreateObstacleBodyCategory,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckCircle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const CATEGORY_COLORS: Record<string, string> = {
  time: "bg-blue-100 text-blue-800 border-blue-200",
  energy: "bg-orange-100 text-orange-800 border-orange-200",
  skills: "bg-violet-100 text-violet-800 border-violet-200",
  resources: "bg-teal-100 text-teal-800 border-teal-200",
  motivation: "bg-pink-100 text-pink-800 border-pink-200",
  external: "bg-gray-100 text-gray-800 border-gray-200",
  other: "bg-amber-100 text-amber-800 border-amber-200",
};

export default function Obstacles() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: obstacles, isLoading } = useListObstacles();
  const createObstacle = useCreateObstacle();
  const updateObstacle = useUpdateObstacle();

  const [showDialog, setShowDialog] = useState(false);
  const [obstacleTitle, setObstacleTitle] = useState("");
  const [obstacleDescription, setObstacleDescription] = useState("");
  type ObstacleCategory = (typeof CreateObstacleBodyCategory)[keyof typeof CreateObstacleBodyCategory];
  const [obstacleCategory, setObstacleCategory] = useState<ObstacleCategory>(CreateObstacleBodyCategory.other);

  const handleCreate = () => {
    if (!obstacleTitle.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    createObstacle.mutate(
      { data: { title: obstacleTitle, description: obstacleDescription || undefined, category: obstacleCategory } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListObstaclesQueryKey() });
          setShowDialog(false);
          setObstacleTitle("");
          setObstacleDescription("");
          setObstacleCategory("other");
          toast({ title: "Obstacle logged" });
        },
      }
    );
  };

  const handleResolve = (id: number) => {
    updateObstacle.mutate(
      { id, data: { status: "resolved" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListObstaclesQueryKey() });
          toast({ title: "Obstacle resolved", description: "Good work working through it." });
        },
      }
    );
  };

  const active = obstacles?.filter((o) => o.status === "active") ?? [];
  const resolved = obstacles?.filter((o) => o.status !== "active") ?? [];

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">Obstacles</h1>
            <p className="text-muted-foreground">
              Naming what gets in the way is the first step to moving through it.
            </p>
          </div>
          <Button onClick={() => setShowDialog(true)} data-testid="button-log-obstacle">
            <Plus className="mr-2 h-4 w-4" />
            Log obstacle
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <Tabs defaultValue="active">
            <TabsList data-testid="tabs-obstacles">
              <TabsTrigger value="active" data-testid="tab-active">Active ({active.length})</TabsTrigger>
              <TabsTrigger value="resolved" data-testid="tab-resolved">Resolved ({resolved.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4 space-y-3">
              {active.length === 0 ? (
                <div className="text-center py-12">
                  <ShieldAlert className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground">No active obstacles. Keep it up.</p>
                </div>
              ) : (
                active.map((o) => (
                  <Card key={o.id} data-testid={`card-obstacle-${o.id}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={cn("text-xs border", CATEGORY_COLORS[o.category])} variant="outline">
                              {o.category}
                            </Badge>
                          </div>
                          <p className="font-medium text-foreground">{o.title}</p>
                          {o.description && (
                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{o.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(o.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolve(o.id)}
                          data-testid={`button-resolve-obstacle-${o.id}`}
                        >
                          <CheckCircle className="mr-2 h-3 w-3" />
                          Resolve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="resolved" className="mt-4 space-y-3">
              {resolved.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No resolved obstacles yet.</p>
                </div>
              ) : (
                resolved.map((o) => (
                  <Card key={o.id} className="opacity-70" data-testid={`card-obstacle-resolved-${o.id}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn("text-xs border", CATEGORY_COLORS[o.category])} variant="outline">
                          {o.category}
                        </Badge>
                        <Badge variant="outline" className="text-xs text-green-700 border-green-200">resolved</Badge>
                      </div>
                      <p className="font-medium text-foreground">{o.title}</p>
                      {o.description && (
                        <p className="text-sm text-muted-foreground mt-1">{o.description}</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent data-testid="dialog-log-obstacle">
            <DialogHeader>
              <DialogTitle>Log an obstacle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="obstacle-title">What is getting in the way?</Label>
                <Input
                  id="obstacle-title"
                  placeholder="Brief description"
                  value={obstacleTitle}
                  onChange={(e) => setObstacleTitle(e.target.value)}
                  data-testid="input-obstacle-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obstacle-description">More detail (optional)</Label>
                <Textarea
                  id="obstacle-description"
                  placeholder="What makes this difficult? When does it show up?"
                  value={obstacleDescription}
                  onChange={(e) => setObstacleDescription(e.target.value)}
                  rows={3}
                  data-testid="textarea-obstacle-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obstacle-category">Category</Label>
                <Select value={obstacleCategory} onValueChange={(v) => setObstacleCategory(v as ObstacleCategory)}>
                  <SelectTrigger id="obstacle-category" data-testid="select-obstacle-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time">Time</SelectItem>
                    <SelectItem value="energy">Energy</SelectItem>
                    <SelectItem value="skills">Skills</SelectItem>
                    <SelectItem value="resources">Resources</SelectItem>
                    <SelectItem value="motivation">Motivation</SelectItem>
                    <SelectItem value="external">External factors</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createObstacle.isPending} data-testid="button-submit-obstacle">
                {createObstacle.isPending ? "Logging..." : "Log obstacle"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
