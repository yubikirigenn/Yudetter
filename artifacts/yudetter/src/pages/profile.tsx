import { useRoute, useLocation } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  useGetUserProfile,
  useGetUserYudates,
  useGetUserLikes,
  useFollowUser,
  useUnfollowUser,
  useGetMe,
  useUpdateMe,
  useGetYudate,
  useGetFollowers,
  useGetFollowing,
  getGetUserProfileQueryKey,
  getGetMeQueryKey,
  getGetFollowersQueryKey,
  getGetFollowingQueryKey,
  getGetYudateQueryKey,
} from "@workspace/api-client-react";
import { CalendarDays, Loader2, Lock, MoreHorizontal, Share2, Ban, Crown, Trophy, Medal } from "lucide-react";
import { Link } from "wouter";
import imageCompression from "browser-image-compression";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import YudateCard from "@/components/yudate-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import ImageCropDialog from "@/components/image-crop-dialog";
import { Pin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const VerifiedBadge = ({ isVerified, className }: { isVerified?: boolean; className?: string }) => {
  if (!isVerified) return null;

  return (
    <Tooltip>
      <TooltipTrigger className="cursor-pointer inline-flex items-center" asChild>
        <img
          src="/verified.png"
          alt="公式マーク"
          className={`shrink-0 select-none align-middle aspect-square object-contain ${className || "w-[1.3em] h-[1.3em]"}`}
          draggable={false}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px] rounded-xl font-bold p-2 bg-popover text-popover-foreground border border-border shadow-md select-none">
        認証済みアカウント
      </TooltipContent>
    </Tooltip>
  );
};

const UserBadge = ({ badgeType }: { badgeType: string | null | undefined }) => {
  if (!badgeType) return null;

  const getBadgeElement = () => {
    if (badgeType === "gold") {
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-yellow-600 border border-yellow-300 shadow-sm shrink-0 select-none align-middle ml-1">
          <Crown className="w-3 h-3 text-white fill-white" />
        </span>
      );
    }
    if (badgeType === "silver") {
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-500 border border-zinc-200 shadow-sm shrink-0 select-none align-middle ml-1">
          <Trophy className="w-2.5 h-2.5 text-white fill-white" />
        </span>
      );
    }
    if (badgeType === "bronze") {
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 border border-amber-500 shadow-sm shrink-0 select-none align-middle ml-1">
          <Medal className="w-2.5 h-2.5 text-white fill-white" />
        </span>
      );
    }
    return null;
  };

  const getTooltipText = () => {
    if (badgeType === "gold") return "👑 総合フォロワー数 第1位 (ゴールドバッジ)";
    if (badgeType === "silver") return "🥈 総合フォロワー数 第2位 (シルバーバッジ)";
    if (badgeType === "bronze") return "🥉 総合フォロワー数 第3位 (ブロンズバッジ)";
    return "";
  };

  return (
    <Tooltip>
      <TooltipTrigger className="cursor-pointer inline-flex items-center" asChild>
        <span>{getBadgeElement()}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px] rounded-xl font-bold p-2 bg-popover text-popover-foreground border border-border shadow-md select-none">
        {getTooltipText()}
      </TooltipContent>
    </Tooltip>
  );
};

