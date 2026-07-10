import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Search, Bell, User, Menu, Wallet, ShoppingBag, Gamepad2, Trophy, Settings, Coins } from "lucide-react";
import type { UserProfile } from "@workspace/api-client-react";
import { useUnreadNotificationCount } from "@/hooks/use-unread-count";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default function MobileNav({ me }: { me?: UserProfile }) {
  const [location] = useLocation();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const [isOpen, setIsOpen] = useState(false);

  const mainNavItems = [
    { name: "ホーム", path: "/", icon: Home },
    { name: "探索", path: "/explore", icon: Search },
    { name: "通知", path: "/notifications", icon: Bell, badge: unreadCount },
    { name: "プロフィール", path: `/profile/${me?.username || 'me'}`, icon: User },
  ];

  const subNavItems = [
    { name: "ウォレット", path: "/wallet", icon: Wallet },
    { name: "マーケット", path: "/market", icon: ShoppingBag },
    { name: "ゲーム", path: "/games", icon: Gamepad2 },
    { name: "ランキング", path: "/rankings", icon: Trophy },
    { name: "設定", path: "/settings", icon: Settings },
  ];

  return (
    <div className="flex justify-around items-center h-14">
      {mainNavItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          location === item.path ||
          (item.path !== "/" && location.startsWith(item.path));
        const badge = item.badge ?? 0;

        return (
          <Link
            key={item.name}
            href={item.path}
            className="flex flex-col items-center justify-center flex-1 h-full py-2 gap-0.5 touch-manipulation"
          >
            <div
              className={`relative p-2 rounded-full transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/70"
              }`}
            >
              <Icon
                className={`w-6 h-6`}
                strokeWidth={isActive ? 2.5 : 2}
                fill={isActive ? "currentColor" : "none"}
                fillOpacity={isActive ? 0.15 : 0}
              />
              {badge > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </div>
          </Link>
        );
      })}

      {/* その他メニュー (Sheet) */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <button className="flex flex-col items-center justify-center flex-1 h-full py-2 gap-0.5 text-foreground/70 active:scale-95 transition-transform touch-manipulation">
            <div className="p-2 rounded-full hover:bg-secondary transition-colors">
              <Menu className="w-6 h-6" strokeWidth={2} />
            </div>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[280px] p-0 flex flex-col bg-background border-l border-border/50">
          <SheetHeader className="p-6 border-b border-border/50 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-border flex items-center justify-center bg-muted">
              <img src="/logo.png" alt="Yudetter" className="w-full h-full object-cover scale-[1.3]" />
            </div>
            <div className="text-left">
              <SheetTitle className="text-base font-bold font-rounded">メニュー</SheetTitle>
              {me && <p className="text-xs text-muted-foreground">@{me.username}</p>}
            </div>
          </SheetHeader>

          {/* ユーザー簡易ステータス (YD残高表示) */}
          {me && (
            <div className="mx-6 my-4 p-4 rounded-2xl bg-secondary/30 border border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-bold text-muted-foreground">所持YD</span>
              </div>
              <span className="font-rounded font-black text-sm text-foreground">
                {me.yudedollar.toLocaleString()} YD
              </span>
            </div>
          )}

          {/* メニューリスト */}
          <nav className="flex-1 px-4 py-2 flex flex-col gap-1.5">
            {subNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.startsWith(item.path);

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold transition-all
                    ${isActive 
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]" 
                      : "text-foreground/80 hover:bg-secondary/60 hover:text-foreground"}
                  `}
                >
                  <Icon className="w-5 h-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
