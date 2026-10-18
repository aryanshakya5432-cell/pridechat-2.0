"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import AppShell, { useAppUser } from "@/components/AppShell";
import { updateUserProfile, subscribeToUserProfile } from "@/lib/users";
import { uploadToImgbb } from "@/lib/imgbb";

function ArrowLeftIcon({ className }) {
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
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function CameraIcon({ className }) {
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
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function ProfileEditContent() {
  const user = useAppUser();
  const router = useRouter();

  // Initialize state; will be updated by real-time subscription
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Real-time subscription for user profile (bio, avatar)
  useEffect(() => {
    const unsubscribe = subscribeToUserProfile(
      user.uid,
      (data) => {
        if (data?.bio !== undefined) setBio(data.bio || "");
        if (data?.avatarUrl !== undefined) setAvatarPreview(data.avatarUrl || null);
      },
      (err) => console.warn("User profile subscription failed:", err)
    );
    return () => unsubscribe();
  }, [user.uid]);

  function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB.");
      return;
    }
    setError(null);
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let avatarUrl = avatarPreview || null;
      if (avatarFile) {
        const result = await uploadToImgbb(avatarFile);
        avatarUrl = result.url;
      }
      await updateUserProfile(user.uid, { bio: bio.trim() || "", avatarUrl });
      setSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (err) {
      console.error("Save profile failed:", err);
      setError("Couldn't save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    router.back();
  }

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-8 flex items-center gap-4">
        <button
          type="button"
          onClick={handleCancel}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Profile</h1>
      </header>

      {success && (
        <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" role="alert">
          Profile saved!
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
          {error}
        </div>
      )}

      <section className="space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-4">
          <span
            className={`relative flex shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-6xl ring-1 ring-white/20 h-28 w-28 overflow-hidden ${avatarPreview ? "bg-transparent" : ""}`}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">👤</span>
            )}
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 h-10 w-10 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center cursor-pointer transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507]"
              aria-label="Change avatar"
            >
              <CameraIcon className="h-5 w-5 text-white" />
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="sr-only"
              />
            </label>
          </span>
          <p className="text-sm text-white/50">Tap the camera icon to change your avatar</p>
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-white/70 mb-2">
            About Me
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={200}
            rows={4}
            placeholder="Tell us about yourself…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400/50 focus:bg-white/10 resize-none"
          />
          <p className="mt-1 text-right text-xs text-white/40">{bio.length}/200</p>
        </div>

        {/* Save button */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition duration-300 hover:border-white/30 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(124,58,237,0.7)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-10px_rgba(124,58,237,0.85)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function ProfileEditPage() {
  return (
    <AppShell>
      <ProfileEditContent />
    </AppShell>
  );
}