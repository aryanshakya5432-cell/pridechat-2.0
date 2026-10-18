"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import AppShell, { useAppUser } from "@/components/AppShell";
import { subscribeToNotifications, markAllNotificationsAsRead, markNotificationAsRead } from "@/lib/users";
import { getUserAvatar, getAvatarSizeClasses, profileEmojiFor, formatRelativeDate } from "@/lib/users";

function BellIcon({ className }) {
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
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function NotificationItem({ notification, onClick }) {
  const { type, actorUsername, actorAvatarUrl, actorUid, createdAt, read, postId, chatId, messagePreview } = notification;
  const { relative } = formatRelativeDate(createdAt);

  const actorAvatar = getUserAvatar({ avatarUrl: actorAvatarUrl, uid: actorUid, username: actorUsername });

  let actionText = "";
  let actionIcon = null;

  switch (type) {
    case "like":
      actionText = "liked your post";
      actionIcon = (
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="h-4 w-4" aria-hidden="true">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      );
      break;
    case "comment":
      actionText = "commented on your post";
      actionIcon = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
      break;
    case "message":
      actionText = "sent you a message";
      actionIcon = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
      break;
  }

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!read) {
      await markNotificationAsRead(notification.targetUid || "", notification.id);
    }
    onClick?.();
  };

  let href = "/";
  if (postId) href = `/`;
  if (chatId) href = `/messages`;

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`flex items-start gap-3 rounded-xl p-3 transition duration-200 ${!read ? "bg-white/5" : "bg-white/[0.02]"} hover:bg-white/5`}
    >
      <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-sm ring-1 ring-white/20 ${getAvatarSizeClasses("sm")}`}>
        {actorAvatar.type === "image" ? (
          <img src={actorAvatar.value} alt="" aria-hidden="true" className="rounded-full" style={{ objectFit: "cover" }} />
        ) : (
          actorAvatar.value
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-white truncate">{actorUsername}</p>
          <time className="text-xs text-white/40 whitespace-nowrap shrink-0">{relative}</time>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {actionIcon && <span className="text-indigo-300">{actionIcon}</span>}
          <p className="text-sm text-white/70">{actionText}</p>
        </div>
        {messagePreview && (
          <p className="mt-1 text-sm text-white/50 truncate max-w-xs">{messagePreview}</p>
        )}
      </div>
      {!read && (
        <span className="shrink-0 w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 mt-1" />
      )}
    </Link>
  );
}

function NotificationsContent() {
  const user = useAppUser();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications(
      user.uid,
      (data) => {
        setNotifications(data);
        setLoading(false);
      },
      (err) => {
        console.error("Notifications subscription failed:", err);
        setLoading(false);
      },
      50
    );
    return () => unsubscribe();
  }, [user.uid]);

  async function handleMarkAllRead() {
    await markAllNotificationsAsRead(user.uid);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1.5 rounded-xl bg-white/5 text-xs font-medium text-white/60 hover:bg-white/10 transition"
            >
              Mark all read
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading notifications">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl p-3 bg-white/[0.02] animate-pulse">
              <div className="flex shrink-0 h-10 w-10 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-white/10 rounded" />
                <div className="h-3 w-1/2 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-white/40">
          <BellIcon className="h-16 w-16 mb-4" />
          <p className="text-lg font-medium">No notifications yet</p>
          <p className="text-sm mt-1">When someone likes or comments on your posts, you&apos;ll see them here</p>
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Notifications">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={{ ...notification, targetUid: user.uid }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <AppShell>
      <NotificationsContent />
    </AppShell>
  );
}