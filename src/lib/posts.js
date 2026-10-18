import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/firebase";
import { createNotification } from "@/lib/users";

/**
 * Subscribes to the post feed in real time (newest first).
 *
 * @param {(posts: Array<{ id: string } & Record<string, unknown>>) => void} onPosts
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToFeed(onPosts, onError) {
  const postsQuery = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    postsQuery,
    (snapshot) => {
      const posts = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      onPosts(posts);
    },
    onError,
  );
}

/**
 * Subscribes to a single user's posts in real time, newest first.
 *
 * The `userId` equality filter uses Firestore's automatic single-field
 * index; sorting happens client-side so no composite index is required.
 *
 * @param {string} userId
 * @param {(posts: Array<{ id: string } & Record<string, unknown>>) => void} onPosts
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToUserPosts(userId, onPosts, onError) {
  const userPostsQuery = query(
    collection(db, "posts"),
    where("userId", "==", userId),
  );

  return onSnapshot(
    userPostsQuery,
    (snapshot) => {
      const posts = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
        );
      onPosts(posts);
    },
    onError,
  );
}

/**
 * Toggles a user's like on a post by adding/removing their uid in the
 * `likes` array (atomic on the server, safe under concurrent clicks).
 * Creates a notification for the post owner when liked.
 *
 * @param {string} postId
 * @param {string} uid - The UID of the user liking/unliking
 * @param {string} username - The username of the user liking/unliking
 * @param {string} avatarUrl - The avatar URL of the user liking
 * @param {boolean} hasLiked - Whether the user currently likes the post.
 * @returns {Promise<void>}
 */
export async function toggleLike(postId, uid, username, avatarUrl, hasLiked) {
  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);

  if (!postSnap.exists()) return;

  const postData = postSnap.data();
  const postOwnerUid = postData.userId;

  await updateDoc(postRef, {
    likes: hasLiked ? arrayRemove(uid) : arrayUnion(uid),
  });

  // Create notification for post owner when liked (not when unliked)
  if (!hasLiked && postOwnerUid !== uid) {
    await createNotification(postOwnerUid, {
      type: "like",
      actorUid: uid,
      actorUsername: username,
      actorAvatarUrl: avatarUrl,
      postId,
    });
  }
}

/**
 * Deletes a post document from the `posts` collection.
 *
 * @param {string} postId
 * @returns {Promise<void>}
 */
export async function deletePost(postId) {
  await deleteDoc(doc(db, "posts", postId));
}

/**
 * Creates a post document in the Firestore `posts` collection.
 *
 * @param {{ userId: string, username: string, imageUrl: string, caption: string, audioData?: string|null, avatarUrl?: string|null }} post
 * @returns {Promise<string>} The id of the created document.
 */
export async function createPost({
  userId,
  username,
  imageUrl,
  caption,
  audioData = null,
  avatarUrl = null,
}) {
  const postsRef = collection(db, "posts");

  const docRef = await addDoc(postsRef, {
    userId,
    username,
    imageUrl,
    caption,
    audioData,
    avatarUrl,
    createdAt: serverTimestamp(),
    likes: [],
  });

  return docRef.id;
}

/**
 * Adds a comment to a post's `comments` sub-collection.
 * Creates a notification for the post owner.
 *
 * @param {string} postId
 * @param {{ userId: string, username: string, text: string, avatarUrl?: string }} comment
 * @returns {Promise<string>} The id of the created comment document.
 */
export async function createComment(postId, { userId, username, text, avatarUrl }) {
  const commentsRef = collection(db, "posts", postId, "comments");
  const docRef = await addDoc(commentsRef, {
    userId,
    username,
    text,
    createdAt: serverTimestamp(),
  });

  // Get post owner to notify
  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);
  if (postSnap.exists()) {
    const postData = postSnap.data();
    const postOwnerUid = postData.userId;
    if (postOwnerUid !== userId) {
      await createNotification(postOwnerUid, {
        type: "comment",
        actorUid: userId,
        actorUsername: username,
        actorAvatarUrl: avatarUrl,
        postId,
      });
    }
  }

  return docRef.id;
}

/**
 * Subscribes to a post's comments in real time (oldest first).
 *
 * @param {string} postId
 * @param {(comments: Array<{ id: string } & Record<string, unknown>>) => void} onComments
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToComments(postId, onComments, onError) {
  if (!postId) return () => {};
  const commentsQuery = query(
    collection(db, "posts", postId, "comments"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(
    commentsQuery,
    (snapshot) => {
      const comments = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      onComments(comments);
    },
    onError,
  );
}