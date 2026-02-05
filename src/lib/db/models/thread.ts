/**
 * Thread Model
 *
 * Generic communication/messaging system attachable to any object.
 * Facebook-style comments with nested replies, reactions, and read tracking.
 *
 * Collection: threads (lowercase, pluralized per CLAUDE.md)
 */

import mongoose, { Schema, Document, Model } from "mongoose";
import type {
  Thread,
  ThreadMessage,
  ThreadParticipant,
  MessageAttachment,
  MessageReaction,
  ThreadStatus,
  ParticipantType,
  ContentType,
  ReactionType,
} from "@/lib/types/thread";
import {
  THREAD_STATUSES,
  PARTICIPANT_TYPES,
  CONTENT_TYPES,
  REACTION_TYPES,
  MAX_REPLY_DEPTH,
} from "@/lib/types/thread";

// ============================================
// INTERFACES
// ============================================

export interface IMessageAttachment extends MessageAttachment {}

export interface IMessageReaction extends MessageReaction {}

export interface IThreadMessage extends ThreadMessage {}

export interface IThreadParticipant extends ThreadParticipant {}

export interface IThread extends Thread, Document {
  // Mongoose document methods
  addMessage(message: Partial<IThreadMessage>): IThreadMessage;
  addParticipant(participant: Partial<IThreadParticipant>): IThreadParticipant;
  markAsRead(userId: string): void;
}

// ============================================
// SCHEMAS
// ============================================

const MessageAttachmentSchema = new Schema<IMessageAttachment>(
  {
    attachment_id: { type: String, required: true },
    filename: { type: String, required: true },
    url: { type: String, required: true },
    mime_type: { type: String, required: true },
    size_bytes: { type: Number, required: true },
  },
  { _id: false }
);

