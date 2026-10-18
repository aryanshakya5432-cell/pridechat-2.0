import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
 * Generates a deterministic chat ID for two users.
 * Always returns the same ID regardless of order.
 */
function getChatId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

/**
 * Gets or creates a 1-on-1 chat between two users.
 *
 * @param {string} currentUid - The current user's UID
 * @param {string} otherUid - The other user's UID
 * @param {{ currentUsername: string, otherUsername: string }} usernames
 * @returns {Promise<string>} The chat document ID
 */
export async function getOrCreateChat(currentUid, otherUid, { currentUsername, otherUsername }) {
  if (!currentUid || !otherUid) throw new Error("Missing UIDs");
  if (currentUid === otherUid) throw new Error("Cannot create chat with yourself");

  const chatId = getChatId(currentUid, otherUid);
  const chatRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    await setDoc(chatRef, {
      participantUids: [currentUid, otherUid],
      participantUsernames: {
        [currentUid]: currentUsername,
        [otherUid]: otherUsername,
      },
      lastMessage: null,
      lastMessageAt: serverTimestamp(),
      unreadCounts: {
        [currentUid]: 0,
        [otherUid]: 0,
      },
      createdAt: serverTimestamp(),
    });
  }

  return chatId;
}

/**
 * Sends a message with optional media (image, voice note) in a chat.
 *
 * @param {string} chatId
 * @param {{ senderUid: string, senderUsername: string, text: string, imageUrl?: string, audioData?: string }} message
 * @returns {Promise<string>} The message document ID
 */
export async function sendMessage(chatId, { senderUid, senderUsername, text, imageUrl, audioData }) {
  if (!chatId || !senderUid || (!text.trim() && !imageUrl && !audioData)) return;

  const messagesRef = collection(db, "chats", chatId, "messages");
  const messageData = {
    senderUid,
    senderUsername,
    text: text.trim(),
    createdAt: serverTimestamp(),
  };

  if (imageUrl) messageData.imageUrl = imageUrl;
  if (audioData) messageData.audioData = audioData;

  const messageRef = await addDoc(messagesRef, messageData);

  // Update chat document with last message info and increment unread count for other participant
  const chatRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatRef);
  if (chatSnap.exists()) {
    const data = chatSnap.data();
    const otherUid = data.participantUids.find((uid) => uid !== senderUid);
    const unreadCounts = { ...data.unreadCounts };
    if (otherUid) {
      unreadCounts[otherUid] = (unreadCounts[otherUid] || 0) + 1;
    }
    const lastMessagePreview = text.trim() || (imageUrl ? "📷 Photo" : audioData ? "🎤 Voice note" : "");
    await updateDoc(chatRef, {
      lastMessage: lastMessagePreview,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderUid: senderUid,
      unreadCounts,
    });
  }

  return messageRef.id;
}

/**
 * Deletes a message from a chat (unsend feature).
 * Only the sender can delete their own message.
 *
 * @param {string} chatId
 * @param {string} messageId
 * @param {string} requesterUid - The UID of the user requesting deletion
 * @returns {Promise<void>}
 */
export async function deleteMessage(chatId, messageId, requesterUid) {
  if (!chatId || !messageId || !requesterUid) return;

  const messageRef = doc(db, "chats", chatId, "messages", messageId);
  const messageSnap = await getDoc(messageRef);

  if (!messageSnap.exists()) {
    throw new Error("Message not found");
  }

  const messageData = messageSnap.data();
  if (messageData.senderUid !== requesterUid) {
    throw new Error("You can only delete your own messages");
  }

  await deleteDoc(messageRef);

  // Optionally update the chat's lastMessage if it was the deleted message
  // This is a simplified approach - in production you might want to fetch the new last message
}

/**
 * Marks all messages in a chat as read for the current user.
 *
 * @param {string} chatId
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function markChatAsRead(chatId, uid) {
  if (!chatId || !uid) return;
  const chatRef = doc(db, "chats", chatId);
  await updateDoc(chatRef, {
    [`unreadCounts.${uid}`]: 0,
  });
}

/**
 * Subscribes to messages in a chat in real time (oldest first).
 *
 * @param {string} chatId
 * @param {(messages: Array<{ id: string } & Record<string, unknown>>) => void} onMessages
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToMessages(chatId, onMessages, onError) {
  if (!chatId) return () => {};
  const messagesQuery = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      onMessages(messages);
    },
    onError,
  );
}

/**
 * Subscribes to a user's chat list in real time.
 * Returns chats where the user is a participant, ordered by lastMessageAt desc.
 *
 * @param {string} uid
 * @param {(chats: Array<{ id: string } & Record<string, unknown>>) => void} onChats
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToUserChats(uid, onChats, onError) {
  if (!uid) return () => {};
  // We query for chats where the user is in participantUids
  // Since Firestore doesn't support "array-contains" with orderBy on a different field easily,
  // we'll use a simpler approach: get all chats and filter client-side
  // For better performance at scale, a composite index would be needed
  const chatsQuery = query(
    collection(db, "chats"),
    where("participantUids", "array-contains", uid),
  );

  return onSnapshot(
    chatsQuery,
    (snapshot) => {
      const chats = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort(
          (a, b) =>
            (b.lastMessageAt?.toMillis?.() ?? 0) - (a.lastMessageAt?.toMillis?.() ?? 0),
        );
      onChats(chats);
    },
    onError,
  );
}