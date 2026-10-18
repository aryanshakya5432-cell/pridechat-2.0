"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import AppShell, { useAppUser } from "@/components/AppShell";
import PostCard from "@/components/PostCard";
import { subscribeToUserPosts } from "@/lib/posts";
import { getUserDoc, profileEmojiFor, getUserAvatar, getAvatarSizeClasses } from "@/lib/users";

function GridSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-none border border-white/10 bg-white/5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:rounded-3xl"
        >
          <div className="flex items-center gap-3 px-5 pt-5 pb-4">
            <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
              <div className="h-2.5 w-14 animate-pulse rounded-full bg-white/[0.07]" />
            </div>
          </div>
          <div className="h-48 w-full animate-pulse bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

function PublicProfileContent() {
  const { userId } = useParams();
  const viewer = useAppUser();

  // Data is keyed by userId so switching profiles reads as "loading"
  // without any synchronous setState inside the effect.
  const [profileState, setProfileState] = useState({ userId: null, data: undefined });
  const [postsState, setPostsState] = useState({ userId: null, posts: null });
  const [postsError, setPostsError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getUserDoc(userId)
      .then((data) => {
        if (!cancelled) setProfileState({ userId, data });
      })
      .catch((error) => {
        console.error("Public profile load failed:", error);
        if (!cancelled) setProfileState({ userId, data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const unsubscribe = subscribeToUserPosts(
      userId,
      (userPosts) => {
        setPostsState({ userId, posts: userPosts });
        setPostsError(null);
      },
      (error) => {
        console.error("Public profile feed failed:", error);
        setPostsError("Couldn't load this profile's posts right now.");
        setPostsState({ userId, posts: [] });
      },
    );
    return () => unsubscribe();
  }, [userId]);

  const profileDoc =
    profileState.userId === userId ? profileState.data : undefined;
  const posts = postsState.userId === userId ? postsState.posts : null;
  const loadingProfile = profileDoc === undefined;
  const loadingPosts = posts === null;
  const notFound =
    !loadingProfile &&
    profileDoc === null &&
    !loadingPosts &&
    posts.length === 0;

  if (notFound) {
    return (
      <section className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />
        <h1 className="text-lg font-semibold tracking-tight">
          This profile doesn&apos;t exist
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/50">
          The account you&apos;re looking for may have been removed, or the
          link is incorrect.
        </p>
        <Link
          href="/search"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition duration-300 hover:border-indigo-400/50 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          Back to search
        </Link>
      </section>
    );
  }

  // Prefer the users doc; fall back to the username stored on their posts
  // for accounts created before the users collection existed.
  const displayName =
    profileDoc?.username || posts?.[0]?.username || "Member";
  const email = profileDoc?.email || "";
  const avatar = profileDoc ? getUserAvatar({ avatarUrl: profileDoc.avatarUrl, uid: userId, username: profileDoc.username, emoji: profileDoc.emoji }) : { type: "emoji", value: profileEmojiFor(userId) };
  const postCount = posts?.length ?? 0;
  const isSelf = Boolean(viewer && viewer.uid === userId);

  return (
    <>
      {/* Public profile header */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-8">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 blur-3xl"
        />

        <div className="flex flex-wrap items-center gap-5">
          <span className={`flex shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-4xl ring-1 ring-white/20 ${getAvatarSizeClasses("xl")}`}>
            {loadingProfile ? (
              "…"
            ) : avatar.type === "image" ? (
              <img src={avatar.value} alt="" aria-hidden="true" className="rounded-3xl" style={{ objectFit: "cover" }} />
            ) : (
              avatar.value
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {loadingProfile ? "Loading…" : displayName}
              </h1>
              {isSelf ? (
                <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                  You
                </span>
              ) : null}
            </div>
            {!loadingProfile && email ? (
              <p className="mt-1 truncate text-sm text-white/50">{email}</p>
            ) : null}
            {!loadingProfile && profileDoc?.bio ? (
              <p className="mt-2 text-sm text-white/70 line-clamp-2">{profileDoc.bio}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center">
            <p className="text-xl font-semibold tracking-tight">
              {loadingPosts ? "—" : postCount}
            </p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
              {postCount === 1 ? "Post" : "Posts"}
            </p>
          </div>

          {!isSelf && !loadingProfile && (
            <Link
              href={`/messages?chat=${userId}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_16px_-6px_rgba(124,58,237,0.6)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(124,58,237,0.8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Message
            </Link>
          )}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">
          {isSelf ? "Your posts" : `${displayName}'s posts`}
        </h2>
        <Link
          href="/search"
          className="text-sm font-medium text-white/50 transition hover:text-white"
        >
          ← Back to search
        </Link>
      </div>

      {postsError ? (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {postsError}
        </p>
      ) : null}

      {loadingPosts && !postsError ? (
        <section aria-busy="true" aria-label="Loading posts" className="mt-6">
          <GridSkeleton />
        </section>
      ) : null}

      {posts !== null && posts.length === 0 && !postsError ? (
        <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <h3 className="text-lg font-semibold tracking-tight">
            {isSelf ? "You haven't posted yet" : "No posts yet"}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/50">
            {isSelf
              ? "Share a photo and caption — it'll appear here and on the home feed instantly."
              : `${displayName} hasn't shared anything yet.`}
          </p>
          {isSelf ? (
            <Link
              href="/create"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition duration-300 hover:border-indigo-400/50 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            >
              Create your first post
            </Link>
          ) : null}
        </section>
      ) : null}

      {posts !== null && posts.length > 0 ? (
        <section aria-label="Posts" className="mt-6">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export default function PublicProfilePage() {
  // With cacheComponents, useParams suspends during prerendering of
  // dynamic routes — the whole protected tree must live below the
  // Suspense boundary so the fallback can render at build time.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050507]">
          <span className="h-10 w-10 animate-pulse rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30" />
        </div>
      }
    >
      <AppShell>
        <PublicProfileContent />
      </AppShell>
    </Suspense>
  );
}
