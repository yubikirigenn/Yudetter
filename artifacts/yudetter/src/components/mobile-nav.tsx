import { Link, useLocation } from "wouter";
import { Home, Search, Bell, User } from "lucide-react";
import type { UserProfile } from "@workspace/api-client-react";
import { useUnreadNotificationCount } from "@/hooks/use-unread-count";

export default function MobileNav({ me }: { me?: UserProfile }) {
  const [location] = useLocation();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  const navItems = [
    { name: "ホーム", path: "/", icon: Home },
    { name: "探索", path: "/explore", icon: Search },
    { name: "通知", path: "/notifications", icon: Bell, badge: unreadCount },
    { name: "プロフィール", path: `/profile/${me?.username || 'me'}`, icon: User },
  ];

  return (
    <div className="flex justify-around items-center h-14">
      {navItems.map((item) => {
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
    </div>
  );
}
