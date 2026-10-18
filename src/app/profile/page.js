"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import AppShell, { useAppUser } from "@/components/AppShell";
import PostCard from "@/components/PostCard";
import { auth } from "@/firebase";
import { subscribeToUserPosts } from "@/lib/posts";
import { getUserAvatar, getAvatarSizeClasses, subscribeToUserProfile } from "@/lib/users";

function LogoutIcon({ className }) {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function EditIcon({ className }) {
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
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

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
          <div className="space-y-2.5 px-5 py-4">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileContent() {
  const user = useAppUser();
  const router = useRouter();

  const [posts, setPosts] = useState(null);
  const [feedError, setFeedError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToUserPosts(
      user.uid,
      (userPosts) => {
        setPosts(userPosts);
        setFeedError(null);
      },
      (error) => {
        console.error("Profile feed subscription failed:", error);
        setFeedError("Couldn't load your posts. Please try again shortly.");
        setPosts((prev) => prev ?? []);
      },
    );
    return () => unsubscribe();
  }, [user.uid]);

  // Real-time subscription for user profile (bio, avatar)
  useEffect(() => {
    const unsubscribe = subscribeToUserProfile(
      user.uid,
      (data) => setUserProfile(data),
      (err) => console.warn("User profile subscription failed:", err)
    );
    return () => unsubscribe();
  }, [user.uid]);

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
      return;
    }
    router.replace("/login");
  }

  const displayName =
    user.displayName || user.email?.split("@")[0] || "Member";
  const email = user.email || "";
  const avatar = userProfile
    ? getUserAvatar({ avatarUrl: userProfile.avatarUrl, uid: user.uid, username: userProfile.username, emoji: userProfile.emoji })
    : getUserAvatar({ avatarUrl: user.avatarUrl, uid: user.uid });
  const postCount = posts?.length ?? 0;

  return (
    <>
      {/* Profile header */}
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
            {avatar.type === "image" ? (
              <img src={avatar.value} alt="" aria-hidden="true" className="rounded-3xl" style={{ objectFit: "cover" }} />
            ) : (
              avatar.value
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {displayName}
            </h1>
            {email ? (
              <p className="mt-1 truncate text-sm text-white/50">{email}</p>
            ) : null}
            {userProfile?.bio ? (
              <p className="mt-2 text-sm text-white/70 line-clamp-2">{userProfile.bio}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center">
            <p className="text-xl font-semibold tracking-tight">
              {posts === null ? "—" : postCount}
            </p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
              {postCount === 1 ? "Post" : "Posts"}
            </p>
          </div>

          {/* Edit Profile button */}
          <Link
            href="/profile/edit"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/60 transition duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          >
            <EditIcon className="h-4 w-4" />
            Edit Profile
          </Link>

          {/* Logout lives here so mobile users can sign out (the desktop
              sidebar has its own). */}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/60 transition duration-300 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
          >
            <LogoutIcon className="h-4 w-4" />
            Log out
          </button>
        </div>
      </section>

      <header className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your posts</h2>
          <p className="mt-1 text-sm text-white/50">
            Everything you&rsquo;ve shared, newest first.
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
          className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {feedError}
        </p>
      ) : null}

      {/* Loading skeleton */}
      {posts === null && !feedError ? (
        <section
          aria-busy="true"
          aria-label="Loading your posts"
          className="mt-6"
        >
          <GridSkeleton />
        </section>
      ) : null}

      {/* Empty state */}
      {posts !== null && posts.length === 0 && !feedError ? (
        <section className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />
          <h3 className="text-lg font-semibold tracking-tight">
            You haven&rsquo;t posted yet
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/50">
            Share a photo and caption — it&rsquo;ll appear here and on the
            home feed instantly.
          </p>
          <Link
            href="/create"
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition duration-300 hover:border-indigo-400/50 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          >
            Create your first post
          </Link>
        </section>
      ) : null}

      {/* User's post grid */}
      {posts !== null && posts.length > 0 ? (
        <section aria-label="Your posts" className="mt-6">
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

export default function ProfilePage() {
  return (
    <AppShell>
      <ProfileContent />
    </AppShell>
  );
}
