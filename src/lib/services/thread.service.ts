/**
 * Thread Service
 *
 * Business logic for the generic communication/messaging system.
 * Handles thread creation, messages, reactions, and read tracking.
 */

import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { getThreadModel, type IThread } from "@/lib/db/models/thread";
import type {
  Thread,
  ThreadMessage,
  ThreadParticipant,
  ThreadRefType,
  ParticipantType,
  ContentType,
  ReactionType,
} from "@/lib/types/thread";
import { MAX_REPLY_DEPTH } from "@/lib/types/thread";

// ============================================
// TYPES
// ============================================

interface CreateThreadOptions {
  subject?: string;
  initialMessage?: string;
  participants?: Array<{
    user_id: string;
    user_type: ParticipantType;
    name: string;
    email?: string;
  }>;
  authorType?: ParticipantType;
}

interface AddMessageOptions {
  authorName: string;
  authorType?: ParticipantType;
  authorAvatar?: string;
  contentType?: ContentType;
  parentId?: string;
  isInternal?: boolean;
  attachments?: Array<{
    filename: string;
    url: string;
    mime_type: string;
    size_bytes: number;
  }>;
}

interface ListThreadsOptions {
  refType?: string;
  refId?: string;
  status?: "open" | "closed" | "archived";
  participantId?: string;
  page?: number;
  limit?: number;
}

interface MessageResult {
  success: boolean;
  message?: ThreadMessage;
  error?: string;
}

// ============================================
// THREAD MANAGEMENT
// ============================================

/**
 * Create a new thread attached to an object.
 */
export async function createThread(
  tenantDb: mongoose.Connection,
  refType: ThreadRefType,
  refId: string,
  userId: string,
  userName: string,
  options: CreateThreadOptions = {}
): Promise<IThread | null> {
  try {
    const ThreadModel = getThreadModel(tenantDb);

    // Check if thread already exists for this ref
    const existing = await ThreadModel.findOne({
      ref_type: refType,
      ref_id: refId,
      status: { $ne: "archived" },
    });

    if (existing) {
      return existing;
    }

    const threadId = nanoid(12);
    const now = new Date();
    const authorType = options.authorType || "customer";

    // Create initial participants list
    const participants: ThreadParticipant[] = [
      {
        user_id: userId,
        user_type: authorType,
        name: userName,
        joined_at: now,
      },
    ];

    // Add additional participants if provided
    if (options.participants) {
      for (const p of options.participants) {
        if (p.user_id !== userId) {
          participants.push({
            ...p,
            joined_at: now,
          });
        }
      }
    }

    // Create initial message if provided
    const messages: ThreadMessage[] = [];
    if (options.initialMessage) {
      messages.push({
        message_id: nanoid(8),
        author_id: userId,
        author_type: authorType,
        author_name: userName,
        content: options.initialMessage,
        content_type: "text",
        replies_count: 0,
        depth: 0,
        reactions: [],
        reactions_count: 0,
        attachments: [],
        created_at: now,
        is_internal: false,
        is_pinned: false,
        is_deleted: false,
      });
      // Mark author as having read up to this message
      participants[0].last_read_at = now;
    }

    const thread = new ThreadModel({
      thread_id: threadId,
      ref_type: refType,
      ref_id: refId,
      subject: options.subject,
      status: "open",
      participants,
      messages,
      message_count: messages.length,
      last_message_at: messages.length > 0 ? now : undefined,
      last_message_by: messages.length > 0 ? userId : undefined,
    });

    await thread.save();
    return thread;
  } catch (error) {
    console.error("[ThreadService] createThread error:", error);
    return null;
  }
}

/**
 * Get a thread by ID.
 */
export async function getThread(
  tenantDb: mongoose.Connection,
  threadId: string
): Promise<IThread | null> {
  try {
    const ThreadModel = getThreadModel(tenantDb);
    return await ThreadModel.findOne({ thread_id: threadId });
  } catch (error) {
    console.error("[ThreadService] getThread error:", error);
    return null;
  }
}

/**
 * Get threads for a specific object (order, campaign, etc.).
 */
