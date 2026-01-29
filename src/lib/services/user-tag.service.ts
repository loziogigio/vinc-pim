/**
 * User Tag Service
 *
 * Business logic for user tag management. API routes should be thin
 * orchestrators that call these functions.
 */

import { connectWithModels } from "@/lib/db/connection";

// ============================================
// TYPES
// ============================================

export interface CreateUserTagData {
  name: string;
  description?: string;
  color?: string;
  created_by?: string;
}

export interface UpdateUserTagData {
  name?: string;
  description?: string;
  color?: string;
  is_active?: boolean;
  updated_by?: string;
}

export interface ListUsersOptions {
  page?: number;
  limit?: number;
}

export interface UserTagRef {
  tag_id: string;
  name: string;
  slug: string;
  color?: string;
}

// ============================================
// LIST TAGS
// ============================================

export async function listUserTags(tenantDb: string, includeInactive = false) {
  const { UserTag } = await connectWithModels(tenantDb);

  const query = includeInactive ? {} : { is_active: true };
  const tags = await UserTag.find(query).sort({ name: 1 }).lean();

  return tags;
}

// ============================================
// GET TAG
// ============================================

export async function getUserTag(tenantDb: string, tagId: string) {
  const { UserTag } = await connectWithModels(tenantDb);
  const tag = await UserTag.findOne({ tag_id: tagId }).lean();
  return tag;
}

// ============================================
// CREATE TAG
// ============================================

export async function createUserTag(tenantDb: string, data: CreateUserTagData) {
  const { UserTag } = await connectWithModels(tenantDb);

  // Check for duplicate name
  const existingByName = await UserTag.findOne({
    name: { $regex: new RegExp(`^${data.name.trim()}$`, "i") },
  });

  if (existingByName) {
    return { error: "A tag with this name already exists", status: 400 };
  }

  const tag = new UserTag({
    name: data.name.trim(),
    description: data.description?.trim(),
    color: data.color?.trim(),
    created_by: data.created_by,
  });

  await tag.save();

  return {
    tag_id: tag.tag_id,
    name: tag.name,
    slug: tag.slug,
    description: tag.description,
    color: tag.color,
    is_active: tag.is_active,
    user_count: tag.user_count,
    created_at: tag.created_at,
  };
}

// ============================================
// UPDATE TAG
// ============================================

export async function updateUserTag(
  tenantDb: string,
  tagId: string,
  data: UpdateUserTagData
) {
  const { UserTag } = await connectWithModels(tenantDb);

  const tag = await UserTag.findOne({ tag_id: tagId });

  if (!tag) {
    return { error: "Tag not found", status: 404 };
  }

  // Check for duplicate name (excluding current tag)
  if (data.name !== undefined) {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      return { error: "Tag name cannot be empty", status: 400 };
    }

    const existingByName = await UserTag.findOne({
      tag_id: { $ne: tagId },
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });

    if (existingByName) {
      return { error: "A tag with this name already exists", status: 400 };
    }

    tag.name = trimmedName;
  }

  if (data.description !== undefined) {
    tag.description = data.description?.trim() || undefined;
  }

  if (data.color !== undefined) {
    tag.color = data.color?.trim() || undefined;
  }

  if (data.is_active !== undefined) {
    tag.is_active = data.is_active;
  }

  if (data.updated_by) {
    tag.updated_by = data.updated_by;
  }

  await tag.save();

  return {
    tag_id: tag.tag_id,
    name: tag.name,
    slug: tag.slug,
    description: tag.description,
    color: tag.color,
    is_active: tag.is_active,
    user_count: tag.user_count,
    updated_at: tag.updated_at,
  };
}

// ============================================
// DELETE TAG
// ============================================

export async function deleteUserTag(tenantDb: string, tagId: string) {
  const { UserTag, PortalUser } = await connectWithModels(tenantDb);

  const tag = await UserTag.findOne({ tag_id: tagId });

  if (!tag) {
    return { error: "Tag not found", status: 404 };
  }

  // Remove tag from all portal users
  await PortalUser.updateMany(
    { "tags.tag_id": tagId },
    { $pull: { tags: { tag_id: tagId } } }
  );

  // Delete the tag
  await UserTag.deleteOne({ tag_id: tagId });

  return { success: true };
}

// ============================================
// LIST USERS WITH TAG
// ============================================

export async function getUsersByTag(
  tenantDb: string,
  tagId: string,
  options: ListUsersOptions = {}
) {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const { UserTag, PortalUser } = await connectWithModels(tenantDb);

  // Verify tag exists
  const tag = await UserTag.findOne({ tag_id: tagId }).lean();
  if (!tag) {
    return { error: "Tag not found", status: 404 };
  }

  // Find users with this tag
  const query = { "tags.tag_id": tagId };
  const [users, total] = await Promise.all([
    PortalUser.find(query)
      .select("portal_user_id username email is_active tags created_at")
      .skip(skip)
      .limit(limit)
      .sort({ username: 1 })
      .lean(),
    PortalUser.countDocuments(query),
  ]);

  return {
    users: users.map((u) => ({
      portal_user_id: u.portal_user_id,
      username: u.username,
      email: u.email,
      is_active: u.is_active,
      created_at: u.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ============================================
// ADD USERS TO TAG
// ============================================

export async function addUsersToTag(
  tenantDb: string,
  tagId: string,
  userIds: string[]
) {
  const { UserTag, PortalUser } = await connectWithModels(tenantDb);

  // Verify tag exists
  const tag = await UserTag.findOne({ tag_id: tagId });
  if (!tag) {
    return { error: "Tag not found", status: 404 };
  }

  // Prepare tag reference to embed
  const tagRef: UserTagRef = {
    tag_id: tag.tag_id,
    name: tag.name,
    slug: tag.slug,
    color: tag.color,
  };

  // Add tag to users (only if they don't already have it)
  const result = await PortalUser.updateMany(
    {
      portal_user_id: { $in: userIds },
      "tags.tag_id": { $ne: tagId },
    },
    { $push: { tags: tagRef } }
  );

  // Update user_count on the tag
  const newCount = await PortalUser.countDocuments({ "tags.tag_id": tagId });
  tag.user_count = newCount;
  await tag.save();

  return {
    added: result.modifiedCount,
    total_users: newCount,
  };
}

// ============================================
// REMOVE USERS FROM TAG
// ============================================

export async function removeUsersFromTag(
  tenantDb: string,
  tagId: string,
  userIds: string[]
) {
  const { UserTag, PortalUser } = await connectWithModels(tenantDb);

  // Verify tag exists
  const tag = await UserTag.findOne({ tag_id: tagId });
  if (!tag) {
    return { error: "Tag not found", status: 404 };
  }

  // Remove tag from users
  const result = await PortalUser.updateMany(
    { portal_user_id: { $in: userIds } },
    { $pull: { tags: { tag_id: tagId } } }
  );

  // Update user_count on the tag
  const newCount = await PortalUser.countDocuments({ "tags.tag_id": tagId });
  tag.user_count = newCount;
  await tag.save();

  return {
    removed: result.modifiedCount,
    total_users: newCount,
  };
}

// ============================================
// GET USERS BY MULTIPLE TAGS
// ============================================

export async function getUsersByTags(tenantDb: string, tagIds: string[]) {
  const { PortalUser } = await connectWithModels(tenantDb);

  const users = await PortalUser.find({
    "tags.tag_id": { $in: tagIds },
    is_active: true,
  })
    .select("portal_user_id username email is_active tags")
    .lean();

  return users;
}
