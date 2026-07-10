import { useEffect, useRef } from "react";
import { Switch, Route, useLocation, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import Layout from '@/components/layout';
import HomePage from '@/pages/home';
import LandingPage from '@/pages/landing';
import ExplorePage from '@/pages/explore';
import NotificationsPage from '@/pages/notifications';
import ProfilePage from '@/pages/profile';
import SettingsPage from '@/pages/settings';
import YudateDetailPage from '@/pages/yudate-detail';
import SetupPage from '@/pages/setup';
import NotFound from '@/pages/not-found';
import SignInPage from '@/pages/sign-in';
import SignUpPage from '@/pages/sign-up';
import WalletPage from '@/pages/wallet';
import MarketPage from '@/pages/market';
import MarketDetailPage from '@/pages/market-detail';
import GamesPage from '@/pages/games';
import GamePlayPage from '@/pages/game-play';
import StudioPage from '@/pages/studio';
import RankingsPage from '@/pages/rankings';
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
        <Switch>
          <Route path="/" component={HomeRoute} />
          <Route path="/sign-in" component={SignInPage} />
          <Route path="/sign-up" component={SignUpPage} />
          
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
