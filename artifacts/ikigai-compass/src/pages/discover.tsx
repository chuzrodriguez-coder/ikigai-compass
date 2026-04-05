import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  useListDiscoverySessions,
  useCreateDiscoverySession,
  useUpdateDiscoverySession,
  useCompleteDiscoverySession,
  useSynthesizeHypotheses,
  getListHypothesesQueryKey,
  getListDiscoverySessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Compass, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type StepType = "textarea" | "slider" | "card-select" | "ranking";

type StepDef = {
  key: string;
  title: string;
  description: string;
  type: StepType;
  placeholder?: string;
  options?: string[];
  sliderLabel?: string;
  sliderMin?: number;
  sliderMax?: number;
  sliderMinLabel?: string;
  sliderMaxLabel?: string;
  maxSelections?: number;
};

const STEPS: StepDef[] = [
  {
    key: "step1",
    title: "Interests & Passions",
    description: "Select topics that genuinely excite you or light you up. Choose all that resonate.",
    type: "card-select",
    maxSelections: 8,
    options: [
      "Technology & Software", "Teaching & Education", "Arts & Creativity",
      "Health & Wellness", "Business & Entrepreneurship", "Science & Research",
      "Social Impact & Community", "Writing & Communication", "Design & Aesthetics",
      "Music & Performance", "Nature & Environment", "Sports & Movement",
      "Philosophy & Spirituality", "Finance & Investing", "Leadership & Strategy",
      "Cooking & Food", "Travel & Culture", "Psychology & Relationships",
    ],
  },
  {
    key: "step2",
    title: "Strengths & Skills",
    description: "What are you naturally good at? What skills have you developed through practice and dedication?",
    type: "textarea",
    placeholder: "People often come to me for help with...\n\nI have developed real depth in...\n\nSkills I am proud of:",
  },
  {
    key: "step3",
    title: "Values & Priorities",
    description: "Rank these values from most to least important to you. Drag items or use the arrows to reorder.",
    type: "ranking",
    options: [
      "Autonomy & Independence", "Financial Security", "Social Impact", "Creative Expression",
      "Deep Mastery", "Connection & Belonging", "Recognition & Status", "Stability & Predictability",
      "Adventure & Novelty", "Service to Others", "Intellectual Challenge", "Leadership & Influence",
    ],
  },
  {
    key: "step4_energy",
    title: "Energy & Engagement",
    description: "Rate how energized you feel when doing different types of work.",
    type: "slider",
    sliderLabel: "Working with People vs. Working Alone",
    sliderMin: 1,
    sliderMax: 10,
    sliderMinLabel: "Prefer solo, deep work",
    sliderMaxLabel: "Energized by collaboration",
  },
  {
    key: "step4_text",
    title: "Energizers & Drainers",
    description: "Describe specific activities that give you energy versus activities that deplete you.",
    type: "textarea",
    placeholder: "What gives me energy:\n\nWhat drains me:\n\nThe work that makes time fly:",
  },
  {
    key: "step5",
    title: "Admired Roles",
    description: "Who do you admire? What role models or people inspire you, and what specifically do you admire about them?",
    type: "textarea",
    placeholder: "I admire people who...\n\nThe people I look up to most are doing...\n\nWhen I see them, I feel:",
  },
  {
    key: "step6",
    title: "Desired Contribution",
    description: "Select the problem areas you most want to contribute to solving.",
    type: "card-select",
    maxSelections: 4,
    options: [
      "Education & Learning", "Mental Health & Wellbeing", "Economic Opportunity",
      "Environmental Sustainability", "Healthcare Access", "Community & Belonging",
      "Creative & Cultural Expression", "Technology & Innovation", "Leadership Development",
      "Youth & Next Generation", "Equity & Social Justice", "Business & Economic Growth",
    ],
  },
  {
    key: "step7",
    title: "Life Context",
    description: "Rate your current flexibility in different areas.",
    type: "slider",
    sliderLabel: "Hours available per week for purposeful work",
    sliderMin: 1,
    sliderMax: 40,
    sliderMinLabel: "1-5 hours/week",
    sliderMaxLabel: "30-40+ hours/week",
  },
  {
    key: "step7_text",
    title: "Life Constraints",
    description: "What are the practical realities of your life right now? Location, family, financial needs.",
    type: "textarea",
    placeholder: "Location considerations:\n\nFamily or care obligations:\n\nFinancial needs and timeline:\n\nOther important constraints:",
  },
  {
    key: "step8",
    title: "Fears & Blockers",
    description: "What holds you back? What are you afraid of? What stories might be limiting you?",
    type: "textarea",
    placeholder: "What I am afraid of...\n\nThe story I tell myself that might not be true...\n\nWhat I have been avoiding:",
  },
  {
    key: "step9",
    title: "Past Highlights",
    description: "When have you felt most alive, engaged, and in flow?",
    type: "textarea",
    placeholder: "Times I have felt most alive and engaged...\n\nExperiences that felt deeply meaningful...\n\nWork that felt effortless:",
  },
  {
    key: "step10",
    title: "Ideal Lifestyle",
    description: "Describe your ideal day and work environment.",
    type: "textarea",
    placeholder: "My ideal day begins with...\n\nI want my work environment to feel like...\n\nThe relationships I want to prioritize...\n\nThe rhythm and pace I want:",
  },
];

