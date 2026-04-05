import React, { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Discover from "@/pages/discover";
import Hypotheses from "@/pages/hypotheses";
import HypothesisDetail from "@/pages/hypothesis-detail";
import Plan from "@/pages/plan";
import PlanNew from "@/pages/plan-new";
import Coach from "@/pages/coach";
import CoachSession from "@/pages/coach-session";
import CheckIn from "@/pages/checkin";
import Obstacles from "@/pages/obstacles";
import Reflections from "@/pages/reflections";
import Settings from "@/pages/settings";
import Demo from "@/pages/demo";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function SignInPage() {
  return (
    <div className="flex justify-center mt-8">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex justify-center mt-8">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
          <div className="max-w-2xl text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary">Ikigai Compass</h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              A quiet space to find your direction. Discover what you love, what you are good at, what the world needs, and what can sustain you.
            </p>
            <div className="pt-8 space-y-4">
              <a
                href={`${basePath}/sign-up`}
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                data-testid="landing-signup-btn"
              >
                Begin your journey
              </a>
              <div>
                <a
                  href={`${basePath}/demo`}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  data-testid="landing-demo-btn"
                >
                  Try without an account
                </a>
              </div>
              <div className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <a href={`${basePath}/sign-in`} className="underline underline-offset-4 hover:text-primary">
                  Sign in
                </a>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
          <Route path="/discover" component={() => <ProtectedRoute component={Discover} />} />
          <Route path="/hypotheses/:id" component={() => <ProtectedRoute component={HypothesisDetail} />} />
          <Route path="/hypotheses" component={() => <ProtectedRoute component={Hypotheses} />} />
          <Route path="/plan/new" component={() => <ProtectedRoute component={PlanNew} />} />
          <Route path="/plan" component={() => <ProtectedRoute component={Plan} />} />
          <Route path="/coach/:id" component={() => <ProtectedRoute component={CoachSession} />} />
          <Route path="/coach" component={() => <ProtectedRoute component={Coach} />} />
          <Route path="/checkin" component={() => <ProtectedRoute component={CheckIn} />} />
          <Route path="/obstacles" component={() => <ProtectedRoute component={Obstacles} />} />
          <Route path="/reflections" component={() => <ProtectedRoute component={Reflections} />} />
          <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
          <Route path="/demo" component={Demo} />
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function DemoOnlyApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="max-w-2xl text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary">Ikigai Compass</h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            A quiet space to find your direction.
          </p>
          <p className="text-sm text-muted-foreground italic">
            Sign-in is not configured in this environment. You can explore the demo experience.
          </p>
          <div className="pt-4">
            <a
              href={`${basePath}/demo`}
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              data-testid="landing-demo-btn"
            >
              Explore demo
            </a>
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
}

function App() {
  if (!clerkPubKey) {
    return (
      <WouterRouter base={basePath}>
        <TooltipProvider>
          <Switch>
            <Route path="/demo" component={Demo} />
            <Route component={DemoOnlyApp} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </WouterRouter>
    );
  }

  return (
    <WouterRouter base={basePath}>
      <TooltipProvider>
        <ClerkProviderWithRoutes />
        <Toaster />
      </TooltipProvider>
    </WouterRouter>
  );
}

export default App;
