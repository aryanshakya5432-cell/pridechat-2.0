"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { auth } from "@/firebase";
import { ensureUserDoc, profileEmojiFor, getUserAvatar, getAvatarSizeClasses, getUserDoc, subscribeToUnreadNotificationCount } from "@/lib/users";

const AppUserContext = createContext(null);

/** Returns the signed-in Firebase user (guaranteed non-null inside AppShell). */
export function useAppUser() {
  return useContext(AppUserContext);
}

function IconBase({ children, className = "h-5 w-5" }) {
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
      {children}
    </svg>
  );
}

function LogoIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H12l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" />
    </IconBase>
  );
}

function HomeIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </IconBase>
  );
}

function CreateIcon({ className }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.5v7M8.5 12h7" />
    </IconBase>
  );
}

function ProfileIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </IconBase>
  );
}

function SearchIcon({ className }) {
  return (
    <IconBase className={className}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.2" y2="16.2" />
    </IconBase>
  );
}

function LogoutIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </IconBase>
  );
}

function MessageSquareIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </IconBase>
  );
}

function BellIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </IconBase>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/search", label: "Search", icon: SearchIcon },
  { href: "/create", label: "Create Post", icon: CreateIcon, mobileLabel: "Post" },
  { href: "/messages", label: "Messages", icon: MessageSquareIcon, mobileLabel: "Chat" },
  { href: "/profile", label: "Profile", icon: ProfileIcon },
];

export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace("/login");
        return;
      }
      setUser(firebaseUser);

      // Backfill the users/{uid} doc so this account is searchable.
      // Non-fatal: the app works fine even if this write fails.
      ensureUserDoc(firebaseUser).catch((err) => {
        console.warn("User doc backfill failed:", err);
      });

      // Fetch full profile for avatar/bio
      try {
        const profile = await getUserDoc(firebaseUser.uid);
        setUserProfile(profile);
      } catch (err) {
        console.warn("User profile fetch failed:", err);
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Subscribe to unread notification count
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUnreadNotificationCount(user.uid, setUnreadCount);
    return () => unsubscribe();
  }, [user?.uid]);

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
      return;
    }
    router.replace("/login");
  }

  // Auth still resolving — show a lightweight splash, never the protected UI.
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050507]">
        <span className="h-10 w-10 animate-pulse rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30" />
      </div>
    );
  }

  const displayName =
    user.displayName || user.email?.split("@")[0] || "Member";
  const email = user.email || "";
  const avatar = userProfile ? getUserAvatar({ avatarUrl: userProfile.avatarUrl, uid: user.uid, username: userProfile.username, emoji: userProfile.emoji }) : { type: "emoji", value: profileEmojiFor(user.uid) };

  return (
    <AppUserContext.Provider value={user}>
      <div className="min-h-screen bg-[#050507] text-white">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl md:flex">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25">
              <LogoIcon className="h-5 w-5 text-white" />
            </span>
            <span className="text-[15px] font-bold tracking-[0.12em]">
              PRIDE CHAT
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className="mt-6 flex flex-1 flex-col gap-1"
          >
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/" && pathname.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200 ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/55 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute -left-4 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-indigo-400 to-fuchsia-400"
                    />
                  )}
                  <Icon
                    className={`h-5 w-5 ${
                      active
                        ? "text-indigo-300"
                        : "text-white/45 group-hover:text-white/80"
                    }`}
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 pt-4">
            {/* Notifications bell (desktop sidebar) */}
            <Link
              href="/notifications"
              className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/55 transition duration-200 hover:bg-white/5 hover:text-white"
            >
              <BellIcon className="h-5 w-5 text-white/45 group-hover:text-indigo-300" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-h-[18px] min-w-[18px] flex items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/55 transition duration-200 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <LogoutIcon className="h-5 w-5 text-white/45 group-hover:text-rose-300" />
              Logout
            </button>

            <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-base ring-1 ring-white/20 ${getAvatarSizeClasses("default")}`}>
                {avatar.type === "image" ? (
                  <img src={avatar.value} alt="" aria-hidden="true" className="rounded-full" style={{ objectFit: "cover" }} />
                ) : (
                  avatar.value
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {displayName}
                </p>
                {email && (
                  <p className="truncate text-xs text-white/40">{email}</p>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="md:pl-64">
          <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(7rem_+_env(safe-area-inset-bottom))] pt-8 md:pb-16 md:pt-10">
            {children}
          </main>
        </div>

        {/* Mobile bottom navigation (iOS/Android safe-area aware) */}
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-[#050507]/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        >
          {NAV_ITEMS.map(({ href, label, mobileLabel, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium transition ${
                  active ? "text-white" : "text-white/50"
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400"
                  />
                )}
                <Icon
                  className={`h-5 w-5 ${active ? "text-indigo-300" : ""}`}
                />
                {mobileLabel || label}
              </Link>
            );
          })}

          {/* Notifications bell (mobile bottom nav) */}
          <Link
            href="/notifications"
            className="relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium transition text-white/50"
          >
            <BellIcon className="h-5 w-5" />
            Notifs
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-h-[16px] min-w-[16px] flex items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-1 py-0.5 text-[9px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </AppUserContext.Provider>
  );
}
