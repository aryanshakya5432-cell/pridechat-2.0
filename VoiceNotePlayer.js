"use client";

import { useRef, useState } from "react";

function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "0:00";
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function PlayIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

function PauseIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function WaveIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="4" y1="10" x2="4" y2="14" />
      <line x1="8" y1="7" x2="8" y2="17" />
      <line x1="12" y1="9" x2="12" y2="15" />
      <line x1="16" y1="6" x2="16" y2="18" />
      <line x1="20" y1="10" x2="20" y2="14" />
    </svg>
  );
}

/**
 * Sleek dark-glass audio player for voice notes stored as base64 data
 * URLs. Play/pause button, scrubbable gradient progress bar, and time
 * readout — no native controls.
 *
 * @param {{ src: string, className?: string }} props
 */
export default function VoiceNotePlayer({ src, className = "" }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveKey, setWaveKey] = useState(0);

  // Reset playback state during render whenever the underlying audio
  // changes (e.g. a new recording replaced the old one).
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch((err) => {
        console.error("Voice note playback failed:", err);
        setPlaying(false);
      });
    } else {
      audio.pause();
    }
  }

  function handleSeek(event) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const delta = event.key === "ArrowRight" ? 1 : -1;
      audio.currentTime = Math.min(duration, Math.max(0, audio.currentTime + delta));
      setCurrentTime(audio.currentTime);
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-md ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          setWaveKey((k) => k + 1);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className={`flex h-9 w-9 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
          playing
            ? "bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.8)]"
            : "bg-white/10 text-white/80 hover:bg-white/15"
        }`}
      >
        {playing ? (
          <PauseIcon className="h-3.5 w-3.5" />
        ) : (
          <PlayIcon className="ml-0.5 h-3.5 w-3.5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
            <WaveIcon
              key={waveKey}
              className={`h-3 w-3 shrink-0 text-indigo-300/80 ${
                playing ? "animate-pulse" : ""
              }`}
            />
            Voice note
          </span>
          <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-white/40">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Generous hit area for thumbs; the thin track sits inside. */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek voice note"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          onClick={handleSeek}
          onKeyDown={handleKeyDown}
          className="group mt-0.5 flex min-h-[32px] w-full cursor-pointer items-center py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          <div className="h-1.5 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400 transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
