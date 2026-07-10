import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

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
