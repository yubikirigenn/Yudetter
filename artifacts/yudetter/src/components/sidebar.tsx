import { Link, useLocation } from "wouter";
import { Home, Search, Bell, User, PenSquare, LogOut, UserPlus, MoreHorizontal } from "lucide-react";
import { useClerk } from "@clerk/react";
import { Button } from "./ui/button";
import type { UserProfile } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import YudateComposer from "./yudate-composer";

export default function Sidebar({ me }: { me?: UserProfile }) {
  const [location] = useLocation();
  const { signOut, openSignIn } = useClerk();

  const navItems = [
    { name: "ホーム", path: "/", icon: Home },
    { name: "探索", path: "/explore", icon: Search },
    { name: "通知", path: "/notifications", icon: Bell },
    { name: "プロフィール", path: `/profile/${me?.username || 'me'}`, icon: User },
  ];

  return (
    <div className="h-screen flex flex-col justify-between pt-2 overflow-hidden">
      <div className="flex flex-col gap-2 xl:gap-4 overflow-y-auto">
        <Link href="/" className="flex items-center justify-center xl:justify-start p-3 xl:px-4 rounded-full hover:bg-primary/10 transition-colors w-fit group">
          <img src="/logo.svg" alt="Yudetter Logo" className="w-8 h-8 group-hover:scale-105 transition-transform" />
        </Link>

        <nav className="flex flex-col gap-1 xl:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));

            return (
              <Link
                key={item.name}
                href={item.path}
                className="group flex items-center justify-center xl:justify-start gap-4 p-3 xl:px-4 rounded-full hover:bg-secondary transition-colors w-fit xl:w-full"
              >
                <Icon
                  className={`w-7 h-7 ${isActive ? 'text-primary' : 'text-foreground group-hover:text-primary transition-colors'}`}
                  strokeWidth={isActive ? 2.5 : 2}
                  fill={isActive ? 'currentColor' : 'none'}
                  fillOpacity={isActive ? 0.15 : 0}
                />
                <span className={`hidden xl:inline text-xl font-rounded ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Compose button — desktop only; mobile uses FAB in layout */}
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

      {/* User account area — always visible at bottom */}
      {me && (
        <div className="shrink-0 pb-4 pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-center xl:justify-between gap-3 p-3 rounded-full hover:bg-secondary transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-10 h-10 border border-border shrink-0">
                    <AvatarImage src={me.avatarUrl || ''} />
                    <AvatarFallback className="bg-primary/20 text-primary font-bold">
                      {me.displayName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden xl:flex flex-col items-start overflow-hidden min-w-0">
                    <span className="font-bold text-sm truncate w-full">{me.displayName}</span>
                    <span className="text-muted-foreground text-sm truncate w-full">@{me.username}</span>
                  </div>
                </div>
                <MoreHorizontal className="hidden xl:block w-5 h-5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-64 mb-1">
              <div className="px-3 py-2">
                <p className="font-bold text-sm truncate">{me.displayName}</p>
                <p className="text-muted-foreground text-sm truncate">@{me.username}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => openSignIn()}
                className="gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                アカウントを追加
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut()}
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
