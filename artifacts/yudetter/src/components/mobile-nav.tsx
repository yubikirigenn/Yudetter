import { Link, useLocation } from "wouter";
import { Home, Search, Bell, User } from "lucide-react";
import type { UserProfile } from "@workspace/api-client-react";

export default function MobileNav({ me }: { me?: UserProfile }) {
  const [location] = useLocation();

  const navItems = [
    { name: "ホーム", path: "/", icon: Home },
    { name: "探索", path: "/explore", icon: Search },
    { name: "通知", path: "/notifications", icon: Bell },
    { name: "プロフィール", path: `/profile/${me?.username || 'me'}`, icon: User },
  ];

  return (
    <div className="flex justify-around items-center h-14">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          location === item.path ||
          (item.path !== "/" && location.startsWith(item.path));

        return (
          <Link
            key={item.name}
            href={item.path}
            className="flex flex-col items-center justify-center flex-1 h-full py-2 gap-0.5 touch-manipulation"
          >
            <div
              className={`p-2 rounded-full transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/70"
              }`}
            >
              <Icon
                className={`w-6 h-6 ${isActive ? "" : ""}`}
                strokeWidth={isActive ? 2.5 : 2}
                fill={isActive ? "currentColor" : "none"}
                fillOpacity={isActive ? 0.15 : 0}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