function UserListDialog({
  open,
  onClose,
  title,
  username,
  type,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  username: string;
  type: 'followers' | 'following';
}) {
  const { data: users, isLoading } = type === 'followers'
    ? useGetFollowers(username, { query: { enabled: open, queryKey: getGetFollowersQueryKey(username) } })
    : useGetFollowing(username, { query: { enabled: open, queryKey: getGetFollowingQueryKey(username) } });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate: follow } = useFollowUser();
  const { mutate: unfollow } = useUnfollowUser();
  const { data: me } = useGetMe();

  const handleFollowToggle = (user: any) => {
    if (user.id === me?.id) return;
    const mutation = user.isFollowing ? unfollow : follow;
    mutation(
      { username: user.username },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(user.username) });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          // リストを再取得してボタンの状態を更新
          queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith?.(`/api/users/${username}`) });
        },
        onError: (err: any) => {
          toast({ title: err?.response?.data?.error || "操作に失敗しました", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[425px] h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {isLoading ? (
            <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : !users?.items?.length ? (
            <div className="text-center text-muted-foreground p-8">ユーザーがいません</div>
          ) : (
            users.items.map((user: any) => (
              <div key={user.id} className="flex items-center justify-between">
                <Link href={`/profile/${user.username}`} onClick={onClose} className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1 min-w-0">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={user.avatarUrl || ''} />
                    <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col truncate">
                    <span className="font-bold text-sm truncate">{user.displayName}</span>
                    <span className="text-muted-foreground text-sm truncate">@{user.username}</span>
                  </div>
                </Link>
                {user.id !== me?.id && (
                  <Button
                    variant={user.isFollowing ? "outline" : "default"}
                    size="sm"
                    className="rounded-full font-bold ml-2 shrink-0"
                    onClick={(e) => { e.preventDefault(); handleFollowToggle(user); }}
                  >
                    {user.isFollowing ? "フォロー中" : "フォロー"}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilePage() {
  const [, params] = useRoute("/profile/:username");
  const username = params?.username;
  const { data: me, isLoading: isMeLoading } = useGetMe();
  const [location, setLocation] = useLocation();
  const isMe = me?.username === username;

  useEffect(() => {
    if (username === "me") {
      if (!isMeLoading) {
        if (me?.username) {
          setLocation(`/profile/${me.username}`, { replace: true });
        } else {
          setLocation("/", { replace: true });
        }
      }
    }
  }, [username, me, isMeLoading, setLocation]);

  const [activeTab, setActiveTab] = useState<'yudates' | 'likes'>('yudates');
  
  const [followDialogConfig, setFollowDialogConfig] = useState<{ open: boolean; type: 'followers' | 'following' }>({ open: false, type: 'followers' });
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const [isBlockLoading, setIsBlockLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryEnabled = !!username && username !== "me";

  const { data: profile, isLoading: isProfileLoading, isError } = useGetUserProfile(username!, {
    query: { enabled: queryEnabled, queryKey: getGetUserProfileQueryKey(username!) }
  });

  const { data: pinnedYudate } = useGetYudate(
    profile?.pinnedYudateId || 0,
    { query: { enabled: !!profile?.pinnedYudateId, queryKey: getGetYudateQueryKey(profile?.pinnedYudateId || 0) } }
  );

  const { data: yudates, isLoading: isYudatesLoading } = useGetUserYudates(
    username!,
    { query: { enabled: queryEnabled && activeTab === 'yudates', queryKey: ['/api/users', username, 'yudates'] } }
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

  if (!username) {
    return <div className="p-8 text-center text-muted-foreground font-bold">ユーザーIDが見つかりません</div>;
  }

  if (isProfileLoading && !profile) {
    return <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (!profile) {
    return <div className="p-8 text-center text-muted-foreground font-bold">プロフィールが見つかりません</div>;
  }

  // Show exact date in JST (UTC+9): yyyy年M月d日
  let joinDate = "不明";
  try {
    if (profile.createdAt) {
      joinDate = format(
        new Date(new Date(profile.createdAt).toLocaleString("en-US", { timeZone: "Asia/Tokyo" })),
        "yyyy年M月d日",
        { locale: ja }
      );
    }
  } catch (e) {
    console.error("Failed to parse join date:", e);
  }

  return (
    <div className="w-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex flex-col justify-center px-4 h-[53px]">
          <h1 className="font-bold text-xl leading-tight truncate flex items-center gap-1">
            {profile.displayName}
            <VerifiedBadge isVerified={profile.isVerified} />
            <UserBadge badgeType={profile.badgeType} />
            {profile?.isPrivate && <Lock className="w-4 h-4 text-muted-foreground" />}
          </h1>
          <div className="text-[13px] text-muted-foreground leading-tight">{profile.yudateCount} ユデート</div>
        </div>
      </div>

      {/* Cover */}
      <div className="h-32 sm:h-48 bg-primary/20 w-full relative overflow-hidden">
        {profile.headerUrl ? (
          <img src={profile.headerUrl} alt="ヘッダー" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(145 60% 55% / 0.5) 1px, transparent 0)', backgroundSize: '16px 16px' }} />
        )}
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
          <div className="ml-auto mt-3 flex items-center gap-2">
            {isMe ? (
              <Link href="/settings">
                <Button variant="outline" className="rounded-full font-bold">
                  プロフィールを編集
                </Button>
              </Link>
            ) : (
              <>
                {!(profile as any).isBlocking && !(profile as any).isBlockedBy && (
                  <Button
                    variant={profile.isFollowing ? "outline" : (profile as any).isFollowPending ? "secondary" : "default"}
                    className="rounded-full font-bold px-6"
                    onClick={handleFollowToggle}
                    disabled={followMutation.isPending || unfollowMutation.isPending}
                  >
                    {profile.isFollowing ? "フォロー中" : (profile as any).isFollowPending ? "リクエスト送信済み" : "フォロー"}
                  </Button>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full">
                      <MoreHorizontal className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={async () => {
                      const url = window.location.href;
                      if (navigator.share) await navigator.share({ url });
                      else await navigator.clipboard.writeText(url);
                    }}>
                      <Share2 className="w-4 h-4 mr-2" />
                      プロフィールを共有
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {(profile as any).isBlocking ? (
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setShowUnblockDialog(true)}>
                        <Ban className="w-4 h-4 mr-2" />
                        ブロック解除
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={() => setShowBlockDialog(true)}>
                        <Ban className="w-4 h-4 mr-2" />
                        ブロックする
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* User info */}
        <div className="mb-4">
          <h2 className="font-bold text-xl flex items-center gap-1">
            {profile.displayName}
            <VerifiedBadge isVerified={profile.isVerified} />
            <UserBadge badgeType={profile.badgeType} />
            {profile?.isPrivate && <Lock className="w-5 h-5 text-muted-foreground ml-1" />}
          </h2>
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
          <div
            className={!(profile as any).isBlockedBy && !(profile as any).isBlocking ? "hover:underline cursor-pointer" : "text-muted-foreground"}
            onClick={() => !(profile as any).isBlockedBy && !(profile as any).isBlocking && setFollowDialogConfig({ open: true, type: 'following' })}
          >
            <span className="font-bold text-foreground">{(profile as any).isBlockedBy || (profile as any).isBlocking ? 0 : profile.followingCount}</span>{" "}
            <span className="text-muted-foreground">フォロー中</span>
          </div>
          <div
            className={!(profile as any).isBlockedBy && !(profile as any).isBlocking ? "hover:underline cursor-pointer" : "text-muted-foreground"}
            onClick={() => !(profile as any).isBlockedBy && !(profile as any).isBlocking && setFollowDialogConfig({ open: true, type: 'followers' })}
          >
            <span className="font-bold text-foreground">{(profile as any).isBlockedBy || (profile as any).isBlocking ? 0 : profile.followerCount}</span>{" "}
            <span className="text-muted-foreground">フォロワー</span>
          </div>
        </div>
      </div>

      
      {(profile as any).isBlocking ? (
        <div className="p-8 mt-4 text-center border-t border-border/50">
          <div className="flex justify-center mb-4"><Ban className="w-12 h-12 text-muted-foreground" /></div>
          <h2 className="font-bold text-xl mb-2">現在{profile.displayName}をブロック中です</h2>
          <p className="text-muted-foreground mb-4">ブロック中はお互いの投稿が表示されません。</p>
          <Button variant="outline" className="rounded-full" onClick={() => setShowUnblockDialog(true)}>
            ブロック解除
          </Button>
        </div>
      ) : (profile as any).isBlockedBy ? (
        <div className="p-8 mt-4 text-center border-t border-border/50">
          <div className="flex justify-center mb-4"><Ban className="w-12 h-12 text-muted-foreground" /></div>
          <h2 className="font-bold text-xl mb-2">@{profile.username}さんからブロックされています</h2>
          <p className="text-muted-foreground">このユーザーの投稿は閲覧できません。</p>
        </div>
      ) : profile.isPrivate && !profile.isFollowing && !isMe ? (
        <div className="p-8 mt-4 text-center border-t border-border/50">
          <div className="flex justify-center mb-4"><Lock className="w-12 h-12 text-muted-foreground" /></div>
          <h2 className="font-bold text-xl mb-2">このアカウントは非公開です</h2>
          <p className="text-muted-foreground">ユデートやフォロワーを見るにはフォローリクエストが必要です（現在は自動承認されます）。</p>
        </div>
      ) : (
        <>
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
                    (isYudatesLoading && !yudates) ? (
                      <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>
                    ) : (
                      <>
                        {/* 固定されたユデート */}
                        {pinnedYudate && (
                          <div className="border-b border-border/50 bg-background pt-3 pb-1">
                            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground px-5 ml-6 mb-1">
                              <Pin className="w-3.5 h-3.5 fill-current text-primary" />
                              <span>固定されたユデート</span>
                            </div>
                            <div className="[&>div]:border-b-0">
                              <YudateCard yudate={pinnedYudate} />
                            </div>
                          </div>
                        )}
                        {/* 通常のTL (固定されたものは除く) */}
                        {yudates?.items ? (
                          (() => {
                            const items = yudates.items.filter((y) => y.id !== profile?.pinnedYudateId);
                            if (items.length > 0) {
                              return items.map((yudate) => <YudateCard key={yudate.id} yudate={yudate} />);
                            }
                            return !pinnedYudate && <div className="p-8 text-center text-muted-foreground font-bold">まだユデートしていません</div>;
                          })()
                        ) : (
                          !pinnedYudate && <div className="p-8 text-center text-muted-foreground font-bold">まだユデートしていません</div>
                        )}
                      </>
                    )
                  ) : (
                    (isLikesLoading && !likes) ? (
                      <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>
                    ) : likes?.items?.length ? (
                      likes.items.map((yudate) => <YudateCard key={yudate.id} yudate={yudate} />)
                    ) : (
                      <div className="p-8 text-center text-muted-foreground font-bold">まだいいねしていません</div>
                    )
                  )}
                </div>
          
                
          
                
        </>
      )}
      {/* Unblock Dialog */}
      <AlertDialog open={showUnblockDialog} onOpenChange={setShowUnblockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{profile?.displayName}さんのブロックを解除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              ブロックを解除すると、お互いの投稿が再び表示されるようになります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              disabled={isBlockLoading}
              onClick={async (e) => {
                e.preventDefault();
                setIsBlockLoading(true);
                try {
                  const res = await fetch(`/api/users/${profile?.username}/block`, { method: "DELETE" });
                  if (!res.ok) throw new Error();
                  toast({ title: "ブロックを解除しました" });
                  queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(profile!.username) });
                  queryClient.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => typeof k === 'string' && k.includes('/api/explore')) });
                } catch {
                  toast({ title: "ブロック解除に失敗しました", variant: "destructive" });
                } finally {
                  setIsBlockLoading(false);
                  setShowUnblockDialog(false);
                }
              }}
            >
              {isBlockLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              ブロック解除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Follow / Follower list dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{profile?.displayName}さんをブロックしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              ブロックすると、お互いのユデートがタイムラインやプロフィールに表示されなくなります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowBlockDialog(false)}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isBlockLoading}
              onClick={async (e) => {
                e.preventDefault();
                setIsBlockLoading(true);
                try {
                  const res = await fetch(`/api/users/${profile?.username}/block`, { method: "POST" });
                  if (!res.ok) throw new Error();
                  toast({ title: "ブロックしました" });
                  queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(profile!.username) });
                  queryClient.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => typeof k === 'string' && k.includes('/api/explore')) });
                } catch (err) {
                  toast({ title: "ブロックに失敗しました", variant: "destructive" });
                } finally {
                  setIsBlockLoading(false);
                  setShowBlockDialog(false);
                }
              }}
            >
              {isBlockLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              ブロックする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserListDialog
        open={followDialogConfig.open}
        onClose={() => setFollowDialogConfig((prev) => ({ ...prev, open: false }))}
        type={followDialogConfig.type}
        title={followDialogConfig.type === 'followers' ? 'フォロワー' : 'フォロー中'}
        username={username}
      />
    </div>
  );
}
