import { useState } from "react";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_STEPS = [
  {
    key: "passions",
    question: "What activities make you lose track of time?",
    hint: "Think about hobbies, projects, or conversations that fully absorb you.",
  },
  {
    key: "strengths",
    question: "What do others consistently say you are good at?",
    hint: "These could be skills, talents, or ways of thinking that come naturally.",
  },
  {
    key: "contribution",
    question: "What problems in the world do you wish you could fix?",
    hint: "Big or small — what injustices, inefficiencies, or gaps do you notice and care about?",
  },
  {
    key: "sustainability",
    question: "What kinds of work or service would you happily do for a living?",
    hint: "Not just what pays well — but what work feels meaningful enough to sustain.",
  },
];

export default function Demo() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState("");
  const [showResult, setShowResult] = useState(false);

  const step = DEMO_STEPS[currentStep];
  const progress = ((currentStep) / DEMO_STEPS.length) * 100;

  const handleNext = () => {
    if (!current.trim()) return;
    const newAnswers = { ...answers, [step!.key]: current };
    setAnswers(newAnswers);
    setCurrent("");
    if (currentStep < DEMO_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      setShowResult(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      setCurrent(answers[DEMO_STEPS[currentStep - 1]!.key] ?? "");
    }
  };

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  if (showResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-xl w-full space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-serif font-semibold text-foreground">Your Ikigai Preview</h1>
            <p className="text-muted-foreground">Based on your responses, here is a glimpse of your Ikigai intersection.</p>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-3">
                {Object.entries(answers).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {DEMO_STEPS.find((s) => s.key === key)?.question}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{value}</p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sign up to get AI-generated Ikigai hypotheses, build a 90-day growth plan, and access your personal AI coach.
                </p>
                <div className="flex gap-3">
                  <a
                    href={`${basePath}/sign-up`}
                    className="flex-1 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    data-testid="demo-signup-cta"
                  >
                    Sign up to save and continue
                  </a>
                  <Button variant="outline" onClick={() => setLocation("/")} className="flex-1">
                    Not now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-xl w-full space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Step {currentStep + 1} of {DEMO_STEPS.length}</span>
            <span className="text-sm text-muted-foreground">Demo mode — your responses stay local</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-serif font-medium leading-snug text-foreground">
              {step!.question}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{step!.hint}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Write freely — there are no wrong answers..."
              rows={5}
              className="resize-none"
              data-testid={`demo-answer-${step!.key}`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) handleNext();
              }}
            />
            <div className="flex gap-3">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handleBack} className="flex items-center gap-1.5">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={!current.trim()}
                className={cn("flex items-center gap-1.5", currentStep > 0 ? "flex-1" : "w-full")}
                data-testid="demo-next-btn"
              >
                {currentStep < DEMO_STEPS.length - 1 ? "Next" : "See preview"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Want the full experience?{" "}
          <a href={`${basePath}/sign-up`} className="underline underline-offset-4 hover:text-primary">
            Create a free account
          </a>
        </p>
      </div>
    </div>
  );
}
