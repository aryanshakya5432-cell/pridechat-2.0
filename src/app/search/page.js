"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import AppShell from "@/components/AppShell";
import { subscribeToUserSearch } from "@/lib/users";

const inputClasses =
  "w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder-white/30 outline-none transition duration-300 focus:border-indigo-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-indigo-500/25";

function SearchIcon({ className }) {
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
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.2" y2="16.2" />
    </svg>
  );
}

function ChevronIcon({ className }) {
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
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 backdrop-blur-xl"
        >
          <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded-full bg-white/10" />
            <div className="h-2.5 w-48 animate-pulse rounded-full bg-white/[0.07]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SearchPage() {
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [users, setUsers] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce keystrokes so we don't query Firestore on every character.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), 250);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    const unsubscribe = subscribeToUserSearch(
      debouncedTerm,
      (foundUsers) => {
        setUsers(foundUsers);
        setSearchError(null);
      },
      (error) => {
        console.error("User search failed:", error);
        setSearchError("Search is unavailable right now. Please try again.");
        setUsers((prev) => prev ?? []);
      },
    );
    return () => unsubscribe();
  }, [debouncedTerm]);

  const searching = debouncedTerm.trim().length > 0;

  return (
    <AppShell>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="mt-1 text-sm text-white/50">
          Find people on PRIDE CHAT by their username.
        </p>
      </header>

      <div className="relative mt-6">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-white/30" />
        <input
          ref={inputRef}
          type="search"
          name="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search by username…"
          autoComplete="off"
          className={inputClasses}
        />
      </div>

      {searchError ? (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {searchError}
        </p>
      ) : null}

      {/* Loading skeleton */}
      {users === null && !searchError ? (
        <section aria-busy="true" aria-label="Searching" className="mt-6">
          <ResultSkeleton />
        </section>
      ) : null}

      {/* Empty: no results */}
      {users !== null && users.length === 0 && !searchError ? (
        <section className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />
          <h2 className="text-lg font-semibold tracking-tight">
            {searching
              ? `No one matched “${debouncedTerm.trim()}”`
              : "No users yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/50">
            {searching
              ? "Try a different spelling or a shorter username."
              : "Once people join PRIDE CHAT, they'll show up here."}
          </p>
        </section>
      ) : null}

      {/* Results */}
      {users !== null && users.length > 0 ? (
        <section aria-label="Search results" className="mt-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-white/40">
            {searching ? "Results" : "People"}
          </p>
          <ul className="space-y-3">
            {users.map((found) => {
              const uid = found.uid || found.id;
              const displayName = found.username || "Member";
              return (
                <li key={uid}>
                  <Link
                    href={`/profile/${uid}`}
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 backdrop-blur-xl transition duration-300 hover:border-indigo-400/40 hover:bg-white/[0.08]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 text-lg ring-1 ring-white/20">
                      {found.emoji || "✨"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold tracking-tight text-white">
                        {displayName}
                      </p>
                      {found.email ? (
                        <p className="truncate text-xs text-white/40">
                          {found.email}
                        </p>
                      ) : null}
                    </div>
                    <ChevronIcon className="h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-indigo-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
