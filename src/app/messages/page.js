"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import AppShell, { useAppUser } from "@/components/AppShell";
import { subscribeToUserChats, getOrCreateChat } from "@/lib/chats";
import { getUserDoc, profileEmojiFor } from "@/lib/users";
import { ClientOnly } from "@/components/ClientOnly";

const ChatWindow = dynamic(
  () => import("@/components/ChatWindow").then((mod) => mod.default),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center text-white/40">Loading chat…</div> }
);

function MessageSquareIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ChatListItem({ chat, currentUid }) {
  const otherUid = chat.participantUids.find((uid) => uid !== currentUid);
  const otherUsername = chat.participantUsernames?.[otherUid] || "Unknown";
  const otherEmoji = profileEmojiFor(otherUid);
  const lastMessage = chat.lastMessage || "No messages yet";
  const lastMessageAt = chat.lastMessageAt?.toDate?.();
  const unreadCount = chat.unreadCounts?.[currentUid] || 0;
  const isLastMessageMine = chat.lastMessageSenderUid === currentUid;

  return (
    <Link
      href={"/messages?uid=" + otherUid}
      className="w-full flex items-center gap-3 rounded-xl p-3 bg-white/[0.02] hover:bg-white/5 transition duration-200 text-left"
    >
      <span className="flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-xl ring-1 ring-white/20 h-12 w-12">
        {otherEmoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-white truncate">@{otherUsername}</p>
          {lastMessageAt && (
            <time className="text-xs text-white/40 whitespace-nowrap shrink-0">
              {lastMessageAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </time>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className={"text-sm truncate " + (isLastMessageMine ? "text-white/50" : "text-white/70")}>
            {isLastMessageMine ? "You: " : ""}{lastMessage}
          </p>
          {unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-2 py-0.5 text-xs font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function MessagesContent() {
  const user = useAppUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToUserChats(
      user.uid,
      (data) => {
        setChats(data);
        setLoading(false);
      },
      (err) => {
        console.error("Chats subscription failed:", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user.uid]);

  // Handle new chat initiation from URL param (e.g., /messages?uid=otherUserUid)
  // Or open existing chat via /messages?chatId=xxx
  useEffect(() => {
    const targetUid = searchParams.get("uid");
    const chatIdFromUrl = searchParams.get("chatId");
    // Use a ref to prevent infinite loop - only process uid param once per navigation
    const processedRef = { current: false };
    if (targetUid && targetUid !== user.uid && !processedRef.current) {
      processedRef.current = true;
      // Fetch the other user's username first
      getUserDoc(targetUid).then((userDoc) => {
        const otherUsername = userDoc?.username || "";
        return getOrCreateChat(user.uid, targetUid, {
          currentUsername: user.displayName || user.email?.split("@")[0] || "Member",
          otherUsername,
        });
      }).then((chatId) => {
        setSelectedChatId(chatId);
        router.replace("/messages?chatId=" + chatId, { scroll: false });
      }).catch(console.error);
    }
    // Handle direct chatId navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (chatIdFromUrl && !selectedChatId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedChatId(chatIdFromUrl);
    }
  }, [user.uid, router, searchParams]);

  const selectedChat = chats.find((c) => c.id === selectedChatId);
  const otherUid = selectedChat?.participantUids?.find((uid) => uid !== user.uid);
  const otherUsername = selectedChat?.participantUsernames?.[otherUid] || "Unknown";
  const otherEmoji = otherUid ? profileEmojiFor(otherUid) : "👤";

  if (!isClient) {
    return (
      <div className="h-full flex items-center justify-center bg-[#050507]">
        <span className="h-10 w-10 animate-pulse rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
        {selectedChatId && (
          <button
            onClick={() => setSelectedChatId(null)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 md:hidden"
            aria-label="Back to conversations"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
        )}
        <Link
          href="/messages"
          className={`flex items-center gap-3 rounded-xl p-2 transition ${!selectedChatId ? "hover:bg-white/5" : ""}`}
        >
          <span className="flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-xl ring-1 ring-white/20 h-12 w-12">
            {otherEmoji}
          </span>
          <div className="min-w-0 hidden sm:block">
            <p className="font-medium text-white truncate">@{otherUsername}</p>
            {selectedChat && <p className="text-xs text-white/40">Active now</p>}
          </div>
        </Link>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!selectedChatId && (
          <aside className="flex-shrink-0 w-full md:w-80 border-r border-white/10 bg-white/[0.02] flex flex-col">
            <div className="p-4 border-b border-white/10">
              <h2 className="font-semibold text-white">Messages</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/40 px-4 text-center">
                  <MessageSquareIcon className="h-16 w-16 mb-3" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs mt-1">Start a conversation from a user&apos;s profile</p>
                </div>
              ) : (
                chats.map((chat) => (
                  <ChatListItem key={chat.id} chat={chat} currentUid={user.uid} />
                ))
              )}
            </div>
          </aside>
        )}

        {selectedChatId && (
          <ChatWindow
            chatId={selectedChatId}
            currentUser={user}
            otherUsername={otherUsername}
            otherEmoji={otherEmoji}
            onClose={() => setSelectedChatId(null)}
          />
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <AppShell>
      <ClientOnly
        fallback={<div className="h-full flex items-center justify-center bg-[#050507]"><span className="h-10 w-10 animate-pulse rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30" /></div>}
      >
        <MessagesContent />
      </ClientOnly>
    </AppShell>
  );
}