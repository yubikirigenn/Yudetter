import { Link, useLocation } from "wouter";
import { Home, Search, Bell, User, PenSquare, LogOut, UserPlus, MoreHorizontal, CheckCircle2, Settings, Wallet, Gamepad2, ShoppingBag, Trophy, FileCode } from "lucide-react";
import { signOut, signIn, authClient, useSession } from "@/lib/auth-client";
import { Button } from "./ui/button";
import type { UserProfile } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import YudateComposer from "./yudate-composer";
import { useUnreadNotificationCount } from "@/hooks/use-unread-count";
import { useQuery } from "@tanstack/react-query";

/** デバイス上のすべてのセッション一覧を取得 */
function useDeviceSessions() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["device-sessions"],
    queryFn: async () => {
      const res = await (authClient as any).multiSession.listDeviceSessions();
      return (res?.data ?? []) as Array<{
        session: { token: string };
        user: { id: string; name?: string; email: string; image?: string; username?: string; displayName?: string };
      }>;
    },
    enabled: !!session,
    staleTime: 5000,
  });
}

export default function Sidebar({ me }: { me?: UserProfile }) {
  const [location, setLocation] = useLocation();
  const { data: session } = useSession();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data: deviceSessions = [], refetch: refetchSessions } = useDeviceSessions();

  const navItems = [
    { name: "ホーム", path: "/", icon: Home },
    { name: "探索", path: "/explore", icon: Search },
    { name: "通知", path: "/notifications", icon: Bell, badge: unreadCount },
    { name: "プロフィール", path: `/profile/${me?.username || 'me'}`, icon: User },
    { name: "ウォレット", path: "/wallet", icon: Wallet },
    { name: "マーケット", path: "/market", icon: ShoppingBag },
    { name: "ゲーム", path: "/games", icon: Gamepad2 },
    { name: "ランキング", path: "/rankings", icon: Trophy },
    { name: "設定", path: "/settings", icon: Settings },
  ];

  const currentSessionToken = (session as any)?.session?.token;

  const handleSwitchAccount = async (token: string) => {
    await (authClient as any).multiSession.setActive({ sessionToken: token });
    window.location.href = "/";
  };

  const handleAddAccount = () => {
    setLocation("/sign-in");
  };

  const handleSignOut = async () => {
    await signOut();
    // 他にセッションがあれば最初のものに切り替え
    const others = deviceSessions.filter(s => s.session.token !== currentSessionToken);
    if (others.length > 0) {
      await (authClient as any).multiSession.setActive({ sessionToken: others[0].session.token });
      window.location.href = "/";
    } else {
      setLocation("/sign-in");
    }
  };

  return (
    <div className="h-screen flex flex-col justify-between pt-2 overflow-hidden">
      <div className="flex flex-col gap-2 xl:gap-4 overflow-y-auto">
        <Link href="/" className="flex items-center justify-center xl:justify-start p-3 xl:px-4 rounded-full hover:bg-primary/10 transition-colors w-fit group">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-border/50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <img src="/logo.png" alt="Yudetter Logo" className="w-full h-full object-cover scale-[1.3]" />
          </div>
        </Link>

        <nav className="flex flex-col gap-1 xl:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            const badge = item.badge ?? 0;

            return (
              <Link
                key={item.name}
                href={item.path}
                className="group flex items-center justify-center xl:justify-start gap-4 p-3 xl:px-4 rounded-full hover:bg-secondary transition-colors w-fit xl:w-full"
              >
                <div className="relative">
                  <Icon
                    className={`w-7 h-7 ${isActive ? 'text-primary' : 'text-foreground group-hover:text-primary transition-colors'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                    fill={isActive ? 'currentColor' : 'none'}
                    fillOpacity={isActive ? 0.15 : 0}
                  />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>
                <span className={`hidden xl:inline text-xl font-rounded ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Compose button */}
        <Dialog>
          <DialogTrigger asChild>
            <Button className="mt-4 xl:w-[90%] h-14 rounded-full font-rounded text-lg shadow-sm hover:shadow-md transition-all active:scale-95 mx-auto">
              <span className="hidden xl:inline">ユデートする</span>
              <PenSquare className="w-6 h-6 xl:hidden" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] p-0 border-none bg-transparent shadow-none">
            <div className="bg-background rounded-2xl overflow-hidden border border-border shadow-xl">
              <div className="px-4 pt-3 pb-1 border-b border-border/30">
                <span className="text-sm font-medium text-muted-foreground">新しいユデート</span>
              </div>
              <YudateComposer autoFocus />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* User account area */}
      {me && (
        <div className="shrink-0 pb-4 pt-2">
          <DropdownMenu onOpenChange={(open) => open && refetchSessions()}>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-center xl:justify-between gap-3 p-3 rounded-full hover:bg-secondary transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-10 h-10 border border-border shrink-0">
                    <AvatarImage src={me.avatarUrl || ''} />
                    <AvatarFallback className="bg-primary/20 text-primary font-bold">
                      {me.displayName?.[0] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden xl:flex flex-col items-start text-left overflow-hidden min-w-0">
                    <span className="font-bold text-sm truncate w-full text-left">{me.displayName}</span>
                    <span className="text-muted-foreground text-sm truncate w-full text-left">@{me.username}</span>
                  </div>
                </div>
                <MoreHorizontal className="hidden xl:block w-5 h-5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" side="top" className="w-72 mb-1">
              {/* 現在のアカウント */}
              <div className="px-3 py-2 flex flex-col items-start text-left">
                <p className="font-bold text-sm truncate w-full text-left">{me.displayName}</p>
                <p className="text-muted-foreground text-sm truncate w-full text-left">@{me.username}</p>
              </div>
              <div className="-mx-1 my-1 h-px bg-muted" />

              {/* ログイン中の他アカウント */}
              {deviceSessions.length > 1 && (
                <>
                  <div className="px-3 py-1">
                    <p className="text-xs text-muted-foreground font-medium">ログイン中のアカウント</p>
                  </div>
                  {deviceSessions.map((s) => {
                    const isCurrent = s.session.token === currentSessionToken;
                    const displayName = (s.user as any).displayName || s.user.name || s.user.email;
                    const username = (s.user as any).username || s.user.email.split("@")[0];
                    const avatar = (s.user as any).avatarUrl || s.user.image;
                    return (
                      <DropdownMenuItem
                        key={s.session.token}
                        className="gap-3 cursor-pointer px-3 py-2"
                        onClick={() => !isCurrent && handleSwitchAccount(s.session.token)}
                        disabled={isCurrent}
                      >
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={avatar || ''} />
                          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                            {displayName?.[0] ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0 flex-1 items-start text-left">
                          <span className="font-semibold text-sm truncate w-full text-left">{displayName}</span>
                          <span className="text-muted-foreground text-xs truncate w-full text-left">@{username}</span>
                        </div>
                        {isCurrent && (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                  <div className="-mx-1 my-1 h-px bg-muted" />
                </>
              )}

              {/* アカウントを追加 */}
              <DropdownMenuItem
                onClick={handleAddAccount}
                className="gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                アカウントを追加
              </DropdownMenuItem>
              <div className="-mx-1 my-1 h-px bg-muted" />

              {/* ログアウト */}
              <DropdownMenuItem
                onClick={handleSignOut}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4" />
                @{me.username} をログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
