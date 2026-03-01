'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ThreadRedirectPage() {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();

  useEffect(() => {
    const threadId = encodeURIComponent(decodeURIComponent(params.threadId));
    router.replace(`/inbox?threadId=${threadId}`);
  }, [params.threadId, router]);

  return <main className="text-sm text-zinc-400">Redirecting to inbox…</main>;
}
