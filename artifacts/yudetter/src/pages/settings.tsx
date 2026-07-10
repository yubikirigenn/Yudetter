import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { useGetMe as useGetUserMe, useUpdateMe as useUpdateUserMe } from "@workspace/api-client-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Image as ImageIcon, Lock, ShieldAlert, UserX } from "lucide-react";
import { useLocation } from "wouter";
import ImageCropper from "@/components/image-cropper";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: isLoadingMe } = useGetUserMe();
  const updateMeMutation = useUpdateUserMe();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [headerUrl, setHeaderUrl] = useState("");

  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropType, setCropType] = useState<"avatar" | "header" | null>(null);
  const { toast } = useToast();
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  // ブロックリスト取得
  const { data: blocksData, isLoading: isLoadingBlocks } = useQuery({
    queryKey: ["/api/users/me/blocks"],
    queryFn: async () => {
      const res = await fetch("/api/users/me/blocks");
      if (!res.ok) throw new Error("Failed to fetch blocks");
      return res.json();
    }
  });

  const unblockMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await fetch(`/api/users/${username}/block`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to unblock");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/blocks"] });
    }
  });

  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName);
      setBio(me.bio || "");
      setIsPrivate(me.isPrivate || false);
      setAvatarUrl(me.avatarUrl || "");
      setHeaderUrl(me.headerUrl || "");
    }
  }, [me]);

  const handleSaveProfile = () => {
    updateMeMutation.mutate({ data: {
      displayName,
      bio,
      // @ts-ignore
      isPrivate,
      avatarUrl,
      headerUrl
    } }, {
      onSuccess: () => {
        toast({ title: "設定を保存しました" });
        queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      },
      onError: (e: any) => {
        toast({ title: e?.response?.data?.error || "設定の保存に失敗しました", variant: "destructive" });
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "header") => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener("load", () => setCropImageSrc(reader.result?.toString() || ""));
      reader.readAsDataURL(e.target.files[0]);
      setCropType(type);
      e.target.value = "";
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropImageSrc(null);
    const formData = new FormData();
    formData.append("file", croppedBlob, "image.jpg");
    
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json();
        if (cropType === "avatar") setAvatarUrl(url);
        if (cropType === "header") setHeaderUrl(url);
      }
    } catch (e) {
      console.error("Upload failed", e);
    }
    setCropType(null);
  };

  if (isLoadingMe) {
    return <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="w-full pb-20">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center gap-6">
        <button onClick={() => window.history.back()} className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">設定</h1>
          <p className="text-sm text-muted-foreground">@{me?.username}</p>
        </div>
      </div>

      <div className="p-4 space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-bold">プロフィール設定</h2>
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground block">ヘッダー画像</label>
            <div 
              className="w-full h-32 md:h-48 bg-secondary rounded-xl overflow-hidden relative cursor-pointer group flex items-center justify-center"
              onClick={() => headerInputRef.current?.click()}
            >
              {headerUrl ? (
                <img src={headerUrl} alt="Header" className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold">変更する</span>
              </div>
            </div>
            <input type="file" ref={headerInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, "header")} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground block">アイコン画像</label>
            <div className="relative w-fit cursor-pointer group" onClick={() => avatarInputRef.current?.click()}>
              <Avatar className="w-24 h-24 border-4 border-background group-hover:opacity-75 transition-opacity">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">{displayName[0]}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                <span className="text-white text-xs font-bold">変更</span>
              </div>
            </div>
            <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, "avatar")} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground block">表示名</label>
            <input 
              type="text" 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)} 
              className="w-full bg-secondary p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground block">自己紹介</label>
            <textarea 
              value={bio} 
              onChange={e => setBio(e.target.value)} 
              className="w-full bg-secondary p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><Lock className="w-5 h-5" /> プライバシー設定</h2>
          <div className="flex items-center justify-between bg-secondary p-4 rounded-xl">
            <div>
              <div className="font-bold">鍵アカウント</div>
              <div className="text-sm text-muted-foreground">フォロワーのみがあなたのユデートを見ることができます</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </section>

        <Button onClick={handleSaveProfile} disabled={updateMeMutation.isPending} className="w-full rounded-full h-12 font-bold text-lg">
          {updateMeMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "変更を保存"}
        </Button>

        <section className="space-y-4 pt-8 border-t border-border/50">
          <h2 className="text-lg font-bold flex items-center gap-2 text-destructive"><ShieldAlert className="w-5 h-5" /> ブロック中のユーザー</h2>
          {isLoadingBlocks ? (
            <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : blocksData?.items?.length > 0 ? (
            <div className="space-y-2">
              {blocksData.items.map((user: any) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user.avatarUrl || ''} />
                      <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{user.displayName}</span>
                      <span className="text-xs text-muted-foreground">@{user.username}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => unblockMutation.mutate(user.username)} disabled={unblockMutation.isPending}>
                    ブロック解除
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-4 text-muted-foreground text-sm">ブロックしているユーザーはいません</div>
          )}
        </section>
      </div>

      {cropImageSrc && cropType && (
        <ImageCropper
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropImageSrc(null)}
          aspectRatio={cropType === "avatar" ? 1 : 3}
        />
      )}
    </div>
  );
}
