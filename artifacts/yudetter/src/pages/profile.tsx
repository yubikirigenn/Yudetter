import { useRoute } from "wouter";
import { useState } from "react";
import { 
  useGetUserProfile, 
  useGetUserYudates, 
  useGetUserLikes, 
  useFollowUser, 
  useUnfollowUser,
  useGetMe,
  getGetUserProfileQueryKey
} from "@workspace/api-client-react";
import { CalendarDays, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import YudateCard from "@/components/yudate-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export default function ProfilePage() {
  const [, params] = useRoute("/profile/:username");
  const username = params?.username;
  const { data: me } = useGetMe();
  const isMe = me?.username === username;
  
  const [activeTab, setActiveTab] = useState<'yudates' | 'likes'>('yudates');
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

  const joinDate = format(new Date(profile.createdAt), "yyyy年M月", { locale: ja });

  return (
    <div className="w-full">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex flex-col justify-center px-4 h-[53px]">
          <h1 className="font-bold text-xl leading-tight truncate">{profile.displayName}</h1>
          <div className="text-[13px] text-muted-foreground leading-tight">{profile.yudateCount} ユデート</div>
        </div>
      </div>

      {/* Cover (Blank for now, just primary color) */}
      <div className="h-32 sm:h-48 bg-primary/20 w-full relative">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(145 60% 55% / 0.5) 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
      </div>

      <div className="px-4 pb-4">
        {/* Avatar & Edit/Follow Button */}
        <div className="flex justify-between items-start mb-4 relative h-16">
          <div className="absolute -top-16">
            <Avatar className="w-32 h-32 border-4 border-background bg-background">
              <AvatarImage src={profile.avatarUrl || ''} />
              <AvatarFallback className="text-4xl bg-primary/20 text-primary font-bold">{profile.displayName[0]}</AvatarFallback>
            </Avatar>
          </div>
          <div className="ml-auto mt-3">
            {isMe ? (
              <Button variant="outline" className="rounded-full font-bold">プロフィールを編集</Button>
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

        {/* Info */}
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
          <div className="hover:underline cursor-pointer"><span className="font-bold text-foreground">{profile.followingCount}</span> <span className="text-muted-foreground">フォロー中</span></div>
          <div className="hover:underline cursor-pointer"><span className="font-bold text-foreground">{profile.followerCount}</span> <span className="text-muted-foreground">フォロワー</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        <button 
          onClick={() => setActiveTab('yudates')}
          className={`flex-1 font-bold text-center p-4 hover:bg-secondary transition-colors relative`}
        >
          <span className={activeTab === 'yudates' ? 'text-foreground' : 'text-muted-foreground'}>ユデート</span>
          {activeTab === 'yudates' && <div className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-primary rounded-t-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('likes')}
          className={`flex-1 font-bold text-center p-4 hover:bg-secondary transition-colors relative`}
        >
          <span className={activeTab === 'likes' ? 'text-foreground' : 'text-muted-foreground'}>いいね</span>
          {activeTab === 'likes' && <div className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-primary rounded-t-full" />}
        </button>
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
    </div>
  );
}