import { useState } from "react";
import {
  useListReflections,
  useCreateReflection,
  getListReflectionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

const REFLECTION_PROMPTS = [
  "What did I learn about myself this week?",
  "What am I most grateful for right now?",
  "What am I avoiding, and why?",
  "What energized me recently, and what drained me?",
  "What would I do if I knew I could not fail?",
  "What does my gut tell me about the direction I am headed?",
];

type Reflection = {
  id: number;
  userId: number;
  sessionId?: number;
  prompt?: string;
  content: string;
  aiSummary?: string;
  themes?: string[];
  createdAt: Date | string;
};

function ReflectionCard({ reflection }: { reflection: Reflection }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card data-testid={`card-reflection-${reflection.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">
              {format(new Date(reflection.createdAt), "MMM d, yyyy")}
            </p>
            <p className="font-medium text-sm text-foreground leading-snug">{reflection.prompt}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
            data-testid={`button-expand-reflection-${reflection.id}`}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className={`text-sm text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
          {reflection.content}
        </p>
        {expanded && reflection.aiSummary && (
          <div className="mt-4 p-3 bg-primary/5 rounded-lg">
            <p className="text-xs font-medium text-primary mb-1">AI reflection</p>
            <p className="text-sm text-muted-foreground">{reflection.aiSummary}</p>
          </div>
        )}
        {reflection.themes && (reflection.themes as string[]).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {(reflection.themes as string[]).map((theme: string) => (
              <Badge key={theme} variant="secondary" className="text-xs">{theme}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Reflections() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reflections, isLoading } = useListReflections();
  const createReflection = useCreateReflection();

  const [showDialog, setShowDialog] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");

  const handleCreate = () => {
    if (!prompt.trim() || !content.trim()) {
      toast({ title: "Both fields required", variant: "destructive" });
      return;
    }
    createReflection.mutate(
      { data: { prompt, content } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListReflectionsQueryKey() });
          setShowDialog(false);
          setPrompt("");
          setContent("");
          toast({ title: "Reflection saved" });
        },
      }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">Reflections</h1>
            <p className="text-muted-foreground">
              A private space to think through what you are experiencing and learning.
            </p>
          </div>
          <Button onClick={() => setShowDialog(true)} data-testid="button-add-reflection">
            <Plus className="mr-2 h-4 w-4" />
            Add reflection
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : !reflections || reflections.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-6">
            <BookOpen className="h-16 w-16 text-muted-foreground/40" />
            <div>
              <h2 className="text-xl font-serif font-semibold text-foreground mb-2">
                Begin your reflection practice
              </h2>
              <p className="text-muted-foreground">
                Regular reflection deepens self-awareness and accelerates growth.
              </p>
            </div>
            <Button onClick={() => setShowDialog(true)} data-testid="button-first-reflection">
              Write your first reflection
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {reflections.map((r) => (
              <ReflectionCard key={r.id} reflection={r} />
            ))}
          </div>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent data-testid="dialog-add-reflection">
            <DialogHeader>
              <DialogTitle>Add a reflection</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Prompt</Label>
                <Input
                  placeholder="What do you want to reflect on?"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  data-testid="input-reflection-prompt"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {REFLECTION_PROMPTS.map((p) => (
                    <button
                      key={p}
                      className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={() => setPrompt(p)}
                      data-testid={`prompt-suggestion-${p.slice(0, 15)}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Your reflection</Label>
                <Textarea
                  placeholder="Write freely. There are no wrong answers."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  data-testid="textarea-reflection-content"
                />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createReflection.isPending} data-testid="button-submit-reflection">
                {createReflection.isPending ? "Saving..." : "Save reflection"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