type StepAnswer = string | number | string[];

function CardSelectInput({
  options,
  value,
  onChange,
  maxSelections = 8,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  maxSelections?: number;
}) {
  const toggle = useCallback(
    (option: string) => {
      if (value.includes(option)) {
        onChange(value.filter((v) => v !== option));
      } else if (value.length < maxSelections) {
        onChange([...value, option]);
      }
    },
    [value, onChange, maxSelections]
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Select up to {maxSelections} ({value.length} selected)
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors cursor-pointer",
                selected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted"
              )}
              data-testid={`card-option-${option}`}
            >
              {selected && <Check className="inline mr-1 h-3 w-3" />}
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SliderInput({
  step,
  value,
  onChange,
}: {
  step: StepDef;
  value: number;
  onChange: (v: number) => void;
}) {
  const min = step.sliderMin ?? 1;
  const max = step.sliderMax ?? 10;
  const displayValue = value ?? Math.round((min + max) / 2);

  return (
    <div className="space-y-6 py-2">
      <div className="text-center">
        <span className="text-4xl font-semibold text-primary">{displayValue}</span>
        <span className="text-muted-foreground text-sm ml-1">/ {max}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[displayValue]}
        onValueChange={([v]) => onChange(v)}
        className="py-2"
        data-testid="slider-input"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{step.sliderMinLabel}</span>
        <span>{step.sliderMaxLabel}</span>
      </div>
    </div>
  );
}

function RankingInput({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const ranked = value.length > 0 ? value : [...options];
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    dragOverIndex.current = index;
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === index) return;
    const next = [...ranked];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    dragIndex.current = null;
    dragOverIndex.current = null;
    onChange(next);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...ranked];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index === ranked.length - 1) return;
    const next = [...ranked];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-2" data-testid="ranking-input">
      <p className="text-xs text-muted-foreground">
        Drag to reorder, or use the arrows. Top = most important.
      </p>
      {ranked.map((item, index) => (
        <div
          key={item}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3 cursor-grab active:cursor-grabbing",
            "bg-card hover:bg-muted transition-colors select-none"
          )}
          data-testid={`rank-item-${index}`}
        >
          <span className="text-sm font-bold text-muted-foreground w-6 text-center">
            {index + 1}
          </span>
          <span className="flex-1 text-sm font-medium">{item}</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => moveUp(index)}
              disabled={index === 0}
              className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity"
              aria-label={`Move ${item} up`}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveDown(index)}
              disabled={index === ranked.length - 1}
              className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity"
              aria-label={`Move ${item} down`}
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function getDefaultAnswer(step: StepDef): StepAnswer {
  if (step.type === "slider") return Math.round(((step.sliderMin ?? 1) + (step.sliderMax ?? 10)) / 2);
  if (step.type === "card-select") return [];
  if (step.type === "ranking") return step.options ? [...step.options] : [];
  return "";
}