const MessageReactionSchema = new Schema<IMessageReaction>(
  {
    user_id: { type: String, required: true },
    user_name: { type: String, required: true },
    reaction_type: {
      type: String,
      enum: REACTION_TYPES,
      required: true,
    },
    reacted_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ThreadMessageSchema = new Schema<IThreadMessage>(
  {
    message_id: { type: String, required: true, index: true },

    // Author
    author_id: { type: String, required: true, index: true },
    author_type: {
      type: String,
      enum: PARTICIPANT_TYPES,
      required: true,
    },
    author_name: { type: String, required: true },
    author_avatar: { type: String },

    // Content
    content: { type: String, required: true },
    content_type: {
      type: String,
      enum: CONTENT_TYPES,
      default: "text",
    },

    // Replies (nested comments)
    parent_id: { type: String, index: true },
    replies_count: { type: Number, default: 0 },
    depth: { type: Number, default: 0, max: MAX_REPLY_DEPTH },

    // Reactions
    reactions: { type: [MessageReactionSchema], default: [] },
    reactions_count: { type: Number, default: 0 },

    // Attachments
    attachments: { type: [MessageAttachmentSchema], default: [] },

    // Metadata
    created_at: { type: Date, default: Date.now, index: true },
    edited_at: { type: Date },
    is_internal: { type: Boolean, default: false },
    is_pinned: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },

    // Note: Read tracking is done via participant.last_read_at
    // Messages created after last_read_at are considered unread
  },
  { _id: false }
);

const ThreadParticipantSchema = new Schema<IThreadParticipant>(
  {
    user_id: { type: String, required: true },
    user_type: {
      type: String,
      enum: PARTICIPANT_TYPES,
      required: true,
    },
    name: { type: String, required: true },
    email: { type: String },
    avatar: { type: String },
    joined_at: { type: Date, default: Date.now },
    last_read_at: { type: Date },
  },
  { _id: false }
);

const ThreadSchema = new Schema<IThread>(
  {
    thread_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Polymorphic reference
    ref_type: { type: String, required: true, index: true },
    ref_id: { type: String, required: true, index: true },

    // Thread metadata
    subject: { type: String },
    status: {
      type: String,
      enum: THREAD_STATUSES,
      default: "open",
      index: true,
    },

    // Participants
    participants: { type: [ThreadParticipantSchema], default: [] },

    // Messages
    messages: { type: [ThreadMessageSchema], default: [] },

    // Counters
    message_count: { type: Number, default: 0 },

    // Tracking
    last_message_at: { type: Date },
    last_message_by: { type: String },

    // Multi-tenant
    tenant_id: { type: String, index: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// ============================================
// INDEXES
// ============================================

// Find threads for a specific object (order, campaign, etc.)
ThreadSchema.index({ ref_type: 1, ref_id: 1 });

// Find threads by tenant and status
ThreadSchema.index({ tenant_id: 1, status: 1 });

// Find threads by participant
ThreadSchema.index({ "participants.user_id": 1 });

// Find threads with recent activity
ThreadSchema.index({ tenant_id: 1, last_message_at: -1 });

// Find messages by parent (for loading replies)
ThreadSchema.index({ "messages.parent_id": 1 });

// ============================================
// INSTANCE METHODS
// ============================================

ThreadSchema.methods.addMessage = function (
  message: Partial<IThreadMessage>
): IThreadMessage {
  const now = new Date();
  const newMessage: IThreadMessage = {
    message_id: message.message_id || "",
    author_id: message.author_id || "",
    author_type: message.author_type || "system",
    author_name: message.author_name || "System",
    author_avatar: message.author_avatar,
    content: message.content || "",
    content_type: message.content_type || "text",
    parent_id: message.parent_id,
    replies_count: 0,
    depth: message.depth || 0,
    reactions: [],
    reactions_count: 0,
    attachments: message.attachments || [],
    created_at: now,
    is_internal: message.is_internal || false,
    is_pinned: false,
    is_deleted: false,
  };

  this.messages.push(newMessage);
  this.message_count = this.messages.filter((m: IThreadMessage) => !m.is_deleted).length;
  this.last_message_at = now;
  this.last_message_by = newMessage.author_id;

  // Update author's last_read_at (they've seen their own message)
  const authorParticipant = this.participants.find(
    (p: IThreadParticipant) => p.user_id === newMessage.author_id
  );
  if (authorParticipant) {
    authorParticipant.last_read_at = now;
  }

  // Update parent's replies_count if this is a reply
  if (newMessage.parent_id) {
    const parent = this.messages.find(
      (m: IThreadMessage) => m.message_id === newMessage.parent_id
    );
    if (parent) {
      parent.replies_count = (parent.replies_count || 0) + 1;
    }
  }

  return newMessage;
};

ThreadSchema.methods.addParticipant = function (
  participant: Partial<IThreadParticipant>
): IThreadParticipant {
  // Check if already a participant
  const existing = this.participants.find(
    (p: IThreadParticipant) => p.user_id === participant.user_id
  );
  if (existing) return existing;

  const newParticipant: IThreadParticipant = {
    user_id: participant.user_id || "",
    user_type: participant.user_type || "customer",
    name: participant.name || "",
    email: participant.email,
    avatar: participant.avatar,
    joined_at: new Date(),
  };

  this.participants.push(newParticipant);
  return newParticipant;
};

ThreadSchema.methods.markAsRead = function (userId: string): void {
  const now = new Date();

  // Update participant's last_read_at
  // Messages created before this timestamp are considered read
  const participant = this.participants.find(
    (p: IThreadParticipant) => p.user_id === userId
  );
  if (participant) {
    participant.last_read_at = now;
  }
};

// ============================================
// MODEL FACTORY
// ============================================

const modelName = "Thread";

/**
 * Get Thread model for a specific tenant database connection.
 */
export function getThreadModel(
  connection: mongoose.Connection
): Model<IThread> {
  // Return existing model if already compiled
  if (connection.models[modelName]) {
    return connection.models[modelName] as Model<IThread>;
  }

  // Compile and return new model
  return connection.model<IThread>(modelName, ThreadSchema, "threads");
}

// Default export for single-tenant scenarios
let ThreadModel: Model<IThread> | null = null;

export function getDefaultThreadModel(): Model<IThread> {
  if (ThreadModel) return ThreadModel;

  if (mongoose.models[modelName]) {
    ThreadModel = mongoose.models[modelName] as Model<IThread>;
  } else {
    ThreadModel = mongoose.model<IThread>(modelName, ThreadSchema, "threads");
  }

  return ThreadModel;
}

export { ThreadSchema };
