import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Search, Bell, User, Menu, Wallet, ShoppingBag, Gamepad2, Trophy, Settings, Coins, Plus } from "lucide-react";
import type { UserProfile } from "@workspace/api-client-react";
import { useUnreadNotificationCount } from "@/hooks/use-unread-count";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import YudateComposer from "./yudate-composer";

export default function MobileNav({ me }: { me?: UserProfile }) {
  const [location] = useLocation();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const mainNavItems = [
    { name: "ホーム", path: "/", icon: Home },
    { name: "探索", path: "/explore", icon: Search },
  ];

  const subNavItems = [
    { name: "プロフィール", path: `/profile/${me?.username || 'me'}`, icon: User },
    { name: "ウォレット", path: "/wallet", icon: Wallet },
    { name: "マーケット", path: "/market", icon: ShoppingBag },
    { name: "ゲーム", path: "/games", icon: Gamepad2 },
    { name: "ランキング", path: "/rankings", icon: Trophy },
    { name: "設定", path: "/settings", icon: Settings },
  ];

  return (
    <div className="flex justify-around items-center h-16 px-1">
      {/* 1. ホーム / 2. 探索 */}
      {mainNavItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          location === item.path ||
          (item.path !== "/" && location.startsWith(item.path));

        return (
          <Link
            key={item.name}
            href={item.path}
            className="flex flex-col items-center justify-center flex-1 h-full py-2 touch-manipulation"
          >
            <div
              className={`p-2 rounded-full transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/70"
              }`}
            >
              <Icon
                className="w-6 h-6"
                strokeWidth={isActive ? 2.5 : 2}
                fill={isActive ? "currentColor" : "none"}
                fillOpacity={isActive ? 0.15 : 0}
              />
            </div>
          </Link>
        );
      })}

      {/* 3. ユデート（投稿）ボタン - 中央配置のプレミアムなプラスボタン */}
      <Dialog open={isComposerOpen} onOpenChange={setIsComposerOpen}>
        <DialogTrigger asChild>
          <button
            className="flex items-center justify-center shrink-0 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-md active:scale-95 transition-all touch-manipulation mx-1"
            aria-label="ユデートする"
          >
            <Plus className="w-6 h-6" strokeWidth={3} />
          </button>
        </DialogTrigger>
        <DialogContent className="w-[92vw] max-w-[500px] p-0 border-none bg-transparent shadow-none top-[30%] translate-y-[-30%]">
          <div className="bg-background rounded-2xl overflow-hidden border border-border shadow-xl">
            <div className="px-4 pt-3 pb-1 border-b border-border/30">
              <span className="text-sm font-medium text-muted-foreground">新しいユデート</span>
            </div>
            <YudateComposer autoFocus onSuccess={() => setIsComposerOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. 通知 */}
      <Link
        href="/notifications"
        className="flex flex-col items-center justify-center flex-1 h-full py-2 touch-manipulation"
      >
        <div
          className={`relative p-2 rounded-full transition-colors ${
            location.startsWith("/notifications")
              ? "bg-primary/10 text-primary"
              : "text-foreground/70"
          }`}
        >
          <Bell
            className="w-6 h-6"
            strokeWidth={location.startsWith("/notifications") ? 2.5 : 2}
            fill={location.startsWith("/notifications") ? "currentColor" : "none"}
            fillOpacity={location.startsWith("/notifications") ? 0.15 : 0}
          />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </Link>

      {/* 5. その他メニュー (Sheet) */}
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetTrigger asChild>
          <button className="flex flex-col items-center justify-center flex-1 h-full py-2 text-foreground/70 active:scale-95 transition-transform touch-manipulation">
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
          <nav className="flex-1 px-4 py-2 flex flex-col gap-1.5 overflow-y-auto">
            {subNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.startsWith(item.path);

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  onClick={() => setIsMenuOpen(false)}
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
