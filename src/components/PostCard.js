"use client";

/* eslint-disable @next/next/no-img-element -- ImgBB URLs are external/dynamic; next/image optimization doesn't apply cleanly */

import { useState, useEffect } from "react";

import { useAppUser } from "@/components/AppShell";
import VoiceNotePlayer from "@/components/VoiceNotePlayer";
import { deletePost, toggleLike, createComment, subscribeToComments } from "@/lib/posts";
import { getUserAvatar, getAvatarSizeClasses, formatRelativeDate, profileEmojiFor } from "@/lib/users";

const labelClasses = "text-sm font-semibold tracking-tight text-white/90";

function HeartIcon({ filled = false, className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? "0" : "1.8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function MessageSquareIcon({ className }) {
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TrashIcon({ className }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="14" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function CommentItem({ comment }) {
  const { type, value } = getUserAvatar({ avatarUrl: comment.avatarUrl, uid: comment.userId, username: comment.username });
  const { relative } = formatRelativeDate(comment.createdAt);

  return (
    <div className="flex gap-3 px-5 pb-4">
      <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-sm ring-1 ring-white/20 ${getAvatarSizeClasses("sm")}`}>
        {type === "image" ? <img src={value} alt="" aria-hidden="true" className="rounded-full" style={{ objectFit: "cover" }} /> : value}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`${labelClasses} truncate`}>{comment.username}</p>
          <time className="text-xs text-white/40" title={comment.createdAt?.toDate?.().toLocaleString()}>
            {relative}
          </time>
        </div>
        <p className="mt-1 text-sm text-white/70">{comment.text}</p>
      </div>
    </div>
  );
}

function CommentsSection({ postId, username, userId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!postId) return;
    const unsubscribe = subscribeToComments(postId, setComments, (err) => {
      console.error("Comments subscription failed:", err);
    });
    return () => unsubscribe();
  }, [postId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const actorAvatarUrl = user.avatarUrl || null;
      await createComment(postId, { userId, username, text: newComment.trim(), avatarUrl: actorAvatarUrl });
      setNewComment("");
    } catch (err) {
      console.error("Comment failed:", err);
      setError("Couldn't post comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-t border-white/10 bg-white/[0.02]">
      <div className="px-5 py-3">
        <h4 className="text-sm font-semibold tracking-tight text-white/70">
          {comments.length === 0 ? "No comments yet" : `${comments.length} comment${comments.length !== 1 ? "s" : ""}`}
        </h4>
      </div>
      <div className="max-h-64 overflow-y-auto px-5 pb-4">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 px-5 pb-5">
        <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-sm ring-1 ring-white/20 ${getAvatarSizeClasses("sm")}`}>
          {(() => { const { type, value } = getUserAvatar({ uid: userId, username }); return type === "image" ? <img src={value} alt="" aria-hidden="true" className="rounded-full" style={{ objectFit: "cover" }} /> : value; })()}
        </span>
        <div className="min-w-0 flex-1">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment…"
            disabled={submitting}
            rows={1}
            maxLength={500}
            className="w-full min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400/50 focus:bg-white/10 disabled:opacity-60 resize-none"
          />
          {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={!newComment.trim() || submitting}
          className="shrink-0 min-h-[44px] min-w-[44px] rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_-6px_rgba(124,58,237,0.6)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(124,58,237,0.8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          Post
        </button>
      </form>
    </div>
  );
}

export default function PostCard({ post }) {
  const user = useAppUser();
  const [likePending, setLikePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [showComments, setShowComments] = useState(false);

  const username = post.username || "Member";
  const avatar = getUserAvatar({ avatarUrl: post.avatarUrl, uid: post.userId, username });
  const { relative, absolute } = formatRelativeDate(post.createdAt);

  const likes = Array.isArray(post.likes) ? post.likes : [];
  const likeCount = likes.length;
  const hasLiked = user ? likes.includes(user.uid) : false;
  const isOwner = Boolean(user && post.userId === user.uid);

  async function handleLike() {
    if (!user || likePending) return;
    setLikePending(true);
    setActionError(null);
    try {
      const actorUsername = user.displayName || user.email?.split("@")[0] || "Member";
      const actorAvatarUrl = user.avatarUrl || null;
      await toggleLike(post.id, user.uid, actorUsername, actorAvatarUrl, hasLiked);
    } catch (err) {
      console.error("Like failed:", err);
      setActionError("Couldn't update like. Please try again.");
    } finally {
      setLikePending(false);
    }
  }

  async function handleDelete() {
    if (!isOwner || deletePending) return;
    setDeletePending(true);
    setActionError(null);
    try {
      await deletePost(post.id);
    } catch (err) {
      console.error("Delete failed:", err);
      setActionError("Couldn't delete the post. Please try again.");
    } finally {
      setDeletePending(false);
    }
  }

  if (deletePending) {
    return (
      <article className="w-full overflow-hidden rounded-none border border-white/10 bg-white/5 p-10 text-center shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:rounded-3xl">
        <p className="text-sm text-white/50">Deleting post…</p>
      </article>
    );
  }

  return (
    <article className="fade-up group relative w-full overflow-hidden rounded-none border border-white/10 bg-white/5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl transition duration-300 hover:border-white/20 sm:rounded-3xl">
      {/* Top glass highlight */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />

      {/* Header: avatar + name + timestamp + owner delete */}
      <header className="flex items-center gap-3 px-5 pt-5 pb-4">
        <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-lg ring-1 ring-white/20 ${getAvatarSizeClasses("default")}`}>
          {avatar.type === "image" ? (
            <img src={avatar.value} alt="" aria-hidden="true" className="rounded-full" style={{ objectFit: "cover" }} />
          ) : (
            avatar.value
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${labelClasses} truncate`}>{username}</p>
          <time
            className="block text-xs text-white/40"
            title={absolute || undefined}
          >
            {relative}
          </time>
        </div>
        {isOwner ? (
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Delete post"
            title="Delete post"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-white/30 transition duration-300 hover:bg-rose-500/10 hover:text-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        ) : null}
      </header>

      {/* Image */}
      {post.imageUrl ? (
        <div className="relative overflow-hidden border-y border-white/10 bg-black/40">
          <img
            src={post.imageUrl}
            alt={post.caption ? `Post by ${username}: ${post.caption.slice(0, 60)}` : `Post by ${username}`}
            loading="lazy"
            className="max-h-[560px] w-full object-cover transition duration-500 group-hover:scale-[1.01]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
          />
        </div>
      ) : null}

      {/* Caption + voice note + actions */}
      <div className="px-5 py-4">
        {post.caption ? (
          <p className="text-sm leading-relaxed text-white/70">
            <span className={`${labelClasses} mr-1.5`}>{username}</span>
            {post.caption}
          </p>
        ) : null}

        {post.audioData ? (
          <VoiceNotePlayer src={post.audioData} className="mt-3" />
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleLike}
            disabled={!user || likePending}
            aria-pressed={hasLiked}
            aria-label={hasLiked ? "Unlike post" : "Like post"}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 disabled:opacity-60 ${
              hasLiked
                ? "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
                : "text-white/40 hover:bg-white/5 hover:text-white/70"
            }`}
          >
            <HeartIcon
              filled={hasLiked}
              className={`h-4 w-4 transition-transform duration-300 ${
                likePending ? "scale-110" : ""
              }`}
            />
            {likeCount === 0
              ? "No likes yet"
              : `${likeCount} ${likeCount === 1 ? "like" : "likes"}`}
          </button>

          {user ? (
            <button
              type="button"
              onClick={() => setShowComments((prev) => !prev)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/40 hover:bg-white/5 hover:text-white/70 transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            >
              <MessageSquareIcon className="h-4 w-4" />
              {post.commentCount !== undefined
                ? post.commentCount === 0
                  ? "Comment"
                  : `${post.commentCount} comment${post.commentCount !== 1 ? "s" : ""}`
                : "Comment"}
            </button>
          ) : null}
        </div>

        {actionError ? (
          <p role="alert" className="mt-3 text-xs text-rose-400">
            {actionError}
          </p>
        ) : null}

        {showComments && user && (
          <CommentsSection postId={post.id} username={user.displayName || user.email?.split("@")[0] || "Member"} userId={user.uid} />
        )}
      </div>
    </article>
  );
}