export async function getThreadsForRef(
  tenantDb: mongoose.Connection,
  refType: ThreadRefType,
  refId: string
): Promise<IThread[]> {
  try {
    const ThreadModel = getThreadModel(tenantDb);
    return await ThreadModel.find({
      ref_type: refType,
      ref_id: refId,
    }).sort({ last_message_at: -1 });
  } catch (error) {
    console.error("[ThreadService] getThreadsForRef error:", error);
    return [];
  }
}

/**
 * List threads with filters and pagination.
 */
export async function listThreads(
  tenantDb: mongoose.Connection,
  options: ListThreadsOptions = {}
): Promise<{ threads: IThread[]; total: number; page: number; limit: number }> {
  try {
    const ThreadModel = getThreadModel(tenantDb);
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = {};
    if (options.refType) query.ref_type = options.refType;
    if (options.refId) query.ref_id = options.refId;
    if (options.status) query.status = options.status;
    if (options.participantId) {
      query["participants.user_id"] = options.participantId;
    }

    const [threads, total] = await Promise.all([
      ThreadModel.find(query)
        .sort({ last_message_at: -1 })
        .skip(skip)
        .limit(limit),
      ThreadModel.countDocuments(query),
    ]);

    return { threads, total, page, limit };
  } catch (error) {
    console.error("[ThreadService] listThreads error:", error);
    return { threads: [], total: 0, page: 1, limit: 20 };
  }
}

/**
 * Close a thread.
 */
export async function closeThread(
  tenantDb: mongoose.Connection,
  threadId: string
): Promise<IThread | null> {
  try {
    const ThreadModel = getThreadModel(tenantDb);
    return await ThreadModel.findOneAndUpdate(
      { thread_id: threadId },
      { status: "closed" },
      { new: true }
    );
  } catch (error) {
    console.error("[ThreadService] closeThread error:", error);
    return null;
  }
}

// ============================================
// MESSAGE MANAGEMENT
// ============================================

/**
 * Add a message to a thread.
 */
export async function addMessage(
  tenantDb: mongoose.Connection,
  threadId: string,
  userId: string,
  content: string,
  options: AddMessageOptions
): Promise<ThreadMessage | null> {
  try {
    const ThreadModel = getThreadModel(tenantDb);
    const thread = await ThreadModel.findOne({ thread_id: threadId });

    if (!thread) {
      return null;
    }

    const now = new Date();
    const messageId = nanoid(8);
    const authorType = options.authorType || "customer";

    // Calculate depth for replies
    let depth = 0;
    if (options.parentId) {
      const parent = thread.messages.find(
        (m) => m.message_id === options.parentId
      );
      if (parent) {
        depth = Math.min((parent.depth || 0) + 1, MAX_REPLY_DEPTH);
      }
    }

    const message: ThreadMessage = {
      message_id: messageId,
      author_id: userId,
      author_type: authorType,
      author_name: options.authorName,
      author_avatar: options.authorAvatar,
      content,
      content_type: options.contentType || "text",
      parent_id: options.parentId,
      replies_count: 0,
      depth,
      reactions: [],
      reactions_count: 0,
      attachments: options.attachments?.map((a) => ({
        attachment_id: nanoid(8),
        ...a,
      })) || [],
      created_at: now,
      is_internal: options.isInternal || false,
      is_pinned: false,
      is_deleted: false,
    };

    // Add message using model method
    thread.addMessage(message);

    // Add user as participant if not already
    thread.addParticipant({
      user_id: userId,
      user_type: authorType,
      name: options.authorName,
      avatar: options.authorAvatar,
    });

    await thread.save();
    return message;
  } catch (error) {
    console.error("[ThreadService] addMessage error:", error);
    return null;
  }
}

/**
 * Edit a message.
 */
