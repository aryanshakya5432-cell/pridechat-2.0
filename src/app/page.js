"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import AppShell, { useAppUser } from "@/components/AppShell";
import PostCard from "@/components/PostCard";
import { subscribeToFeed } from "@/lib/posts";

function FeedIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function PostSkeleton() {
  return (
    <div className="overflow-hidden rounded-none border border-white/10 bg-white/5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:rounded-3xl">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded-full bg-white/10" />
          <div className="h-2.5 w-16 animate-pulse rounded-full bg-white/[0.07]" />
        </div>
      </div>
      <div className="h-72 w-full animate-pulse bg-white/[0.06]" />
      <div className="space-y-2.5 px-5 py-4">
        <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-white/[0.07]" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const user = useAppUser();
  const name = user?.displayName || user?.email?.split("@")[0] || "there";

  const [posts, setPosts] = useState(null);
  const [feedError, setFeedError] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToFeed(
      (latestPosts) => {
        setPosts(latestPosts);
        setFeedError(null);
      },
      (error) => {
        console.error("Feed subscription failed:", error);
        setFeedError("Couldn't load the feed. Please try again shortly.");
        setPosts((prev) => prev ?? []);
      },
    );
    return () => unsubscribe();
  }, []);

  return (
    <AppShell>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          <p className="mt-1 text-sm text-white/50">
            Welcome back, {name}.
          </p>
        </div>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(124,58,237,0.7)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-10px_rgba(124,58,237,0.85)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507]"
        >
          <span aria-hidden="true">＋</span>
          New post
        </Link>
      </header>

      {feedError ? (
        <p
          role="alert"
          className="mt-8 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {feedError}
        </p>
      ) : null}

      {/* Loading skeleton */}
      {posts === null && !feedError ? (
        <section aria-busy="true" aria-label="Loading posts" className="mt-8 space-y-8">
          <PostSkeleton />
          <PostSkeleton />
        </section>
      ) : null}

      {/* Empty state */}
      {posts !== null && posts.length === 0 && !feedError ? (
        <section className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 text-indigo-300">
            <FeedIcon className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-lg font-semibold tracking-tight">
            No posts yet. Be the first to share!
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/50">
            Share the first photo and caption — new posts will show up right
            here, instantly.
          </p>
          <Link
            href="/create"
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition duration-300 hover:border-indigo-400/50 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          >
            Create your first post
          </Link>
        </section>
      ) : null}

      {/* Live feed */}
      {posts !== null && posts.length > 0 ? (
        <section aria-label="Post feed" className="mt-8 space-y-8 pb-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
