import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="w-24 h-24 rounded-full overflow-hidden border border-border flex items-center justify-center mb-8 opacity-50 grayscale bg-background">
        <img src="/logo.png" alt="Logo" className="w-full h-full object-cover scale-[1.3]" />
      </div>
      <h1 className="text-4xl font-rounded font-bold mb-4">404</h1>
      <p className="text-xl text-muted-foreground mb-8">お探しのページは存在しません。</p>
      <Link href="/">
        <Button className="rounded-full px-8 font-bold">ホームに戻る</Button>
      </Link>
    </div>
  );
}