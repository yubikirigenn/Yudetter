import { Link, useLocation } from "wouter";
import { Home, Search, Bell, User, PenSquare } from "lucide-react";
import { useClerk } from "@clerk/react";
import { Button } from "./ui/button";
import type { UserProfile } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export default function Sidebar({ me }: { me?: UserProfile }) {
  const [location] = useLocation();
  const { signOut } = useClerk();

  const navItems = [
    { name: "ホーム", path: "/", icon: Home },
    { name: "探索", path: "/explore", icon: Search },
    { name: "通知", path: "/notifications", icon: Bell },
    { name: "プロフィール", path: `/profile/${me?.username || 'me'}`, icon: User },
  ];

  return (
    <div className="h-full flex flex-col justify-between pt-2">
      <div className="flex flex-col gap-2 xl:gap-4">
        <Link href="/" className="flex items-center justify-center xl:justify-start p-3 xl:px-4 rounded-full hover:bg-primary/10 transition-colors w-fit group">
          <img src="/logo.svg" alt="Yudetter Logo" className="w-8 h-8 group-hover:scale-105 transition-transform" />
        </Link>

        <nav className="flex flex-col gap-1 xl:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            
            return (
              <Link key={item.name} href={item.path} className="group flex items-center justify-center xl:justify-start gap-4 p-3 xl:px-4 rounded-full hover:bg-secondary transition-colors w-fit xl:w-full">
                <Icon className={`w-7 h-7 ${isActive ? 'text-primary fill-primary/20' : 'text-foreground group-hover:text-primary transition-colors'}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`hidden xl:inline text-xl font-rounded ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        <Button className="mt-4 xl:w-[90%] h-14 rounded-full font-rounded text-lg shadow-sm hover:shadow-md transition-all active:scale-95 mx-auto">
          <span className="hidden xl:inline">ユデートする</span>
          <PenSquare className="w-6 h-6 xl:hidden" />
        </Button>
      </div>

      {me && (
        <div className="mb-4 xl:w-full">
          <button 
            onClick={() => signOut()}
            className="w-full flex items-center justify-center xl:justify-start gap-3 p-3 rounded-full hover:bg-secondary transition-colors"
          >
            <Avatar className="w-10 h-10 border border-border">
              <AvatarImage src={me.avatarUrl || ''} />
              <AvatarFallback className="bg-primary/20 text-primary font-bold">{me.displayName[0]}</AvatarFallback>
            </Avatar>
            <div className="hidden xl:flex flex-col items-start overflow-hidden">
              <span className="font-bold text-sm truncate w-full">{me.displayName}</span>
              <span className="text-muted-foreground text-sm truncate w-full">@{me.username}</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}