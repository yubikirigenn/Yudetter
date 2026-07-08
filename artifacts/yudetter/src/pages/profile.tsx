import { useRoute } from "wouter";
import { useState, useEffect } from "react";
import {
  useGetUserProfile,
  useGetUserYudates,
  useGetUserLikes,
  useFollowUser,
  useUnfollowUser,
  useGetMe,
  useUpdateMe,
  getGetUserProfileQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { CalendarDays, Loader2, Camera } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import YudateCard from "@/components/yudate-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function EditProfileDialog({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: { displayName: string; bio?: string | null; avatarUrl?: string | null };
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const updateMutation = useUpdateMe();

  // Reset form when dialog opens or profile changes
  useEffect(() => {
    if (open) {
      setDisplayName(profile.displayName);
      setBio(profile.bio ?? "");
    }
  }, [open, profile.displayName, profile.bio]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSave = () => {
    if (!displayName.trim()) return;
    updateMutation.mutate(
      { data: { displayName: displayName.trim(), bio: bio.trim() || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          // Invalidate all profile queries since we don't know the username at this point
          queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith?.('/api/users') });
          toast({ title: "プロフィールを更新しました" });
          onClose();
        },
        onError: () => {
          toast({ title: "更新に失敗しました", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>プロフィールを編集</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 mt-2">
          {/* Avatar preview (read-only; URL change not supported yet) */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="w-20 h-20 border-4 border-background ring-2 ring-border">
                <AvatarImage src={profile.avatarUrl || ''} />
                <AvatarFallback className="text-2xl bg-primary/20 text-primary font-bold">
                  {profile.displayName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-not-allowed">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          {/* Display name */}
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-sm">
              表示名 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
              className="w-full border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background transition-colors"
              placeholder="表示名"
            />
            <span className="text-xs text-muted-foreground text-right">{displayName.length}/50</span>
          </div>

          {/* Bio */}
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-sm">自己紹介</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              rows={3}
              className="w-full border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background transition-colors resize-none"
              placeholder="自己紹介（任意）"
            />
            <span className="text-xs text-muted-foreground text-right">{bio.length}/160</span>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
              キャンセル
            </Button>
            <Button
              onClick={handleSave}
              disabled={!displayName.trim() || updateMutation.isPending}
              className="rounded-full font-bold px-6"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilePage() {
  const [, params] = useRoute("/profile/:username");
  const username = params?.username;
  const { data: me } = useGetMe();
  const isMe = me?.username === username;

  const [activeTab, setActiveTab] = useState<'yudates' | 'likes'>('yudates');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: profile, isLoading: isProfileLoading } = useGetUserProfile(
    username!,
    { query: { enabled: !!username, queryKey: getGetUserProfileQueryKey(username!) } }
  );

  const { data: yudates, isLoading: isYudatesLoading } = useGetUserYudates(
    username!,
    { query: { enabled: !!username && activeTab === 'yudates', queryKey: ['/api/users', username, 'yudates'] } }
  );

  const { data: likes, isLoading: isLikesLoading } = useGetUserLikes(
    username!,
    { query: { enabled: !!username && activeTab === 'likes', queryKey: ['/api/users', username, 'likes'] } }
  );

  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  const handleFollowToggle = () => {
    if (!profile) return;
    if (profile.isFollowing) {
      unfollowMutation.mutate({ username: profile.username }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(profile.username) })
      });
    } else {
      followMutation.mutate({ username: profile.username }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(profile.username) })
      });
    }
  };

  if (isProfileLoading) {
    return <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (!profile) {
    return <div className="p-8 text-center text-muted-foreground font-bold">プロフィールが見つかりません</div>;
  }

  // Show exact date: yyyy年M月d日
  const joinDate = format(new Date(profile.createdAt), "yyyy年M月d日", { locale: ja });

  return (
    <div className="w-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex flex-col justify-center px-4 h-[53px]">
          <h1 className="font-bold text-xl leading-tight truncate">{profile.displayName}</h1>
          <div className="text-[13px] text-muted-foreground leading-tight">{profile.yudateCount} ユデート</div>
        </div>
      </div>

      {/* Cover */}
      <div className="h-32 sm:h-48 bg-primary/20 w-full relative">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(145 60% 55% / 0.5) 1px, transparent 0)', backgroundSize: '16px 16px' }} />
      </div>

      <div className="px-4 pb-4">
        {/* Avatar & Edit/Follow button */}
        <div className="flex justify-between items-start mb-4 relative h-16">
          <div className="absolute -top-16">
            <Avatar className="w-32 h-32 border-4 border-background bg-background">
              <AvatarImage src={profile.avatarUrl || ''} />
              <AvatarFallback className="text-4xl bg-primary/20 text-primary font-bold">{profile.displayName[0]}</AvatarFallback>
            </Avatar>
          </div>
          <div className="ml-auto mt-3">
            {isMe ? (
              <Button
                variant="outline"
                className="rounded-full font-bold"
                onClick={() => setShowEditDialog(true)}
              >
                プロフィールを編集
              </Button>
            ) : (
              <Button
                variant={profile.isFollowing ? "outline" : "default"}
                className="rounded-full font-bold px-6"
                onClick={handleFollowToggle}
                disabled={followMutation.isPending || unfollowMutation.isPending}
              >
                {profile.isFollowing ? "フォロー中" : "フォロー"}
              </Button>
            )}
          </div>
        </div>

        {/* User info */}
        <div className="mb-4">
          <h2 className="font-bold text-xl">{profile.displayName}</h2>
          <div className="text-[15px] text-muted-foreground">@{profile.username}</div>
        </div>

        {profile.bio && (
          <div className="text-[15px] mb-3 whitespace-pre-wrap">{profile.bio}</div>
        )}

        <div className="flex items-center gap-1 text-muted-foreground text-[15px] mb-4">
          <CalendarDays className="w-4 h-4" />
          <span>{joinDate}から利用しています</span>
        </div>

        <div className="flex gap-4 text-[15px]">
          <div className="hover:underline cursor-pointer">
            <span className="font-bold text-foreground">{profile.followingCount}</span>{" "}
            <span className="text-muted-foreground">フォロー中</span>
          </div>
          <div className="hover:underline cursor-pointer">
            <span className="font-bold text-foreground">{profile.followerCount}</span>{" "}
            <span className="text-muted-foreground">フォロワー</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        {(['yudates', 'likes'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 font-bold text-center p-4 hover:bg-secondary transition-colors relative"
          >
            <span className={activeTab === tab ? 'text-foreground' : 'text-muted-foreground'}>
              {tab === 'yudates' ? 'ユデート' : 'いいね'}
            </span>
            {activeTab === tab && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="flex flex-col">
        {activeTab === 'yudates' ? (
          isYudatesLoading ? (
            <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : yudates?.items.length ? (
            yudates.items.map((yudate) => <YudateCard key={yudate.id} yudate={yudate} />)
          ) : (
            <div className="p-8 text-center text-muted-foreground font-bold">まだユデートしていません</div>
          )
        ) : (
          isLikesLoading ? (
            <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : likes?.items.length ? (
            likes.items.map((yudate) => <YudateCard key={yudate.id} yudate={yudate} />)
          ) : (
            <div className="p-8 text-center text-muted-foreground font-bold">まだいいねしていません</div>
          )
        )}
      </div>

      {/* Edit profile dialog */}
      {isMe && (
        <EditProfileDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          profile={profile}
        />
      )}
    </div>
  );
}
