import { useState } from "react";
import { Link, useLocation } from "wouter";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AtSign, Mail } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function resolveEmail(input: string): Promise<string> {
  // @マークなし → ユーザーID扱いでメールを検索
  const trimmed = input.trim();
  if (!trimmed.includes("@")) {
    const res = await fetch(`${BASE}/api/users/lookup-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: trimmed }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "ユーザーIDが見つかりません");
    }
    const data = await res.json();
    return data.email;
  }
  return trimmed;
}

export default function SignInPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const isUsername = loginId.trim() !== "" && !loginId.includes("@");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password.trim()) {
      toast({ title: "すべての項目を入力してください。", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const email = await resolveEmail(loginId);
      const res = await signIn.email({ email, password });

      if (res?.error) {
        throw new Error(res.error.message || "サインインに失敗しました。");
      }

      toast({ title: "サインインしました！おかえりなさい。" });
      window.location.href = "/";
    } catch (err: any) {
      toast({
        title: "エラーが発生しました",
        description: err.message || "メールアドレス・ユーザーIDまたはパスワードが正しくありません。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/`,
      });
    } catch (err: any) {
      toast({
        title: "Googleサインインに失敗しました",
        description: err.message,
        variant: "destructive",
      });
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-[440px] bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm border border-border p-8 flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-full overflow-hidden border border-border flex items-center justify-center mb-1">
            <img src="/logo.png" alt="Yudetter Logo" className="w-full h-full object-cover scale-[1.3]" />
          </div>
          <h1 className="text-2xl font-bold font-rounded">おかえり！</h1>
          <p className="text-sm text-muted-foreground">Yudetterにサインインしよう</p>
        </div>

        {/* Googleサインインボタン */}
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center gap-2 rounded-xl border-2 font-medium"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading || isLoading}
        >
          {isGoogleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Googleで続ける
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">または</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="loginId" className="text-sm font-medium">
              メールアドレスまたはユーザーID
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {isUsername ? (
                  <AtSign className="w-4 h-4" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
              </span>
              <Input
                id="loginId"
                type="text"
                placeholder="name@example.com または yudeID"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                disabled={isLoading}
                className="rounded-xl pl-9"
                autoComplete="username email"
                required
              />
            </div>
            {isUsername && (
              <p className="text-[11px] text-primary">ユーザーIDとして検索します</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password" className="text-sm font-medium">パスワード</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="rounded-xl"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl py-2.5"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> サインイン中...
              </span>
            ) : (
              "サインイン"
            )}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          アカウントをお持ちでないですか？{" "}
          <Link href="/sign-up" className="text-primary hover:underline font-medium">
            登録する
          </Link>
        </div>
      </div>
    </div>
  );
}
