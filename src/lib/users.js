import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/firebase";

/**
 * Curated emoji pool for profile avatars. The pool is pride-themed and
 * playful — every user gets a stable one derived from their UID.
 */
const PROFILE_EMOJIS = [
  "🦊", "🐼", "🦁", "🐯", "🐰", "🦄", "🐸", "🐨",
  "🐳", "🦅", "🦉", "🦋", "🐝", "🐬", "🦈", "🦜",
  "🌸", "🌿", "🍀", "🌙", "⭐", "🔥", "💎", "🌈",
  "🎨", "🎭", "🎸", "🚀", "☀️", "🌊", "🍭", "🍉",
];

/**
 * Deterministically maps any seed string (UID, username, …) to a stable
 * profile emoji. Same seed → same emoji, on every device, forever.
 *
 * @param {string} [seed]
 * @returns {string} One emoji from the pool.
 */
export function profileEmojiFor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PROFILE_EMOJIS[hash % PROFILE_EMOJIS.length];
}

/**
 * Formats a Firestore timestamp into a friendly relative label
 * (e.g. "just now", "5m ago", "3h ago", "2d ago").
 *
 * @param {firebase.firestore.Timestamp|Date|null} createdAt
 * @returns {{ relative: string, absolute: string }}
 */
export function formatRelativeDate(createdAt) {
  if (!createdAt || typeof createdAt.toDate !== "function") {
    return { relative: "just now", absolute: "" };
  }

  const date = createdAt.toDate();
  const absolute = date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return { relative: "just now", absolute };
  if (minutes < 60) return { relative: `${minutes}m ago`, absolute };

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { relative: `${hours}h ago`, absolute };

  const days = Math.floor(hours / 24);
  if (days < 7) return { relative: `${days}d ago`, absolute };

  return {
    relative: date.toLocaleDateString(undefined, { dateStyle: "medium" }),
    absolute,
  };
}

/**
 * Ensures a `users/{uid}` document exists for the signed-in user so they
 * are discoverable via search. Idempotent — does nothing if the doc is
 * already there. Failures are non-fatal (the rest of the app works
 * without the doc), so callers can safely fire-and-forget.
 *
 * @param {{ uid: string, displayName?: string|null, email?: string|null }} user
 * @returns {Promise<void>}
 */
export async function ensureUserDoc(user) {
  if (!user?.uid) return;

  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) return;

  const username = user.displayName || user.email?.split("@")[0] || "Member";

  await setDoc(userRef, {
    uid: user.uid,
    username,
    usernameLower: username.toLowerCase(),
    email: user.email || "",
    emoji: profileEmojiFor(user.uid),
    createdAt: serverTimestamp(),
  });
}

/**
 * Fetches a single `users/{uid}` document once.
 *
 * @param {string} userId
 * @returns {Promise<Record<string, unknown>|null>} The doc data, or null if missing.
 */
export async function getUserDoc(userId) {
  if (!userId) return null;
  const snap = await getDoc(doc(db, "users", userId));
  return snap.exists() ? snap.data() : null;
}

/**
 * Subscribes to user search results in real time.
 *
 * - With a search term: prefix match on `usernameLower` (Firestore range
 *   scan on the automatic single-field index — no composite index needed).
 * - With an empty term: the newest 20 signed-up users, for discovery.
 *
 * @param {string} term
 * @param {(users: Array<Record<string, unknown>>) => void} onUsers
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToUserSearch(term, onUsers, onError) {
  const usersRef = collection(db, "users");
  const normalized = term.trim().toLowerCase();

  const usersQuery = normalized
    ? query(
        usersRef,
        where("usernameLower", ">=", normalized),
        where("usernameLower", "<=", normalized + "\uf8ff"),
      )
    : query(usersRef, orderBy("createdAt", "desc"), limit(20));

  return onSnapshot(
    usersQuery,
    (snapshot) => {
      onUsers(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    },
    onError,
  );
}

/**
 * Subscribes to a single user's profile document in real time.
 *
 * @param {string} uid
 * @param {(data: Record<string, unknown> | null) => void} onProfile
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToUserProfile(uid, onProfile, onError) {
  if (!uid) return () => {};
  const userRef = doc(db, "users", uid);
  return onSnapshot(
    userRef,
    (snapshot) => {
      onProfile(snapshot.exists() ? snapshot.data() : null);
    },
    onError,
  );
}

/**
 * Updates the current user's profile document with bio and/or avatarUrl.
 * Uses setDoc with merge:true to create the document if it doesn't exist.
 *
 * @param {string} uid
 * @param {{ bio?: string, avatarUrl?: string }} data
 * @returns {Promise<void>}
 */
