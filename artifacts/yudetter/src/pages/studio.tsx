import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetGames,
  useCreateGame,
  useUpdateGame,
  useGetMe,
} from "@workspace/api-client-react";
import {
  Loader2,
  Gamepad2,
  Plus,
  Terminal,
  FileCode,
  CheckCircle,
  ShieldAlert,
  ArrowLeft,
  ChevronRight,
  Save,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

const SDK_CODE_TEMPLATE = `function requestYdPayment(amount, description) {
  return new Promise((resolve, reject) => {
    // 親ウィンドウへ決済リクエストを送信
    window.parent.postMessage({ type: 'YGS_PAYMENT_REQUEST', amount, description }, '*');
    
    // 親からの結果受信リスナー
    const handler = (e) => {
      if (e.data && e.data.type === 'YGS_PAYMENT_RESPONSE') {
        window.removeEventListener('message', handler);
        if (e.data.success) {
          resolve(e.data.transactionId); // 決済成功時のトランザクションID
        } else {
          reject(new Error(e.data.error || '決済失敗'));
        }
      }
    };
    window.addEventListener('message', handler);
  });
}`;

export default function StudioPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me } = useGetMe();
  const { data: games = [], isLoading: isGamesLoading, refetch: refetchGames } = useGetGames({});
  
  const createMutation = useCreateGame();
  const updateMutation = useUpdateGame();

  // 現在編集中のプロジェクト情報
  // null の場合は未選択、"new" の場合は新規作成、それ以外は game.id (number)
  const [selectedProjectId, setSelectedProjectId] = useState<number | "new" | null>(null);

  // フォームステート
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [playPrice, setPlayPrice] = useState("0");
  const [isSaving, setIsSaving] = useState(false);

  // 自分が作成したゲーム一覧
  const myProjects = games.filter((g) => g.creator?.id === me?.id);

  // 新規プロジェクト作成の準備
  const handleNewProject = () => {
    setSelectedProjectId("new");
    setTitle("");
    setDescription("");
    setHtmlContent("");
    setPlayPrice("0");
  };

  // 既存プロジェクトの選択ロード
  const handleSelectProject = (project: any) => {
    setSelectedProjectId(project.id);
    setTitle(project.title);
    setDescription(project.description || "");
    setHtmlContent(project.htmlContent || ""); // htmlContentが含まれていない場合は再フェッチ
    setPlayPrice(String(project.playPrice));

    // もし詳細情報（htmlContentなど）が不足している場合は、個別にロードする
    fetchGameDetail(project.id);
  };

  // ゲーム詳細のフェッチ（コードの取得）
  const fetchGameDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/games/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.htmlContent) {
          setHtmlContent(data.htmlContent);
        }
      }
    } catch (e) {
      console.error("Failed to load project code", e);
    }
  };

  // ファイルインポート処理
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".html")) {
      toast({ variant: "destructive", title: "エラー", description: "HTMLファイル (.html) のみインポート可能です" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setHtmlContent(text);
      toast({ title: "インポート完了", description: "HTMLファイルをエディタに読み込みました！" });
    };
    reader.onerror = () => {
      toast({ variant: "destructive", title: "エラー", description: "ファイルの読み込みに失敗しました" });
    };
    reader.readAsText(file);
  };

  // 保存（作成・更新）処理
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || selectedProjectId === null) return;

    if (!title.trim()) {
      toast({ variant: "destructive", title: "エラー", description: "タイトルを入力してください" });
      return;
    }

    if (!htmlContent.trim()) {
      toast({ variant: "destructive", title: "エラー", description: "ゲームのコードを入力またはインポートしてください" });
      return;
    }

    const priceNum = parseInt(playPrice, 10) || 0;
    if (priceNum < 0 || priceNum > 999999999) {
      toast({ variant: "destructive", title: "エラー", description: "プレイ料金が不正です" });
      return;
    }

    // ゲーム内課金SDK用のテンプレート挿入チェック
    if (!htmlContent.includes("postMessage") && !htmlContent.includes("YGS_PAYMENT_REQUEST")) {
      toast({
        variant: "default",
        title: "ヒント",
        description: "ゲーム内YD決済の実装には、YGS決済のpostMessage仕様を組み込んでください。",
      });
    }

    setIsSaving(true);
    try {
      if (selectedProjectId === "new") {
        // 新規作成
        const created = await createMutation.mutateAsync({
          data: {
            title: title.trim(),
            description: description.trim() || undefined,
            htmlContent: htmlContent.trim(),
            playPrice: priceNum,
          },
        });
        toast({ title: "作成成功", description: "新規ゲームプロジェクトを公開しました！" });
        setSelectedProjectId(created.id);
      } else {
        // 既存の編集・更新
        await updateMutation.mutateAsync({
          id: selectedProjectId,
          data: {
            title: title.trim(),
            description: description.trim() || undefined,
            htmlContent: htmlContent.trim(),
            playPrice: priceNum,
          },
        });
        toast({ title: "更新成功", description: "ゲームプロジェクトを更新（再公開）しました！" });
      }
      refetchGames();
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "エラー", description: e.response?.data?.error || "保存に失敗しました" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-background">
      {/* 左カラム：プロジェクトリスト */}
      <div className="w-full md:w-80 border-r border-border/40 flex flex-col shrink-0 bg-card/10 h-full">
        {/* スタジオヘッダー */}
        <div className="p-4 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (window.opener || window.history.length === 1) {
                  window.close();
                } else {
                  setLocation("/games");
                }
              }}
              className="rounded-full w-8 h-8"
              title="閉じる"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Terminal className="w-5 h-5 text-primary animate-pulse shrink-0" />
            <h1 className="text-base font-black font-rounded truncate">YGS Studio</h1>
          </div>
          <span className="text-[10px] text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full font-bold shrink-0">ALPHA</span>
        </div>

        {/* 新規プロジェクト作成エリア */}
        <div className="p-4 border-b border-border/20">
          <Button
            onClick={handleNewProject}
            className="w-full rounded-xl gap-2 font-bold shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            <Plus className="w-4 h-4" />
            新規プロジェクト
          </Button>
        </div>

        {/* プロジェクトリストエリア */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          <h3 className="text-xs font-bold text-muted-foreground px-2 py-1">マイプロジェクト ({myProjects.length})</h3>

          {isGamesLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : myProjects.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl m-2">
              プロジェクトはありません。上のボタンから作成してください。
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {myProjects.map((p) => {
                const isSelected = selectedProjectId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProject(p)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? "bg-primary/10 border-primary text-foreground shadow-sm"
                        : "border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Gamepad2 className={`w-4 h-4 shrink-0 ${isSelected ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                      <span className="text-xs font-bold truncate max-w-[170px]">{p.title}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 右カラム：エディタフォーム */}
      <div className="flex-1 flex flex-col h-full bg-zinc-950/20 overflow-y-auto">
        {selectedProjectId === null ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Terminal className="w-16 h-16 text-muted-foreground/20 mb-3 animate-pulse" />
            <h2 className="text-lg font-bold font-rounded text-muted-foreground">プロジェクトを選択してください</h2>
            <p className="text-xs text-muted-foreground/60 max-w-sm mt-1">
              左側のリストから既存のプロジェクトを選択するか、新規プロジェクトを作成してゲーム開発を開始します。
            </p>
          </div>
        ) : (
          <form onSubmit={handleSaveProject} className="p-6 flex flex-col gap-5 max-w-5xl w-full mx-auto">
            {/* エディタヘッダー */}
            <div className="flex items-center justify-between border-b border-border/20 pb-4">
              <div className="flex flex-col">
                <span className="text-[10px] text-primary font-bold uppercase tracking-widest font-mono">
                  {selectedProjectId === "new" ? "New Project" : `Project ID: #${selectedProjectId}`}
                </span>
                <h2 className="text-lg font-bold font-rounded">
                  {selectedProjectId === "new" ? "新規プロジェクト作成" : "プロジェクトエディタ"}
                </h2>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSaving || !title.trim() || !htmlContent.trim()}
                  className="rounded-xl gap-2 font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {selectedProjectId === "new" ? "ゲームを公開する" : "変更を保存（再公開）"}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* 基本設定 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">ゲームのタイトル</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: ブロック崩し、インベーダー"
                  maxLength={40}
                  className="rounded-xl border-border/60 bg-background/50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">1プレイの料金 (YD)</label>
                <Input
                  type="number"
                  value={playPrice}
                  onChange={(e) => setPlayPrice(e.target.value)}
                  placeholder="0: 無料プレイ"
                  min={0}
                  className="rounded-xl border-border/60 bg-background/50"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">説明文</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ゲームの遊び方、操作方法、内容について記入してください"
                rows={2}
                className="rounded-xl border-border/60 bg-background/50 resize-none text-xs"
              />
            </div>

            {/* HTMLインポートとエディタ */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-emerald-500" />
                  ゲームコード (HTML / CSS / JavaScript)
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 px-3 py-1.5 rounded-full cursor-pointer transition-colors border border-emerald-500/20">
                  <FileCode className="w-3.5 h-3.5" />
                  HTMLをインポート
                  <input
                    type="file"
                    accept=".html"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                </label>
              </div>

              {/* 高機能コードエディタ */}
              <div className="relative border border-border/30 rounded-2xl overflow-hidden shadow-inner bg-zinc-950">
                <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 border-b border-border/10 text-[10px] font-mono text-muted-foreground">
                  <span>index.html</span>
                  <span className="text-emerald-500">HTML5 / JS Mode</span>
                </div>
                <Textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  placeholder={`ここにゲームのHTMLコードを直接記述するか、ファイルをインポートしてください。`}
                  className="font-mono text-xs leading-relaxed bg-zinc-950 text-emerald-400 p-5 border-none min-h-[350px] placeholder:text-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none resize-y rounded-b-2xl"
                  required
                />
              </div>
            </div>

            {/* ゲーム内決済実装のSDK案内 */}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex flex-col gap-2.5">
              <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                YGS 課金決済SDK (postMessage API) の仕様
              </span>
              <p className="text-xs text-blue-800/80 leading-relaxed">
                作成するゲーム内でユーザーに課金決済（追加アイテム、スキン、ガチャなど）を促したい場合は、以下のJSコードをゲーム内に組み込むことで、YudetterのYDウォレットから決済を実行できます。
              </p>
              <pre className="font-mono text-[9px] bg-zinc-950 text-blue-300 p-4 rounded-xl overflow-x-auto leading-relaxed border border-blue-500/10">
                {SDK_CODE_TEMPLATE}
              </pre>
            </div>
          </form>
        )}
      </div>
      <Toaster />
    </div>
  );
}
