import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { Loader2 } from "lucide-react";

interface Props {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export default function InfiniteScrollObserver({ hasNextPage, isFetchingNextPage, fetchNextPage }: Props) {
  const { ref, inView } = useInView({
    rootMargin: '200px',
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!hasNextPage) {
    return null;
  }

  return (
    <div ref={ref} className="w-full flex justify-center py-8">
      {isFetchingNextPage && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
    </div>
  );
}
