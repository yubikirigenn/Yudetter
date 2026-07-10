import { useRoute, Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { 
  useGetYudate, 
  useGetYudateReplies,
  getGetYudateQueryKey,
  getGetYudateRepliesQueryKey,
  useGetMe
} from "@workspace/api-client-react";
import YudateCard from "@/components/yudate-card";
import YudateComposer from "@/components/yudate-composer";

export default function YudateDetailPage() {
  const [, params] = useRoute("/yudate/:id");
  const id = Number(params?.id);

  const { data: me } = useGetMe();

  const { data: yudate, isLoading } = useGetYudate(id, {
    query: { enabled: !!id, queryKey: getGetYudateQueryKey(id) }
  });

  const { data: replies, isLoading: repliesLoading } = useGetYudateReplies(id, {
    query: { enabled: !!id, queryKey: getGetYudateRepliesQueryKey(id) }
  });

  if (isLoading) {
    return <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (!yudate) {
    return <div className="p-8 text-center text-muted-foreground font-bold">ユデートが見つかりません</div>;
  }

  return (
    <div className="w-full">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-6 px-4 h-[53px]">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-xl">ユデート</h1>
        </div>
      </div>

      <YudateCard yudate={yudate} isDetail={true} />

      <div className="border-b border-border/50">
        <YudateComposer
          replyToId={yudate.id}
          placeholder="返信を投稿"
          isReplyToReply={yudate.replyToId !== null}
          isOwnPost={yudate.author.username === me?.username}
        />
      </div>

      <div className="flex flex-col">
        {repliesLoading ? (
          <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : replies?.items.length ? (
          replies.items.map((reply) => <YudateCard key={reply.id} yudate={reply} />)
        ) : (
          null
        )}
      </div>
    </div>
  );
}