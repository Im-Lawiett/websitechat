import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useGetMe } from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";
import ChatHome from "@/pages/chat";
import GroupChat from "@/pages/group-chat";
import DmChat from "@/pages/dm-chat";
import AdminDashboard from "@/pages/admin/dashboard";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "hsl(262.1 83.3% 57.8%)",
    colorBackground: "hsl(240 10% 3.9%)",
    colorInput: "hsl(240 3.7% 15.9%)",
    colorInputForeground: "hsl(0 0% 98%)",
    colorForeground: "hsl(0 0% 98%)",
    colorMutedForeground: "hsl(240 5% 64.9%)",
    colorNeutral: "hsl(240 3.7% 15.9%)",
    colorDanger: "hsl(0 62.8% 30.6%)",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-background rounded-2xl w-[440px] max-w-full overflow-hidden border border-border shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground",
    formFieldLabel: "text-foreground",
    footerActionLink: "text-primary hover:text-primary/90",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
  }
};

const queryClient = new QueryClient();

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function Home() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <Show when="signed-in">
        <Redirect to="/chat" />
      </Show>
      <Show when="signed-out">
        <header className="px-6 py-4 flex items-center justify-between border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground">G</div>
            <span className="font-bold text-xl">GlobalChat</span>
          </div>
          <div className="flex items-center gap-4">
            <WouterRouter base={basePath}>
              <Route path="/">
                <Button variant="ghost" asChild>
                  <a href={`${basePath}/sign-in`}>Sign In</a>
                </Button>
                <Button asChild>
                  <a href={`${basePath}/sign-up`}>Get Started</a>
                </Button>
              </Route>
            </WouterRouter>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-5xl font-black mb-6 max-w-2xl leading-tight">
            The community-first messaging platform.
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-xl">
            A vibrant place for real conversations. Dense, warm, and alive.
          </p>
          <Button size="lg" className="text-lg px-8 h-14" asChild>
            <a href={`${basePath}/sign-up`}>Join the Community</a>
          </Button>
        </main>
      </Show>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe();

  if (isLoading) {
    return <div className="flex min-h-[100dvh] items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (user?.isBanned) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center flex-col gap-4 text-center p-8 bg-background">
        <h1 className="text-4xl font-bold text-destructive">Akun Anda telah di-ban</h1>
        <p className="text-muted-foreground text-lg">{user.banReason || "No reason provided."}</p>
      </div>
    );
  }

  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe();

  if (isLoading) return <div className="flex min-h-[100dvh] items-center justify-center text-muted-foreground">Loading...</div>;
  
  if (user?.role !== 'admin') {
    return <Redirect to="/chat" />;
  }

  return <>{children}</>;
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            <Route path="/chat">
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
              <Show when="signed-in"><AuthGuard><ChatHome /></AuthGuard></Show>
            </Route>

            <Route path="/chat/group/:groupId">
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
              <Show when="signed-in"><AuthGuard><GroupChat /></AuthGuard></Show>
            </Route>

            <Route path="/chat/dm/:userId">
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
              <Show when="signed-in"><AuthGuard><DmChat /></AuthGuard></Show>
            </Route>

            <Route path="/admin">
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
              <Show when="signed-in"><AuthGuard><AdminGuard><AdminDashboard /></AdminGuard></AuthGuard></Show>
            </Route>
            
            <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
      <Toaster />
    </WouterRouter>
  );
}

export default App;
