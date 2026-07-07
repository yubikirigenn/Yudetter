import { Link, useLocation } from "wouter";
import { Home, Search, Bell, User, PenSquare } from "lucide-react";
import type { UserProfile } from "@workspace/api-client-react";
import { Button } from "./ui/button";

export default function MobileNav({ me }: { me?: UserProfile }) {
  const [location] = useLocation();

  const navItems = [
    { name: "ホーム", path: "/", icon: Home },
    { name: "探索", path: "/explore", icon: Search },
    { name: "通知", path: "/notifications", icon: Bell },
    { name: "プロフィール", path: `/profile/${me?.username || 'me'}`, icon: User },
  ];

  return (
    <div className="flex justify-around items-center h-14 px-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
        
        return (
          <Link key={item.name} href={item.path} className="flex flex-col items-center justify-center w-full h-full p-2">
            <div className={`p-1.5 rounded-full transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-secondary'}`}>
              <Icon className={`w-6 h-6 ${isActive ? 'fill-primary/20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}