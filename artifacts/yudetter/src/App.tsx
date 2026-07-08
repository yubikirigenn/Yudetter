import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useSyncUser } from '@workspace/api-client-react';

import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import Layout from '@/components/layout';
import HomePage from '@/pages/home';
import LandingPage from '@/pages/landing';
import ExplorePage from '@/pages/explore';
import NotificationsPage from '@/pages/notifications';
import ProfilePage from '@/pages/profile';
import YudateDetailPage from '@/pages/yudate-detail';
import SetupPage from '@/pages/setup';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(145 60% 55%)",
    colorForeground: "hsl(160 20% 25%)",
    colorMutedForeground: "hsl(160 15% 50%)",
    colorDanger: "hsl(0 70% 65%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(140 30% 90%)",
    colorInputForeground: "hsl(160 20% 25%)",
    colorNeutral: "hsl(140 30% 90%)",
    fontFamily: "'Noto Sans JP', sans-serif",
    borderRadius: "1rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-sm border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold font-rounded",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "font-medium",
    formFieldLabel: "font-medium text-foreground",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-primary",
    alertText: "text-destructive",
    logoBox: "mb-6 flex justify-center",
    logoImage: "w-16 h-16",
    socialButtonsBlockButton: "border-border hover:bg-secondary/50 transition-colors",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground transition-colors font-bold font-rounded",
    formFieldInput: "bg-background border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none",
    footerAction: "flex items-center gap-2",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border-destructive/20 text-destructive",
    otpCodeFieldInput: "border-border",
    formFieldRow: "gap-4",
    main: "gap-6",
  },
};

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

/** Syncs Clerk user to DB and redirects to /setup if profile is not yet complete */
function UserSync() {
  const { user, isLoaded } = useUser();
  const syncMutation = useSyncUser();
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    if (isLoaded && user && !syncMutation.isSuccess && !syncMutation.isPending) {
      syncMutation.mutate({
        data: {
          clerkId: user.id,
          username: user.username ?? user.id,
          displayName: user.fullName ?? user.username ?? 'User',
          email: user.primaryEmailAddress?.emailAddress ?? '',
          avatarUrl: user.imageUrl ?? null,
        }
      });
    }
  }, [isLoaded, user, syncMutation.isSuccess, syncMutation.isPending, syncMutation.mutate]);

  // Redirect to /setup if sync succeeded and setup is not complete
  useEffect(() => {
    if (syncMutation.isSuccess && syncMutation.data) {
      const profile = syncMutation.data as any;
      if (!profile.setupComplete && location !== '/setup') {
        setLocation('/setup');
      }
    }
  }, [syncMutation.isSuccess, syncMutation.data, location, setLocation]);
  
  return null;
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

function HomeRoute() {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <HomePage />
        </Layout>
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
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
      localization={{
        signIn: { start: { title: "おかえり！", subtitle: "Yudetterにサインインしよう" } },
        signUp: { start: { title: "はじめよう！", subtitle: "Yudetterで新しいアカウントを作成" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Show when="signed-in">
          <UserSync />
        </Show>
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRoute} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            <Route path="/setup">
              <Show when="signed-in">
                <SetupPage />
              </Show>
              <Show when="signed-out">
                <Redirect to="/sign-in" />
              </Show>
            </Route>

            <Route path="/explore">
              <Layout><ExplorePage /></Layout>
            </Route>
            <Route path="/notifications">
              <Layout><NotificationsPage /></Layout>
            </Route>
            <Route path="/profile/:username">
              <Layout><ProfilePage /></Layout>
            </Route>
            <Route path="/yudate/:id">
              <Layout><YudateDetailPage /></Layout>
            </Route>
            
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