export async function editMessage(
  tenantDb: mongoose.Connection,
  threadId: string,
  messageId: string,
  newContent: string,
  userId: string
): Promise<MessageResult> {
  try {
    const ThreadModel = getThreadModel(tenantDb);
    const thread = await ThreadModel.findOne({ thread_id: threadId });

    if (!thread) {
      return { success: false, error: "Thread not found" };
    }

    const message = thread.messages.find((m) => m.message_id === messageId);
    if (!message) {
      return { success: false, error: "Message not found" };
    }

    // Only author can edit
    if (message.author_id !== userId) {
      return { success: false, error: "Only author can edit message" };
    }

    if (message.is_deleted) {
      return { success: false, error: "Cannot edit deleted message" };
    }

    message.content = newContent;
    message.edited_at = new Date();

    await thread.save();
    return { success: true, message };
  } catch (error) {
    console.error("[ThreadService] editMessage error:", error);
    return { success: false, error: "Failed to edit message" };
  }
}

/**
 * Soft delete a message.
 */
export async function deleteMessage(
  tenantDb: mongoose.Connection,
  threadId: string,
  messageId: string,
  userId: string
): Promise<MessageResult> {
  try {
    const ThreadModel = getThreadModel(tenantDb);
    const thread = await ThreadModel.findOne({ thread_id: threadId });

    if (!thread) {
      return { success: false, error: "Thread not found" };
    }

    const message = thread.messages.find((m) => m.message_id === messageId);
    if (!message) {
      return { success: false, error: "Message not found" };
    }

    // Only author can delete
    if (message.author_id !== userId) {
      return { success: false, error: "Only author can delete message" };
    }

    message.is_deleted = true;
    message.content = "[Message deleted]";

    // Update message count
    thread.message_count = thread.messages.filter((m) => !m.is_deleted).length;

    await thread.save();
    return { success: true, message };
  } catch (error) {
    console.error("[ThreadService] deleteMessage error:", error);
    return { success: false, error: "Failed to delete message" };
  }
}

// ============================================
// REACTIONS
// ============================================

/**
 * Add a reaction to a message.
 */
export async function addReaction(
  tenantDb: mongoose.Connection,
  threadId: string,
  messageId: string,
  userId: string,
  userName: string,
  reactionType: ReactionType
): Promise<MessageResult> {
  try {
    const ThreadModel = getThreadModel(tenantDb);
    const thread = await ThreadModel.findOne({ thread_id: threadId });

    if (!thread) {
      return { success: false, error: "Thread not found" };
    }

    const message = thread.messages.find((m) => m.message_id === messageId);
    if (!message) {
      return { success: false, error: "Message not found" };
    }

    // Check if already reacted
    const existingIdx = message.reactions.findIndex(
      (r) => r.user_id === userId
    );
    if (existingIdx >= 0) {
      // Update existing reaction
      message.reactions[existingIdx].reaction_type = reactionType;
      message.reactions[existingIdx].reacted_at = new Date();
    } else {
      // Add new reaction
      message.reactions.push({
        user_id: userId,
        user_name: userName,
        reaction_type: reactionType,
        reacted_at: new Date(),
      });
    }

    message.reactions_count = message.reactions.length;

    await thread.save();
    return { success: true, message };
  } catch (error) {
    console.error("[ThreadService] addReaction error:", error);
    return { success: false, error: "Failed to add reaction" };
  }
}

/**
 * Remove a reaction from a message.
 */
export async function removeReaction(
  tenantDb: mongoose.Connection,
  threadId: string,
  messageId: string,
  userId: string
): Promise<MessageResult> {
  try {
    const ThreadModel = getThreadModel(tenantDb);
    const thread = await ThreadModel.findOne({ thread_id: threadId });

    if (!thread) {
      return { success: false, error: "Thread not found" };
    }

    const message = thread.messages.find((m) => m.message_id === messageId);
    if (!message) {
      return { success: false, error: "Message not found" };
    }

    const idx = message.reactions.findIndex((r) => r.user_id === userId);
    if (idx >= 0) {
      message.reactions.splice(idx, 1);
      message.reactions_count = message.reactions.length;
    }

    await thread.save();
    return { success: true, message };
  } catch (error) {
    console.error("[ThreadService] removeReaction error:", error);
    return { success: false, error: "Failed to remove reaction" };
  }
}

// ============================================
// PIN/UNPIN
// ============================================

/**
 * Toggle pin status on a message.
 */
