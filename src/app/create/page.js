"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

import AppShell, { useAppUser } from "@/components/AppShell";
import VoiceNotePlayer from "@/components/VoiceNotePlayer";
import { auth } from "@/firebase";
import { uploadToImgbb } from "@/lib/imgbb";
import { createPost } from "@/lib/posts";
import { getUserDoc } from "@/lib/users";

const MAX_IMAGE_BYTES = 32 * 1024 * 1024; // ImgBB's free upload limit
const MAX_CAPTION_LENGTH = 500;
const MAX_RECORD_SECONDS = 15;

const inputClasses =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition duration-300 focus:border-indigo-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-60";

const labelClasses =
  "text-xs font-medium uppercase tracking-[0.18em] text-white/40";

function ImageIcon({ className }) {
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

function MicIcon({ className }) {
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
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function StopIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" />
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
    </svg>
  );
}

const STATUS_LABELS = {
  idle: "Share post",
  uploading: "Uploading image…",
  publishing: "Publishing…",
  done: "Published!",
};

function formatRecordTime(seconds) {
  const clamped = Math.max(0, Math.min(MAX_RECORD_SECONDS, seconds));
  return `0:${String(clamped).padStart(2, "0")}`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error("Couldn't read the recorded audio."));
    reader.readAsDataURL(blob);
  });
}

