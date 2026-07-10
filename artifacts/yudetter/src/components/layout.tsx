import { ReactNode } from "react";
import { useLocation } from "wouter";
import { PenSquare } from "lucide-react";
import Sidebar from "./sidebar";
import RightSidebar from "./right-sidebar";
import MobileNav from "./mobile-nav";
import { useGetMe } from "@workspace/api-client-react";
import YudateComposer from "./yudate-composer";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";

export default function Layout({ children }: { children: ReactNode }) {
  const { data: me } = useGetMe();

  return (
    <div className="flex justify-center min-h-[100dvh] bg-background text-foreground selection:bg-primary/20">
      <div className="w-full max-w-[1280px] flex justify-between">
        {/* Left Sidebar — sticky, exactly one screen tall */}
        <header className="hidden sm:flex flex-col w-[72px] xl:w-[275px] shrink-0 h-screen sticky top-0 px-2 xl:px-4">
          <Sidebar me={me} />
        </header>

        {/* Main Feed */}
        <main className="flex-grow w-full max-w-[600px] border-l border-r border-border/50 min-h-[100dvh] pb-20 sm:pb-0">
          {children}
        </main>

        {/* Right Sidebar — Desktop Only */}
        <aside className="hidden lg:block w-[350px] shrink-0 min-h-screen sticky top-0 pl-8 pr-4 py-4">
          <RightSidebar />
        </aside>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]">
        <MobileNav me={me} />
      </div>
    </div>
  );
}
