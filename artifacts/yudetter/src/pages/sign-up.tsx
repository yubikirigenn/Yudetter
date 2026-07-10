import { useState } from "react";
import { Link, useLocation } from "wouter";
import { signUp, signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield } from "lucide-react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !username.trim() || !displayName.trim() || !birthday.trim()) {
      toast({ title: "すべての項目を入力してください。", variant: "destructive" });
      return;
    }
    if (!agreeTerms) {
      toast({ title: "利用規約への同意が必要です。", variant: "destructive" });
      return;
    }

    const cleanUsername = username.trim(); // 大小文字をそのまま保持
    if (!/^[a-zA-Z0-9_]{1,20}$/.test(cleanUsername)) {
      toast({ title: "ユーザーIDは1〜20文字の半角英数字とアンダースコアのみ使用できます。", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // ユーザーIDの重複チェックを事前にAPIで行う
      const checkRes = await fetch(`/api/users/setup/check-username?username=${cleanUsername}`);
      const checkData = await checkRes.json();
      if (checkRes.ok && !checkData.available) {
        throw new Error(checkData.error || "このユーザーIDはすでに使われています。");
      }

      // Better Authでのサインアップ
      const res = await signUp.email({
        email: email.trim(),
        password: password,
        name: displayName.trim(), // Better Auth 標準フィールド
        username: cleanUsername, // カスタム追加フィールド
        displayName: displayName.trim(), // カスタム追加フィールド
        birthday: birthday, // カスタム追加フィールド
        setupComplete: true, // サインアップ時に全情報を揃えるので完了とする
      } as any);

      if (res?.error) {
        throw new Error(res.error.message || "アカウント作成に失敗しました。");
      }

      toast({ title: "アカウントを作成しました！ようこそYudetterへ。" });
      window.location.href = "/";
    } catch (err: any) {
      toast({
        title: "エラーが発生しました",
        description: err.message || "アカウント作成中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-[440px] bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm border border-border p-8 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-full overflow-hidden border border-border flex items-center justify-center mb-1">
            <img src="/logo.png" alt="Yudetter Logo" className="w-full h-full object-cover scale-[1.3]" />
          </div>
          <h1 className="text-2xl font-bold font-rounded">はじめよう！</h1>
          <p className="text-sm text-muted-foreground">Yudetterで新しいアカウントを作成</p>
        </div>

        {/* Googleで続ける */}
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center gap-2 rounded-xl border-2 font-medium"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading || isLoading || !agreeTerms}
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
          <span className="text-xs text-muted-foreground">またはメールで登録</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="displayName" className="text-sm font-medium">表示名</Label>
            <Input
              id="displayName"
              placeholder="ゆでたまご"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
              disabled={isLoading}
              className="rounded-xl"
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="username" className="text-sm font-medium">ユーザーID (@ID)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">@</span>
              <Input
                id="username"
                placeholder="yudetamago"
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, 20))}
                disabled={isLoading}
                className="pl-7 rounded-xl"
                required
              />
            </div>
            <span className="text-[10px] text-muted-foreground">3〜20文字、半角英数字とアンダースコア</span>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="birthday" className="text-sm font-medium">生年月日</Label>
            <Input
              id="birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              disabled={isLoading}
              className="rounded-xl"
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="email" className="text-sm font-medium">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="rounded-xl"
              required
            />
          </div>

          <div className="grid gap-1.5">
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

          {/* 利用規約同意チェックボックス */}
          <div className="flex items-start gap-2.5 px-1 py-1">
            <Checkbox
              id="terms"
              checked={agreeTerms}
              onCheckedChange={(checked) => setAgreeTerms(!!checked)}
              className="mt-1"
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="terms"
                className="text-xs text-muted-foreground font-medium leading-normal cursor-pointer select-none"
              >
                <Dialog>
                  <DialogTrigger asChild>
                    <button type="button" className="text-primary hover:underline font-bold inline-block mr-1">
                      利用規約
                    </button>
                  </DialogTrigger>
                  <span className="inline-block">に同意します。</span>
                  <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col p-6">
                    <DialogHeader className="flex flex-row items-center gap-2 border-b border-border/50 pb-3">
                      <Shield className="w-5 h-5 text-primary" />
                      <DialogTitle className="text-lg font-bold font-rounded">利用規約</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-2 py-4 text-xs text-muted-foreground leading-relaxed flex flex-col gap-4">
                      <p className="text-sm text-foreground/80 leading-relaxed font-bold">
                        Yudetterをご利用いただくにあたり、以下の規約に同意いただく必要があります。
                      </p>
                      
                      <Accordion type="single" collapsible className="w-full flex flex-col gap-3">
                        <AccordionItem value="item-1" className="border border-border/60 rounded-xl px-4 bg-card">
                          <AccordionTrigger className="font-rounded font-bold text-xs hover:no-underline">
                            第1章 総則
                          </AccordionTrigger>
                          <AccordionContent className="flex flex-col gap-2 pt-1 pb-3 text-[11px]">
                            <p><strong>第1条（適用）</strong>: 本規約は、会員と当サービスとの間の本サービスの利用に関わる一切の関係に適用されます。</p>
                            <p><strong>第2条（規約の変更）</strong>: 当サービスは、必要と判断した場合には、会員に通知することなくいつでも本規約を変更できます。変更後は本サービス上に表示された時点から効力を生じます。</p>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-2" className="border border-border/60 rounded-xl px-4 bg-card">
                          <AccordionTrigger className="font-rounded font-bold text-xs hover:no-underline">
                            第2章 アカウント登録
                          </AccordionTrigger>
                          <AccordionContent className="flex flex-col gap-2 pt-1 pb-3 text-[11px]">
                            <p><strong>第3条（利用登録）</strong>: 登録希望者が本規約に同意の上、指定の方法で申請し承認されることで完了します。</p>
                            <p><strong>第4条（ユーザーIDとパスワードの管理）</strong>: 会員は自己の責任において、認証情報を適切に管理するものとします。第三者への譲渡等は禁止します。</p>
                            <p><strong>第5条（利用制限および登録抹消）</strong>: 本規約違反や不正利用が認められた場合、事前通知なしにアカウントの抹消措置を行います。</p>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-3" className="border border-border/60 rounded-xl px-4 bg-card">
                          <AccordionTrigger className="font-rounded font-bold text-xs hover:no-underline">
                            第3章 YDとマーケット取引規約
                          </AccordionTrigger>
                          <AccordionContent className="flex flex-col gap-2 pt-1 pb-3 text-[11px]">
                            <p><strong>第6条（ユデドル (YD) の付与・削減）</strong>: 新規登録時にウェルカムボーナスとして 1,000 YD が付与されます。新規の親投稿作成時に 5 YD が付与され、親投稿を削除した場合はペナルティとして 5 YD が残高から減算されます。返信（リプライ）の作成・削除時は対象外です。</p>
                            <p><strong>第7条（マーケットでの出品と販売）</strong>: 画像、音声、ゲーム等を出品できます。画像や音声は1〜99個または無限の数量制限が可能です。ゲーム出品時は通常販売（固定価格）に固定され、数量は「無限」に自動指定されます。ユーザーIDの出品・移転も可能です。</p>
                            <p><strong>第8条（スーパーユデート）</strong>: 親投稿の返信送信時に 1 YD 〜 100,000 YD を設定して送付でき、金額の高い順に最上部固定で優先表示されます。自分や孫リプライには付与できません。</p>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-4" className="border border-border/60 rounded-xl px-4 bg-card">
                          <AccordionTrigger className="font-rounded font-bold text-xs hover:no-underline">
                            第4章 禁止事項
                          </AccordionTrigger>
                          <AccordionContent className="flex flex-col gap-2 pt-1 pb-3 text-[11px]">
                            <p><strong>第9条（禁止行為）</strong>: 法令・公序良俗違反、他の会員への嫌がらせ、知的財産権侵害、なりすまし、サーバー攻撃、マネーロンダリング等は固く禁止します。また、当サービスの許可なくスクレイピング等の自動化ツールを用いて他の会員のデータ（テキスト、画像、音声、ゲーム等）を収集する行為を禁止します。</p>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-5" className="border border-border/60 rounded-xl px-4 bg-card">
                          <AccordionTrigger className="font-rounded font-bold text-xs hover:no-underline">
                            第5章 BotおよびAI of 利用
                          </AccordionTrigger>
                          <AccordionContent className="flex flex-col gap-2 pt-1 pb-3 text-[11px]">
                            <p><strong>第10条（ユーザー投稿のAI学習に対する方針）</strong>: 当サービスは、会員が投稿したテキスト、画像、音声、作成されたゲーム等のコンテンツについて、当サービスによる人工知能（AI）等の生成・学習用データとして使用しないことを保証します。</p>
                            <p><strong>第11条（Botのアカウント利用ルール）</strong>: Bot等の自動化プログラムを用いた自動投稿アカウント等の作成・運用は許可されますが、自己紹介文等にBotである旨を明記し、サーバーへ過度な負荷をかけるアクセスやAPI要求を行わない必要があります。</p>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-6" className="border border-border/60 rounded-xl px-4 bg-card">
                          <AccordionTrigger className="font-rounded font-bold text-xs hover:no-underline">
                            第6章 免責事項・雑則
                          </AccordionTrigger>
                          <AccordionContent className="flex flex-col gap-2 pt-1 pb-3 text-[11px]">
                            <p><strong>第12条（免責事項）</strong>: 当サービスは、本サービスにバグや不具合がないことを保証せず、利用に伴ういかなる損害も故意・重過失を除き免責されます。</p>
                            <p><strong>第13条（準拠法・裁判管轄）</strong>: 日本法を準拠法とし、東京地方裁判所を専属的合意管轄とします。</p>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                      
                      <div className="flex justify-end gap-2 border-t border-border/50 pt-3 mt-2">
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center font-bold px-3 py-2"
                        >
                          別ウィンドウで全文を表示する
                        </a>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl py-2.5 mt-2"
            disabled={isLoading || !agreeTerms}
          >
            {isLoading ? (
              <span className="flex items-center gap-2 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> アカウント作成中...
              </span>
            ) : (
              "アカウント作成"
            )}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          すでにアカウントをお持ちですか？{" "}
          <Link href="/sign-in" className="text-primary hover:underline font-medium">
            サインイン
          </Link>
        </div>
      </div>
    </div>
  );
}