export async function updateUserProfile(uid, { bio, avatarUrl }) {
  if (!uid) return;
  const userRef = doc(db, "users", uid);
  const updateData = {};
  if (bio !== undefined) updateData.bio = bio;
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
  if (Object.keys(updateData).length === 0) return;
  await setDoc(userRef, updateData, { merge: true });
}

/**
 * Returns the display avatar for a user: custom avatarUrl if present,
 * otherwise the deterministic emoji.
 *
 * @param {{ avatarUrl?: string, uid?: string, username?: string }} user
 * @returns {{ type: 'emoji'|'image', value: string }}
 */
export function getUserAvatar(user) {
  if (user?.avatarUrl) return { type: "image", value: user.avatarUrl };
  const seed = user?.uid || user?.username || "";
  return { type: "emoji", value: profileEmojiFor(seed) };
}

/**
 * Returns the Tailwind size classes for an avatar.
 *
 * @param {string} [size="default"] - "xs" | "sm" | "default" | "lg" | "xl"
 * @returns {string}
 */
export function getAvatarSizeClasses(size = "default") {
  return {
    xs: "h-6 w-6 text-xs",
    sm: "h-8 w-8 text-base",
    default: "h-10 w-10 text-lg",
    lg: "h-12 w-12 text-xl",
    xl: "h-20 w-20 text-4xl",
  }[size];
}

/**
 * Creates a notification for a user.
 *
 * @param {string} targetUid - The user who should receive the notification
 * @param {{
 *   type: 'like' | 'comment' | 'message',
 *   actorUid: string,
 *   actorUsername: string,
 *   actorAvatarUrl?: string,
 *   postId?: string,
 *   chatId?: string,
 *   messagePreview?: string,
 * }} payload
 * @returns {Promise<string>} The notification document ID
 */
export async function createNotification(targetUid, payload) {
  if (!targetUid || !payload) return;
  if (targetUid === payload.actorUid) return; // Don't notify yourself

  const notificationsRef = collection(db, "users", targetUid, "notifications");
  const docRef = await addDoc(notificationsRef, {
    ...payload,
    read: false,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Subscribes to a user's notifications in real time (newest first).
 *
 * @param {string} uid
 * @param {(notifications: Array<{ id: string } & Record<string, unknown>>) => void} onNotifications
 * @param {(error: Error) => void} [onError]
 * @param {number} [limitCount=20]
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToNotifications(uid, onNotifications, onError, limitCount = 20) {
  if (!uid) return () => {};
  const notificationsQuery = query(
    collection(db, "users", uid, "notifications"),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const notifications = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      onNotifications(notifications);
    },
    onError,
  );
}

/**
 * Marks a notification as read.
 *
 * @param {string} uid
 * @param {string} notificationId
 * @returns {Promise<void>}
 */
export async function markNotificationAsRead(uid, notificationId) {
  if (!uid || !notificationId) return;
  const notificationRef = doc(db, "users", uid, "notifications", notificationId);
  await updateDoc(notificationRef, { read: true });
}

/**
 * Marks all notifications as read for a user.
 *
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function markAllNotificationsAsRead(uid) {
  if (!uid) return;
  // For simplicity, we'll just fetch and update each unread notification
  // In production, a batch write or cloud function would be more efficient
  const notificationsRef = collection(db, "users", uid, "notifications");
  const unreadQuery = query(notificationsRef, where("read", "==", false));
  const snapshot = await getDocs(unreadQuery);
  const batch = [];
  snapshot.docs.forEach((docSnap) => {
    batch.push(updateDoc(docSnap.ref, { read: true }));
  });
  await Promise.all(batch);
}

/**
 * Gets the unread notification count for a user.
 *
 * @param {string} uid
 * @param {(count: number) => void} onCount
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToUnreadNotificationCount(uid, onCount) {
  if (!uid) return () => {};
  const notificationsRef = collection(db, "users", uid, "notifications");
  const unreadQuery = query(notificationsRef, where("read", "==", false));

  return onSnapshot(
    unreadQuery,
    (snapshot) => {
      onCount(snapshot.size);
    },
    (err) => {
      console.error("Unread count subscription failed:", err);
      onCount(0);
    },
  );
}
