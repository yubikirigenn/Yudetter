import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, XCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function checkUsername(username: string): Promise<{ available: boolean; error: string | null }> {
  const res = await fetch(`${BASE}/api/users/setup/check-username?username=${encodeURIComponent(username)}`);
  return res.json();
}

async function setupProfile(data: {
  username: string;
  displayName: string;
  birthday: string;
}) {
  const res = await fetch(`${BASE}/api/users/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "エラーが発生しました");
  }
  return res.json();
}

export default function SetupPage() {
  const { data: session, isPending } = useSession();
  const user = session?.user;
  const isLoaded = !isPending;
  const [, setLocation] = useLocation();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Pre-fill display name from Better Auth
  useEffect(() => {
    if (isLoaded && user) {
      if (user.name) setDisplayName(user.name);
    }
  }, [isLoaded, user]);

  // Debounced username check
  const validateUsernameFormat = (val: string) => /^[a-zA-Z0-9_]+$/.test(val);

  useEffect(() => {
    if (!username) { setUsernameStatus("idle"); setUsernameError(null); return; }
    if (!validateUsernameFormat(username)) {
      setUsernameStatus("invalid");
      setUsernameError("半角英数字とアンダースコア（_）のみ使用できます");
      return;
    }
    setUsernameStatus("checking");
    setUsernameError(null);
    const timer = setTimeout(async () => {
      const result = await checkUsername(username);
      if (result.available) {
        setUsernameStatus("available");
        setUsernameError(null);
      } else {
        setUsernameStatus("taken");
        setUsernameError(result.error ?? "このIDはすでに使われています");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  // Max birthday: must be at least 13 years old
  const maxBirthday = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().split("T")[0];
  })();

  const canSubmit =
    username.length >= 1 &&
    usernameStatus === "available" &&
    displayName.trim().length >= 1 &&
    birthday.length === 10 &&
    agreeTerms &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await setupProfile({ username, displayName: displayName.trim(), birthday });
      setLocation("/");
      window.location.reload();
    } catch (err: any) {
      setSubmitError(err.message ?? "エラーが発生しました");
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-full overflow-hidden border border-border flex items-center justify-center shadow-sm bg-background">
            <img src={`${BASE}/logo.png`} alt="Yudetter" className="w-full h-full object-cover scale-[1.3]" />
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          <h1 className="text-2xl font-bold font-rounded mb-1">プロフィールを設定しよう</h1>
          <p className="text-muted-foreground text-sm mb-8">あなたのアカウントをカスタマイズします</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-sm">
                ユーザーID <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-1">
                半角英字・数字・アンダースコア（_）のみ。後から変更できます。
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 30))}
                  placeholder="yudeko_chan"
                  className="w-full border border-border rounded-xl pl-8 pr-10 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background transition-colors"
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === "checking" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  {usernameStatus === "available" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  {(usernameStatus === "taken" || usernameStatus === "invalid") && <XCircle className="w-4 h-4 text-destructive" />}
                </div>
              </div>
              {usernameError && (
                <p className="text-xs text-destructive mt-0.5">{usernameError}</p>
              )}
              {usernameStatus === "available" && (
                <p className="text-xs text-primary mt-0.5">✓ 使用できます</p>
              )}
            </div>

            {/* Display Name */}
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-sm">
                表示名 <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
                placeholder="ゆで子"
                className="w-full border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background transition-colors"
              />
              <p className="text-xs text-muted-foreground">{displayName.length}/50</p>
            </div>

            {/* Birthday */}
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-sm">
                生年月日 <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-1">
                公開されません。年齢確認のためのみ使用します。
              </p>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                max={maxBirthday}
                min="1900-01-01"
                className="w-full border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background transition-colors"
              />
            </div>

            {submitError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">
                {submitError}
              </div>
            )}

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
                              <p><strong>第9条（禁止行為）</strong>: 法令・公序良俗違反、他の会員への嫌がらせ、知的財産権侵害、なりすまし、サーバー攻撃、マネーロンダリング等は固く禁止します。</p>
                            </AccordionContent>
                          </AccordionItem>

                          <AccordionItem value="item-5" className="border border-border/60 rounded-xl px-4 bg-card">
                            <AccordionTrigger className="font-rounded font-bold text-xs hover:no-underline">
                              第5章 免責事項・雑則
                            </AccordionTrigger>
                            <AccordionContent className="flex flex-col gap-2 pt-1 pb-3 text-[11px]">
                              <p><strong>第10条（免責事項）</strong>: 当サービスは、本サービスにバグや不具合がないことを保証せず、利用に伴ういかなる損害も故意・重過失を除き免責されます。</p>
                              <p><strong>第11条（準拠法・裁判管轄）</strong>: 日本法を準拠法とし、東京地方裁判所を専属的合意管轄とします。</p>
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
              disabled={!canSubmit}
              className="w-full h-12 rounded-full font-bold font-rounded text-base mt-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "はじめる"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
