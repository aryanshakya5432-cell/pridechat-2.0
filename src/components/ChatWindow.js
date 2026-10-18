"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

import { sendMessage, subscribeToMessages, markChatAsRead, deleteMessage } from "@/lib/chats";
import { getAvatarSizeClasses, profileEmojiFor, formatRelativeDate, getUserAvatar } from "@/lib/users";
import { uploadToImgbb } from "@/lib/imgbb";

function MessageBubble({ message, currentUid, currentUsername, mounted }) {
  const isMine = message.senderUid === currentUid;
  const relative = mounted && message.createdAt
    ? formatRelativeDate(message.createdAt).relative
    : "…";

  const otherAvatar = getUserAvatar({ avatarUrl: message.senderAvatarUrl, uid: message.senderUid, username: message.senderUsername });
  const myAvatar = getUserAvatar({ uid: currentUid, username: currentUsername });

  return (
    <div className={`flex gap-2 ${isMine ? "justify-end" : "justify-start"} animate-fade-in`}>
      {!isMine && (
        <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-xs ring-1 ring-white/20 ${getAvatarSizeClasses("xs")}`}>
          {otherAvatar.type === "image" ? <img src={otherAvatar.value} alt="" aria-hidden="true" className="rounded-full" style={{ objectFit: "cover" }} /> : otherAvatar.value}
        </span>
      )}
      <div className={`max-w-[75%] ${isMine ? "text-right" : ""}`}>
        {!isMine && <p className="text-xs text-white/50 mb-1">{message.senderUsername}</p>}
        {message.imageUrl && (
          <div className="mb-1">
            <img
              src={message.imageUrl}
              alt="Chat image"
              className="max-w-xs rounded-xl"
              loading="lazy"
            />
          </div>
        )}
        {message.audioData && (
          <VoiceNotePlayer src={message.audioData} className="mb-1" />
        )}
        {message.text && (
          <div
            className={`inline-block rounded-2xl px-4 py-2 text-sm ${isMine
              ? "bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white rounded-tr-none"
              : "bg-white/10 text-white rounded-tl-none"}`}
          >
            {message.text}
          </div>
        )}
        <p className={`text-[10px] text-white/30 mt-1 ${isMine ? "text-right" : ""}`}>
          {mounted && message.createdAt ? formatRelativeDate(message.createdAt).relative : "…"}
        </p>
      </div>
      {isMine && (
        <>
          <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-xs ring-1 ring-white/20 ${getAvatarSizeClasses("xs")}`}>
            {myAvatar.type === "image" ? <img src={myAvatar.value} alt="" aria-hidden="true" className="rounded-full" style={{ objectFit: "cover" }} /> : myAvatar.value}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(message.id);
            }}
            className="flex shrink-0 items-center justify-center w-7 h-7 rounded-full bg-white/5 text-white/40 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
            aria-label="Delete message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

function VoiceNotePlayer({ src, className }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  function handlePlayPause() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }

  function handleTimeUpdate(event) {
    setCurrentTime(event.currentTarget.currentTime);
  }

  function handleLoadedMetadata(event) {
    setDuration(event.currentTarget.duration);
  }

  function handleSeek(event) {
    if (!audioRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * duration;
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-md ${className}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
      <button
        type="button"
        onClick={handlePlayPause}
        disabled={!mounted || !duration}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className={`flex h-9 w-9 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${playing ? "bg-indigo-500/20 text-indigo-300" : "bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-white"}`}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 ml-1" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 ml-1" aria-hidden="true">
            <polygon points="5 3 19 12 5 21" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-indigo-300/80" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Voice note
          </span>
          <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-white/40">
            {mounted ? `${formatTime(currentTime)} / ${formatTime(duration)}` : "0:00 / 0:00"}
          </span>
        </div>

        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek voice note"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(duration > 0 ? (currentTime / duration) * 100 : 0)}
          onClick={handleSeek}
          className="group mt-0.5 flex min-h-[32px] w-full cursor-pointer items-center py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          <div className="h-1.5 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400 transition-[width] duration-100"
              style={{ width: `${Math.min(100, Math.max(0, (currentTime / (duration || 1)) * 100))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function EmojiPicker({ onSelect, onClose }) {
  const emojis = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
    "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
    "😋", "😛", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳",
    "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖",
    "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯",
    "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔",
    "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦",
    "😧", "😮", "😲", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢",
    "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹",
    "👺", "💀", "☠️", "👻", "👽", "👾", "🤖", "🎃", "😺", "😸",
    "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🙈", "🙉", "🙊",
    "💋", "💌", "💘", "💝", "💖", "💗", "💓", "💞", "💕", "💟",
    "❣️", "💔", "❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤",
    "🤍", "🤍", "💯", "💢", "💥", "💫", "💦", "💨", "🕳️", "💣",
    "💥", "💫", "💦", "💨", "🕳️", "💣", "🔥", "💧", "🌊", "🌈",
    "⚡", "⚡", "⚡", "⚡", "⚡", "⚡", "⚡", "⚡", "⚡", "⚡"
  ];

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 max-h-60 overflow-y-auto rounded-xl bg-white/5 border border-white/10 p-2 backdrop-blur-xl shadow-lg">
      <div className="grid grid-cols-8 gap-1">
        {emojis.map((emoji, index) => (
          <button
            key={index}
            type="button"
            onClick={() => { onSelect(emoji); onClose(); }}
            className="p-1.5 text-2xl hover:scale-125 transition-transform rounded"
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatWindow({ chatId, currentUser, otherUsername: otherUsernameProp, otherEmoji: otherEmojiProp, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioPreview, setAudioPreview] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [otherUsername, setOtherUsername] = useState(otherUsernameProp || "Someone");
  const [otherEmoji, setOtherEmoji] = useState(otherEmojiProp || "👤");
  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const currentUsername = currentUser.displayName || currentUser.email?.split("@")[0] || "Member";

  // Set mounted after first render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Subscribe to messages for selected chat
  useEffect(() => {
    if (!chatId) return;
    const unsubscribe = subscribeToMessages(
      chatId,
      setMessages,
      (err) => console.error("Messages subscription failed:", err)
    );
    markChatAsRead(chatId, currentUser.uid).catch(console.error);
    return () => unsubscribe();
  }, [chatId, currentUser.uid]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Recording timer
  useEffect(() => {
    if (recording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
        if (recordingTime >= 14) {
          handleStopRecording();
        }
      }, 1000);
    } else {
      clearInterval(recordingTimerRef.current);
    }
    return () => clearInterval(recordingTimerRef.current);
  }, [recording, recordingTime]);

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!newMessage.trim() && !imagePreview && !audioPreview) return;
    if (sending) return;

    setSending(true);
    try {
      const actorUsername = currentUser.displayName || currentUser.email?.split("@")[0] || "Member";
      await sendMessage(chatId, {
        senderUid: currentUser.uid,
        senderUsername: actorUsername,
        text: newMessage.trim(),
        imageUrl: imagePreview,
        audioData: audioPreview,
      });
      setNewMessage("");
      setImagePreview(null);
      setAudioPreview(null);
    } catch (err) {
      console.error("Send message failed:", err);
    } finally {
      setSending(false);
    }
  }

  async function onDelete(messageId) {
    try {
      await deleteMessage(chatId, messageId, currentUser.uid);
    } catch (err) {
      console.error("Delete message failed:", err);
    }
  }

  function handleEmojiSelect(emoji) {
    setNewMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  }

  function handleImageSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be smaller than 5MB");
      return;
    }

    setImagePreview(URL.createObjectURL(file));
    uploadToImgbb(file).then((result) => {
      // The URL will be used when sending
    });
  }

  function handleRemoveImage() {
    setImagePreview(null);
  }

  function handleStartRecording() {
    if (recording) return;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        audioRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        chunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          setAudioPreview(url);
        };

        mediaRecorderRef.current.start();
        setRecording(true);
        setRecordingTime(0);
      })
      .catch((err) => {
        console.error("Microphone access failed:", err);
        alert("Could not access microphone");
      });
  }

  function handleStopRecording() {
    if (!recording) return;
    mediaRecorderRef.current?.stop();
    audioRef.current?.getTracks().forEach((track) => track.stop());
    setRecording(false);
  }

  function handleRemoveAudio() {
    setAudioPreview(null);
  }

  function handleEmojiSelect(emoji) {
    setNewMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage(event);
    }
  }

  // ChatWindow always returns the full layout - header, messages, form
  return (
    <div className="h-full flex flex-col min-w-0 md:min-w-0">
      {/* Header (mobile) */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02] md:hidden">
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10"
          aria-label="Back to conversations"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <Link
          href="/messages"
          className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/5"
        >
          <span className="flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-xl ring-1 ring-white/20 h-12 w-12">
            👤
          </span>
          <div className="min-w-0">
            <p className="font-medium text-white truncate">{otherUsername || "Chat"}</p>
            <p className="text-xs text-white/40">Active now</p>
          </div>
        </Link>
      </header>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40 px-4 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 mb-3" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Say hello!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              currentUid={currentUser.uid}
              currentUsername={currentUser.displayName || currentUser.email?.split("@")[0] || "Member"}
              mounted={mounted}
              onDelete={onDelete}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Media preview */}
      {(imagePreview || audioPreview) && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-white/10 bg-white/[0.02]">
          {imagePreview && (
            <div className="relative flex items-center gap-2">
              <img src={imagePreview} alt="Preview" className="h-12 w-12 rounded-xl object-cover" />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600"
                aria-label="Remove image"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
          {audioPreview && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <VoiceNotePlayer src={audioPreview} />
              <button
                type="button"
                onClick={handleRemoveAudio}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600"
                aria-label="Remove voice note"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Message input - ALWAYS rendered at bottom */}
      <form onSubmit={handleSendMessage} className="flex-shrink-0 p-4 border-t border-white/10 bg-white/[0.02]">
        <div className="flex items-end gap-2">
          {/* Emoji picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Emoji picker"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M14 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                <path d="M8 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
              </svg>
            </button>
            {showEmojiPicker && (
              <EmojiPicker
                ref={emojiPickerRef}
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>

          {/* Image upload */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Attach image"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
          </div>

          {/* Voice recording */}
          <button
            type="button"
            onClick={recording ? handleStopRecording : handleStartRecording}
            disabled={sending}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
              recording
                ? "bg-rose-500/20 text-rose-400 animate-pulse"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
            aria-label={recording ? "Stop recording" : "Record voice note"}
          >
            {recording ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            )}
          </button>

          {/* Text input */}
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            disabled={sending}
            rows={1}
            maxLength={2000}
            className="flex-1 min-h-[44px] max-h-32 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400/50 focus:bg-white/10 disabled:opacity-60 resize-none"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={!newMessage.trim() && !imagePreview && !audioPreview || sending}
            className="shrink-0 min-h-[44px] min-w-[44px] rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_-6px_rgba(124,58,237,0.6)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(124,58,237,0.8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}