export async function togglePinMessage(
  tenantDb: mongoose.Connection,
  threadId: string,
  messageId: string,
  pinned: boolean
): Promise<MessageResult> {
  try {
    const ThreadModel = getThreadModel(tenantDb);
    const thread = await ThreadModel.findOne({ thread_id: threadId });

    if (!thread) {
      return { success: false, error: "Thread not found" };
    }

    const message = thread.messages.find((m) => m.message_id === messageId);
    if (!message) {
      return { success: false, error: "Message not found" };
    }

    message.is_pinned = pinned;

    await thread.save();
    return { success: true, message };
  } catch (error) {
    console.error("[ThreadService] togglePinMessage error:", error);
    return { success: false, error: "Failed to toggle pin" };
  }
}

// ============================================
// READ TRACKING
// ============================================

/**
 * Mark all messages as read for a user.
 */
export async function markAsRead(
  tenantDb: mongoose.Connection,
  threadId: string,
  userId: string
): Promise<boolean> {
  try {
    const ThreadModel = getThreadModel(tenantDb);
    const thread = await ThreadModel.findOne({ thread_id: threadId });

    if (!thread) {
      return false;
    }

    thread.markAsRead(userId);
    await thread.save();
    return true;
  } catch (error) {
    console.error("[ThreadService] markAsRead error:", error);
    return false;
  }
}

/**
 * Get unread count for a user.
 * Uses participant.last_read_at to determine unread messages.
 * Messages created after last_read_at are considered unread.
 */
export async function getUnreadCount(
  tenantDb: mongoose.Connection,
  userId: string
): Promise<{ unread_count: number; threads: Array<{ thread_id: string; ref_type: string; ref_id: string; subject?: string; unread_messages: number }> }> {
  try {
    const ThreadModel = getThreadModel(tenantDb);

    // Find threads where user is a participant
    const threads = await ThreadModel.find({
      "participants.user_id": userId,
      status: { $ne: "archived" },
    });

    let totalUnread = 0;
    const threadUnreads: Array<{
      thread_id: string;
      ref_type: string;
      ref_id: string;
      subject?: string;
      unread_messages: number;
    }> = [];

    for (const thread of threads) {
      // Find the participant's last_read_at
      const participant = thread.participants.find((p) => p.user_id === userId);
      const lastReadAt = participant?.last_read_at;

      // Count messages created after last_read_at (excluding user's own messages)
      const unread = thread.messages.filter((m) => {
        if (m.is_deleted) return false;
        if (m.author_id === userId) return false; // Don't count own messages as unread
        if (!lastReadAt) return true; // Never read = all messages are unread
        return new Date(m.created_at) > new Date(lastReadAt);
      }).length;

      if (unread > 0) {
        totalUnread += unread;
        threadUnreads.push({
          thread_id: thread.thread_id,
          ref_type: thread.ref_type,
          ref_id: thread.ref_id,
          subject: thread.subject,
          unread_messages: unread,
        });
      }
    }

    return {
      unread_count: totalUnread,
      threads: threadUnreads,
    };
  } catch (error) {
    console.error("[ThreadService] getUnreadCount error:", error);
    return { unread_count: 0, threads: [] };
  }
}

// ============================================
// UTILITY
// ============================================

/**
 * Get or create a thread for a reference.
 */
export async function getOrCreateThread(
  tenantDb: mongoose.Connection,
  refType: ThreadRefType,
  refId: string,
  userId: string,
  userName: string,
  options: CreateThreadOptions = {}
): Promise<IThread | null> {
  try {
    const ThreadModel = getThreadModel(tenantDb);

    // Try to find existing thread
    const existing = await ThreadModel.findOne({
      ref_type: refType,
      ref_id: refId,
      status: { $ne: "archived" },
    });

    if (existing) {
      // If initial message provided, add it
      if (options.initialMessage) {
        await addMessage(tenantDb, existing.thread_id, userId, options.initialMessage, {
          authorName: userName,
          authorType: options.authorType || "customer",
        });
        // Refetch to get updated thread
        return await ThreadModel.findOne({ thread_id: existing.thread_id });
      }
      return existing;
    }

    // Create new thread
    return await createThread(tenantDb, refType, refId, userId, userName, options);
  } catch (error) {
    console.error("[ThreadService] getOrCreateThread error:", error);
    return null;
  }
}
