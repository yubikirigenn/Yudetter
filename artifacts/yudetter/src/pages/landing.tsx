import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Left decorative side */}
      <div className="flex-1 bg-primary/10 flex items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" 
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(145 60% 55%) 1px, transparent 0)', backgroundSize: '32px 32px' }}
        ></div>
        <img src="/logo.svg" alt="Yudetter" className="w-[300px] h-[300px] md:w-[500px] md:h-[500px] drop-shadow-2xl animate-pulse duration-3000" />
      </div>
      
      {/* Right interaction side */}
      <div className="flex-1 flex items-center p-8 lg:p-24 bg-background">
        <div className="max-w-md w-full mx-auto">
          <div className="flex items-center gap-4 mb-16">
            <img src="/logo.svg" alt="Yudetter Logo" className="w-12 h-12" />
            <h1 className="text-4xl font-rounded font-extrabold text-foreground">Yudetter</h1>
          </div>

          <h2 className="text-5xl md:text-6xl font-rounded font-extrabold leading-tight mb-10 tracking-tight">
            すべての瞬間を、<br/>
            <span className="text-primary">ユデート</span>しよう。
          </h2>
          
          <h3 className="text-2xl font-bold mb-8">「いまどうしてる？」を世界と共有。</h3>
          
          <div className="flex flex-col gap-4">
            <Link href="/sign-up" className="w-full">
              <Button size="lg" className="w-full h-14 rounded-full text-lg font-bold font-rounded">
                アカウントを作成
              </Button>
            </Link>
            
            <div className="flex items-center gap-4 my-2">
              <div className="h-px bg-border flex-1"></div>
              <span className="text-muted-foreground text-sm font-medium">または</span>
              <div className="h-px bg-border flex-1"></div>
            </div>

            <div className="text-sm font-bold mb-1 mt-2">すでにアカウントをお持ちですか？</div>
            <Link href="/sign-in" className="w-full">
              <Button variant="outline" size="lg" className="w-full h-14 rounded-full text-lg font-bold text-primary border-primary/20 hover:bg-primary/10">
                ログイン
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}