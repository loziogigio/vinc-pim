/**
 * Thread/Communication Type Definitions
 *
 * Generic communication system attachable to any object (orders, campaigns, etc.).
 * Facebook-style comments with nested replies, reactions, and read tracking.
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export const THREAD_STATUSES = ["open", "closed", "archived"] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export const THREAD_REF_TYPES = [
  "order",
  "campaign",
  "customer",
  "support",
] as const;
export type ThreadRefType = (typeof THREAD_REF_TYPES)[number] | string;

export const PARTICIPANT_TYPES = [
  "customer",
  "sales",
  "admin",
  "system",
] as const;
export type ParticipantType = (typeof PARTICIPANT_TYPES)[number];

export const CONTENT_TYPES = ["text", "html", "markdown"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const REACTION_TYPES = [
  "like",
  "love",
  "thumbsup",
  "thumbsdown",
] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

// Max nesting depth for replies (like Facebook)
export const MAX_REPLY_DEPTH = 2;

// ============================================
// MESSAGE ATTACHMENT
// ============================================

export interface MessageAttachment {
  attachment_id: string;
  filename: string;
  url: string;
  mime_type: string;
  size_bytes: number;
}

// ============================================
// MESSAGE REACTION
// ============================================

export interface MessageReaction {
  user_id: string;
  user_name: string;
  reaction_type: ReactionType;
  reacted_at: Date;
}

// ============================================
// THREAD MESSAGE
// ============================================

export interface ThreadMessage {
  message_id: string; // nanoid(8)

  // Author
  author_id: string;
  author_type: ParticipantType;
  author_name: string;
  author_avatar?: string;

  // Content
  content: string; // Plain text, HTML, or markdown
  content_type: ContentType;

  // Replies (Facebook-style nested comments)
  parent_id?: string; // If reply, reference to parent message_id
  replies_count: number; // Cached count of direct replies
  depth: number; // 0 = top-level, 1 = reply, 2 = reply-to-reply (max 2)

  // Reactions
  reactions: MessageReaction[];
  reactions_count: number; // Cached total

  // Attachments
  attachments: MessageAttachment[];

  // Metadata
  created_at: Date;
  edited_at?: Date;
  is_internal: boolean; // Internal notes (not visible to customer)
  is_pinned: boolean; // Pin important messages to top
  is_deleted: boolean; // Soft delete

  // Note: Read tracking is done via participant.last_read_at
  // Messages created after last_read_at are considered unread
}

// ============================================
// THREAD PARTICIPANT
// ============================================

export interface ThreadParticipant {
  user_id: string;
  user_type: ParticipantType;
  name: string;
  email?: string;
  avatar?: string;
  joined_at: Date;
  last_read_at?: Date;
}

// ============================================
// THREAD
// ============================================

export interface Thread {
  thread_id: string; // nanoid(12)

  // Polymorphic reference (attach to any object)
  ref_type: ThreadRefType;
  ref_id: string; // order_id, campaign_id, etc.

  // Thread metadata
  subject?: string;
  status: ThreadStatus;

  // Participants
  participants: ThreadParticipant[];

  // Messages (embedded for small threads, or use pagination)
  messages: ThreadMessage[];

  // Counters (cached)
  message_count: number;
  unread_count?: number; // Per-user, calculated

  // Tracking
  created_at: Date;
  updated_at: Date;
  last_message_at?: Date;
  last_message_by?: string; // user_id

  // Multi-tenant
  tenant_id?: string;
}

// ============================================
// API REQUEST TYPES
// ============================================

export interface CreateThreadRequest {
  ref_type: ThreadRefType;
  ref_id: string;
  subject?: string;
  initial_message?: string;
  participants?: Array<{
    user_id: string;
    user_type: ParticipantType;
    name: string;
    email?: string;
  }>;
}

export interface AddMessageRequest {
  content: string;
  content_type?: ContentType;
  parent_id?: string; // For replies
  is_internal?: boolean;
  attachments?: Array<{
    filename: string;
    url: string;
    mime_type: string;
    size_bytes: number;
  }>;
}

export interface EditMessageRequest {
  content: string;
}

export interface AddReactionRequest {
  reaction_type: ReactionType;
}

export interface ThreadListQuery {
  ref_type?: ThreadRefType;
  ref_id?: string;
  status?: ThreadStatus;
  participant_id?: string;
  page?: number;
  limit?: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ThreadResponse {
  success: boolean;
  thread?: Thread;
  error?: string;
}

export interface ThreadListResponse {
  success: boolean;
  threads: Thread[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface MessageResponse {
  success: boolean;
  message?: ThreadMessage;
  error?: string;
}

export interface UnreadCountResponse {
  success: boolean;
  unread_count: number;
  threads: Array<{
    thread_id: string;
    ref_type: string;
    ref_id: string;
    subject?: string;
    unread_messages: number;
  }>;
}
