import { useState, useRef, useEffect } from "react";
import { Image, Smile, MapPin } from "lucide-react";
import { useCreateYudate, useReplyToYudate, useGetMe } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface YudateComposerProps {
  replyToId?: number;
  quotedYudateId?: number;
  placeholder?: string;
  onSuccess?: () => void;
  autoFocus?: boolean;
}

export default function YudateComposer({ 
  replyToId, 
  quotedYudateId, 
  placeholder = "いまどうしてる？",
  onSuccess,
  autoFocus = false
}: YudateComposerProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();

  const createMutation = useCreateYudate();
  const replyMutation = useReplyToYudate();

  const isPending = createMutation.isPending || replyMutation.isPending;

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleSubmit = () => {
    if (!content.trim() || isPending) return;

    if (replyToId) {
      replyMutation.mutate({ id: replyToId, data: { content: content.trim() } }, {
        onSuccess: () => {
          setContent("");
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
          toast({ title: "返信しました" });
          queryClient.invalidateQueries({ queryKey: ['/api/yudates'] });
          onSuccess?.();
        },
        onError: () => {
          toast({ title: "エラーが発生しました", variant: "destructive" });
        }
      });
    } else {
      createMutation.mutate({ data: { content: content.trim(), quotedYudateId } }, {
        onSuccess: () => {
          setContent("");
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
          toast({ title: "ユデートを投稿しました" });
          queryClient.invalidateQueries({ queryKey: ['/api/yudates'] });
          onSuccess?.();
        },
        onError: () => {
          toast({ title: "エラーが発生しました", variant: "destructive" });
        }
      });
    }
  };

  const progress = content.length / 280;
  const isOverLimit = content.length > 280;

  return (
    <div className="flex gap-4 p-4 border-b border-border/50 bg-background">
      <div className="shrink-0 pt-1">
        <Avatar className="w-12 h-12">
          <AvatarImage src={me?.avatarUrl || ''} />
          <AvatarFallback>{me?.displayName?.[0] || 'U'}</AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-1 min-w-0">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          placeholder={placeholder}
          className="w-full bg-transparent text-xl outline-none resize-none placeholder:text-muted-foreground mt-2 mb-2 min-h-[60px]"
          maxLength={300}
        />
        
        <div className="flex justify-between items-center pt-3 border-t border-border/50">
          <div className="flex gap-1 text-primary">
            <button className="p-2 rounded-full hover:bg-primary/10 transition-colors disabled:opacity-50" disabled>
              <Image className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-primary/10 transition-colors disabled:opacity-50" disabled>
              <Smile className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-primary/10 transition-colors disabled:opacity-50" disabled>
              <MapPin className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {content.length > 0 && (
              <>
                <div className={`text-sm font-medium ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {content.length}/280
                </div>
                <div className="w-px h-8 bg-border/50" />
              </>
            )}
            <Button 
              onClick={handleSubmit} 
              disabled={!content.trim() || isOverLimit || isPending}
              className="rounded-full px-6 font-bold font-rounded"
            >
              {replyToId ? "返信" : "ユデートする"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}