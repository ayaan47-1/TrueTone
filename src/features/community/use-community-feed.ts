// src/features/community/use-community-feed.ts
// Local, in-memory engagement state for the seeded Community feed -- no backend table,
// no persistence. A real like/save/share ledger is future work once Community has its
// own tables; this hook exists so the engagement bar has somewhere real to write to.
import { useCallback, useMemo, useState } from 'react';
import type { CommunityPost } from './community-types';

export interface PostEngagement {
  liked: boolean;
  saved: boolean;
  likeCount: number;
  saveCount: number;
  shareCount: number;
}

interface UseCommunityFeedResult {
  engagementFor: (postId: string) => PostEngagement;
  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  registerShare: (postId: string) => void;
}

function initialEngagement(posts: readonly CommunityPost[]): Record<string, PostEngagement> {
  const initial: Record<string, PostEngagement> = {};
  for (const post of posts) {
    initial[post.id] = {
      liked: false,
      saved: false,
      likeCount: post.likeCount,
      saveCount: post.saveCount,
      shareCount: 0,
    };
  }
  return initial;
}

export function useCommunityFeed(posts: readonly CommunityPost[]): UseCommunityFeedResult {
  const [engagement, setEngagement] = useState<Record<string, PostEngagement>>(() =>
    initialEngagement(posts),
  );

  const engagementFor = useCallback(
    (postId: string): PostEngagement =>
      engagement[postId] ?? { liked: false, saved: false, likeCount: 0, saveCount: 0, shareCount: 0 },
    [engagement],
  );

  const toggleLike = useCallback((postId: string) => {
    setEngagement((prev) => {
      const current = prev[postId];
      if (!current) return prev;
      const liked = !current.liked;
      return {
        ...prev,
        [postId]: { ...current, liked, likeCount: current.likeCount + (liked ? 1 : -1) },
      };
    });
  }, []);

  const toggleSave = useCallback((postId: string) => {
    setEngagement((prev) => {
      const current = prev[postId];
      if (!current) return prev;
      const saved = !current.saved;
      return {
        ...prev,
        [postId]: { ...current, saved, saveCount: current.saveCount + (saved ? 1 : -1) },
      };
    });
  }, []);

  const registerShare = useCallback((postId: string) => {
    setEngagement((prev) => {
      const current = prev[postId];
      if (!current) return prev;
      return { ...prev, [postId]: { ...current, shareCount: current.shareCount + 1 } };
    });
  }, []);

  return useMemo(
    () => ({ engagementFor, toggleLike, toggleSave, registerShare }),
    [engagementFor, toggleLike, toggleSave, registerShare],
  );
}
