import { useEffect, useRef, lazy, Suspense } from "react";
import { Switch, Route, useLocation, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import Layout from '@/components/layout';
import HomePage from '@/pages/home';
import LandingPage from '@/pages/landing';

// Lazy load pages to decrease bundle size and load time
const ExplorePage = lazy(() => import('@/pages/explore'));
const NotificationsPage = lazy(() => import('@/pages/notifications'));
const ProfilePage = lazy(() => import('@/pages/profile'));
const SettingsPage = lazy(() => import('@/pages/settings'));
const YudateDetailPage = lazy(() => import('@/pages/yudate-detail'));
const SetupPage = lazy(() => import('@/pages/setup'));
const NotFound = lazy(() => import('@/pages/not-found'));
const SignInPage = lazy(() => import('@/pages/sign-in'));
const SignUpPage = lazy(() => import('@/pages/sign-up'));
const WalletPage = lazy(() => import('@/pages/wallet'));
const MarketPage = lazy(() => import('@/pages/market'));
const MarketDetailPage = lazy(() => import('@/pages/market-detail'));
const GamesPage = lazy(() => import('@/pages/games'));
const GamePlayPage = lazy(() => import('@/pages/game-play'));
const StudioPage = lazy(() => import('@/pages/studio'));
const RankingsPage = lazy(() => import('@/pages/rankings'));
const TermsPage = lazy(() => import('@/pages/terms'));

import { useSession } from "@/lib/auth-client";
import { useNotificationStream } from "@/hooks/use-notification-stream";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const BASE = basePath;

function AuthQueryClientCacheInvalidator() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isPending) return;
    
    const userId = session?.user?.id ?? null;
    
    if (prevUserIdRef.current === undefined) {
      prevUserIdRef.current = userId;
      return;
    }

    if (prevUserIdRef.current !== userId) {
      queryClient.clear();
      prevUserIdRef.current = userId;
    }
  }, [session, isPending, queryClient]);

  return null;
}

function NotificationStreamManager() {
  useNotificationStream();
  return null;
}

/** セッションあり・setupComplete未完了ならセットアップへ誘導 */
function useSetupRedirect(session: any, isPending: boolean) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isPending || !session) return;
    const user = session.user as any;
    // username が空 or setupComplete が false なら /setup へ
    const needsSetup = !user?.username || user?.setupComplete === false;
    if (needsSetup && location !== "/setup") {
      setLocation("/setup");
    }
  }, [session, isPending, location, setLocation]);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const [, setLocation] = useLocation();

  useSetupRedirect(session, isPending);

  useEffect(() => {
    if (!isPending && !session) {
      setLocation("/sign-in");
    }
  }, [session, isPending, setLocation]);

  if (isPending) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!session) return null;
  return <>{children}</>;
}

function HomeRoute() {
  const { data: session, isPending } = useSession();

  useSetupRedirect(session, isPending);

  if (isPending) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (session) {
    return (
      <Layout>
        <HomePage />
      </Layout>
    );
  }

  return <LandingPage />;
}

function AppWithRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthQueryClientCacheInvalidator />
      <NotificationStreamManager />
      <TooltipProvider>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[50vh] text-primary">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        }>
          <Switch>
            <Route path="/" component={HomeRoute} />
            <Route path="/sign-in" component={SignInPage} />
            <Route path="/sign-up" component={SignUpPage} />
          <Route path="/terms" component={TermsPage} />
          
          <Route path="/setup">
            <ProtectedRoute>
              <SetupPage />
            </ProtectedRoute>
          </Route>

          <Route path="/explore">
            <Layout><ExplorePage /></Layout>
          </Route>
          <Route path="/notifications">
            <ProtectedRoute>
              <Layout><NotificationsPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/profile/:username">
            <Layout><ProfilePage /></Layout>
          </Route>
          <Route path="/settings">
            <ProtectedRoute>
              <Layout><SettingsPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/wallet">
            <ProtectedRoute>
              <Layout><WalletPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/market">
            <ProtectedRoute>
              <Layout><MarketPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/market/:id">
            <ProtectedRoute>
              <Layout><MarketDetailPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/games">
            <ProtectedRoute>
              <Layout><GamesPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/games/:id">
            <ProtectedRoute>
              <Layout><GamePlayPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/studio">
            <ProtectedRoute>
              <StudioPage />
            </ProtectedRoute>
          </Route>
          <Route path="/rankings">
            <ProtectedRoute>
              <Layout><RankingsPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/yudate/:id">
            <Layout><YudateDetailPage /></Layout>
          </Route>
          
          <Route component={NotFound} />
        </Switch>
        </Suspense>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppWithRoutes />
    </WouterRouter>
  );
}

export default App;