export default function CreatePostPage() {
  const ctxUser = useAppUser();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(ctxUser);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");

  // Voice note recording state
  const [recState, setRecState] = useState("idle"); // idle | recording | processing | recorded
  const [recSeconds, setRecSeconds] = useState(0);
  const [audioData, setAudioData] = useState(null); // base64 data URL
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recTimerRef = useRef(null);
  const maxTimerRef = useRef(null);

  useEffect(() => {
    if (ctxUser !== user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional to sync context user
      setUser(ctxUser);
    }
  }, [ctxUser, user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      }
    });
    return () => unsubscribe();
  }, []);

  // Revoke the object URL whenever the preview changes or the page unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Stop the mic + timers if the page unmounts mid-recording.
  useEffect(() => {
    return () => {
      clearInterval(recTimerRef.current);
      clearTimeout(maxTimerRef.current);
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopTimers() {
    clearInterval(recTimerRef.current);
    clearTimeout(maxTimerRef.current);
  }

  async function handleRecordClick() {
    if (recState === "processing") return;

    // Recording → stop now (the onstop handler finishes the pipeline).
    if (recState === "recording") {
      recorderRef.current?.stop();
      setRecState("processing");
      return;
    }

    // Idle or recorded → start a fresh recording, replacing any old one.
    setError(null);
    setAudioData(null);
    setRecSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stopTimers();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        try {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          chunksRef.current = [];
          const base64 = await blobToBase64(blob);
          setAudioData(base64);
          setRecState("recorded");
        } catch (err) {
          console.error("Voice note conversion failed:", err);
          setError("Couldn't save the voice note. Please try again.");
          setRecState("idle");
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecState("recording");

      recTimerRef.current = setInterval(() => {
        setRecSeconds((previous) => {
          const next = previous + 1;
          return next > MAX_RECORD_SECONDS ? MAX_RECORD_SECONDS : next;
        });
      }, 1000);

      // Hard cap: auto-stop at 15 seconds.
      maxTimerRef.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
          setRecState("processing");
        }
      }, MAX_RECORD_SECONDS * 1000);
    } catch (err) {
      console.error("Microphone access failed:", err);
      setError(
        "Couldn't access your microphone. Please allow mic permission and try again.",
      );
      setRecState(audioData ? "recorded" : "idle");
    }
  }

  function handleDiscardRecording() {
    setAudioData(null);
    setRecSeconds(0);
    setRecState("idle");
  }

  const busy = status === "uploading" || status === "publishing";

  function handleFileChange(event) {
    const selected = event.target.files?.[0];
    if (!selected) {
      return;
    }

    if (!selected.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (selected.size > MAX_IMAGE_BYTES) {
      setError("Image must be 32 MB or smaller.");
      return;
    }

    setError(null);
    setFile(selected);
    setPreviewUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return URL.createObjectURL(selected);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const currentUser = user || auth.currentUser;

    if (!file) {
      setError("Choose an image to share.");
      return;
    }
    if (!currentUser) {
      setError("You must be signed in to post.");
      return;
    }

    setStatus("uploading");

    try {
      const imageUrl = await uploadToImgbb(file);

      setStatus("publishing");
      const poster = user || auth.currentUser;
      
      // Fetch avatarUrl for the post
      let avatarUrl = null;
      try {
        const userProfile = await getUserDoc(poster.uid);
        avatarUrl = userProfile?.avatarUrl || null;
      } catch (err) {
        console.warn("Could not fetch avatar for post:", err);
      }

      await createPost({
        userId: poster.uid,
        username: poster.displayName || poster.email?.split("@")[0] || "Member",
        imageUrl,
        caption: caption.trim(),
        audioData: audioData || null,
        avatarUrl,
      });

      setStatus("done");
      router.push("/");
    } catch (err) {
      console.error("Publish failed:", err);
      setError(
        err?.message || "Something went wrong while posting. Please try again.",
      );
      setStatus("idle");
    }
  }

  return (
    <AppShell>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Create Post</h1>
        <p className="mt-1 text-sm text-white/50">
          Share a photo with a caption — it&apos;ll appear in your feed.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-8"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm leading-snug text-rose-200"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4.5M12 16h.01" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={busy}
          className="hidden"
        />

        {previewUrl ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote image */}
            <img
              src={previewUrl}
              alt="Selected image preview"
              className="max-h-96 w-full object-contain"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="absolute bottom-3 right-3 min-h-[44px] rounded-lg border border-white/20 bg-black/60 px-4 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-60"
            >
              Change image
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center transition duration-300 hover:border-indigo-400/50 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:opacity-60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 text-indigo-300">
              <ImageIcon className="h-6 w-6" />
            </span>
            <span className="text-sm font-medium text-white/80">
              Choose an image
            </span>
            <span className="text-xs text-white/40">
              PNG, JPG, GIF or WebP · up to 32 MB
            </span>
          </button>
        )}

        {/* Voice note recorder */}
        <div className="mt-6">
          <span className={labelClasses}>Voice note</span>

          {recState === "recorded" && audioData ? (
            <div className="mt-2 flex items-center gap-2">
              <VoiceNotePlayer src={audioData} className="min-w-0 flex-1" />
              <button
                type="button"
                onClick={handleDiscardRecording}
                disabled={busy}
                aria-label="Remove voice note"
                title="Remove voice note"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/40 transition duration-300 hover:border-rose-400/40 hover:text-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 disabled:opacity-60"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRecordClick}
              disabled={busy || recState === "processing"}
              className={`mt-2 flex w-full items-center justify-center gap-3 rounded-2xl border px-6 py-4 text-sm font-medium transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 disabled:opacity-60 ${
                recState === "recording"
                  ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                  : "border-white/15 bg-white/[0.03] text-white/70 hover:border-indigo-400/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              {recState === "recording" ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                  </span>
                  <span className="tabular-nums">
                    Recording… {formatRecordTime(recSeconds)} /{" "}
                    {formatRecordTime(MAX_RECORD_SECONDS)}
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white">
                    <StopIcon className="h-3 w-3" />
                  </span>
                </>
              ) : recState === "processing" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving voice note…
                </>
              ) : (
                <>
                  <MicIcon className="h-4.5 w-4.5 text-indigo-300" />
                  Add a voice note (optional, up to 15s)
                </>
              )}
            </button>
          )}
        </div>

        <label className="mt-6 block">
          <span className={labelClasses}>Caption</span>
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={MAX_CAPTION_LENGTH}
            rows={4}
            disabled={busy}
            placeholder="What's the story behind this photo?"
            className={`${inputClasses} mt-2 resize-none`}
          />
          <span className="mt-1.5 block text-right text-xs tabular-nums text-white/35">
            {caption.length}/{MAX_CAPTION_LENGTH}
          </span>
        </label>

        <button
          type="submit"
          disabled={busy || status === "done"}
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(124,58,237,0.7)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-10px_rgba(124,58,237,0.85)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {busy && (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden="true"
            />
          )}
          {STATUS_LABELS[status]}
        </button>
      </form>
    </AppShell>
  );
}