function serializeAnswer(step: StepDef, value: StepAnswer): string {
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export default function Discover() {
  const [, setLocation] = useLocation();
  const { data: sessions, isLoading } = useListDiscoverySessions();
  const createSession = useCreateDiscoverySession();
  const updateSession = useUpdateDiscoverySession();
  const completeSession = useCompleteDiscoverySession();
  const synthesize = useSynthesizeHypotheses();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, StepAnswer>>({});
  const [synthesizing, setSynthesizing] = useState(false);
  const [started, setStarted] = useState(false);

  const inProgressSession = sessions?.find((s) => s.status === "in_progress");
  const completedSessions = sessions?.filter((s) => s.status === "completed") ?? [];

  const handleStart = () => {
    if (inProgressSession) {
      setSessionId(inProgressSession.id);
      setCurrentStep(inProgressSession.currentStep ?? 1);
      setStarted(true);
    } else {
      createSession.mutate(
        { data: { mode: "deep" } },
        {
          onSuccess: (session) => {
            setSessionId(session.id);
            setCurrentStep(1);
            setStarted(true);
          },
          onError: () => {
            toast({ title: "Error", description: "Could not start session", variant: "destructive" });
          },
        }
      );
    }
  };

  const handleNext = async () => {
    if (!sessionId) return;

    const serializedAnswers: Record<string, string> = {};
    for (const [key, val] of Object.entries(answers)) {
      const stepDef = STEPS.find((s) => s.key === key);
      if (stepDef) {
        serializedAnswers[key] = serializeAnswer(stepDef, val);
      } else {
        serializedAnswers[key] = String(val);
      }
    }

    await updateSession.mutateAsync({
      id: sessionId,
      data: {
        currentStep: Math.min(currentStep + 1, STEPS.length),
        answers: serializedAnswers,
      },
    });

    if (currentStep < STEPS.length) {
      setCurrentStep((s) => s + 1);
    } else {
      await handleComplete();
    }
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  const handleComplete = async () => {
    if (!sessionId) return;
    setSynthesizing(true);
    try {
      await completeSession.mutateAsync({ id: sessionId });
      toast({ title: "Discovery complete!", description: "Synthesizing your Ikigai hypotheses..." });
      await synthesize.mutateAsync({ data: { sessionId } });
      queryClient.invalidateQueries({ queryKey: getListHypothesesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListDiscoverySessionsQueryKey() });
      setLocation("/hypotheses");
    } catch {
      toast({ title: "Error", description: "Could not synthesize hypotheses. Please try again.", variant: "destructive" });
    } finally {
      setSynthesizing(false);
    }
  };

  const currentStepData = STEPS[currentStep - 1];
  const stepKey = currentStepData?.key ?? "";
  const progressPercent = ((currentStep - 1) / STEPS.length) * 100;

  const currentAnswer = answers[stepKey] ?? getDefaultAnswer(currentStepData);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  if (synthesizing) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <Compass className="h-16 w-16 text-primary animate-spin" />
          <div className="text-center">
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-2">
              Synthesizing your Ikigai
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We are reading through your reflections and finding the patterns that point toward your meaningful direction. This may take a moment.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!started) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">Discovery Flow</h1>
            <p className="text-muted-foreground leading-relaxed">
              A guided exploration of who you are, what matters to you, and where you might find your deepest contribution.
            </p>
          </div>

          {completedSessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Previous Sessions</CardTitle>
                <CardDescription>
                  You have completed {completedSessions.length} discovery session{completedSessions.length > 1 ? "s" : ""}. You can view your hypotheses or start fresh.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => setLocation("/hypotheses")} data-testid="button-view-hypotheses">
                  View my Ikigai hypotheses
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-2 border-primary/20">
            <CardContent className="pt-8 pb-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-xl font-serif font-semibold text-foreground">
                    {inProgressSession ? "Resume your discovery" : "Begin your discovery"}
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    A {STEPS.length}-step reflective experience using reflection, selection, and rating prompts. There are no right or wrong answers. Your responses will be used to generate personalized Ikigai hypotheses.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="font-medium text-foreground">{STEPS.length} steps</div>
                    <div className="text-muted-foreground text-xs">15–30 min</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="font-medium text-foreground">Mixed formats</div>
                    <div className="text-muted-foreground text-xs">Cards, sliders, text</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="font-medium text-foreground">AI synthesis</div>
                    <div className="text-muted-foreground text-xs">3 hypotheses</div>
                  </div>
                </div>
                {inProgressSession && (
                  <p className="text-sm text-primary font-medium">
                    You have a session in progress (step {inProgressSession.currentStep} of {inProgressSession.totalSteps}).
                  </p>
                )}
                <Button
                  className="w-full"
                  onClick={handleStart}
                  disabled={createSession.isPending}
                  data-testid="button-start-discovery"
                >
                  {inProgressSession ? "Resume session" : "Begin discovery"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Step {currentStep} of {STEPS.length}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs capitalize">
                {currentStepData.type === "card-select" ? "Select" : currentStepData.type === "slider" ? "Rate" : currentStepData.type === "ranking" ? "Rank" : "Reflect"}
              </Badge>
              <span>{Math.round(progressPercent)}% complete</span>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" data-testid="progress-discovery" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-serif" data-testid={`step-title-${currentStep}`}>
              {currentStepData.title}
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              {currentStepData.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStepData.type === "textarea" && (
              <div>
                <Label htmlFor="step-answer" className="sr-only">{currentStepData.title}</Label>
                <Textarea
                  id="step-answer"
                  placeholder={currentStepData.placeholder}
                  value={typeof currentAnswer === "string" ? currentAnswer : ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [stepKey]: e.target.value }))
                  }
                  rows={8}
                  className="resize-none text-base leading-relaxed"
                  data-testid={`textarea-step-${currentStep}`}
                />
              </div>
            )}

            {currentStepData.type === "card-select" && (
              <CardSelectInput
                options={currentStepData.options ?? []}
                value={Array.isArray(currentAnswer) ? currentAnswer : []}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [stepKey]: v }))}
                maxSelections={currentStepData.maxSelections}
              />
            )}

            {currentStepData.type === "slider" && (
              <SliderInput
                step={currentStepData}
                value={typeof currentAnswer === "number" ? currentAnswer : Math.round(((currentStepData.sliderMin ?? 1) + (currentStepData.sliderMax ?? 10)) / 2)}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [stepKey]: v }))}
              />
            )}

            {currentStepData.type === "ranking" && (
              <RankingInput
                options={currentStepData.options ?? []}
                value={Array.isArray(currentAnswer) ? currentAnswer : []}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [stepKey]: v }))}
              />
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                data-testid="button-prev-step"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <Button
                onClick={handleNext}
                disabled={updateSession.isPending}
                data-testid={currentStep === STEPS.length ? "button-complete-discovery" : "button-next-step"}
              >
                {currentStep === STEPS.length ? "Complete & synthesize" : "Next"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
