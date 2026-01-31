"use client";

import { useState, useEffect, useCallback } from "react";
import { Tag, Loader2, Check, Users } from "lucide-react";
import type { SelectedUser, UserType } from "./BrowseUsersTab";

interface UserTag {
  tag_id: string;
  name: string;
  slug: string;
  color?: string;
  user_count: number;
}

interface TagsTabProps {
  existingUserIds: Set<string>;
  onAddUsers: (users: SelectedUser[]) => void;
}

export function TagsTab({ existingUserIds, onAddUsers }: TagsTabProps) {
  const [tags, setTags] = useState<UserTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadTags = useCallback(async () => {
    setIsLoadingTags(true);
    try {
      const res = await fetch("/api/b2b/user-tags");
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error("Error loading tags:", error);
      setTags([]);
    } finally {
      setIsLoadingTags(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const addUsersByTags = async () => {
    if (selectedTagIds.length === 0) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/notifications/recipients/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_ids: selectedTagIds, format: "json" }),
      });

      if (res.ok) {
        const data = await res.json();
        const newUsers = (data.users || [])
          .filter((u: { portal_user_id: string }) => !existingUserIds.has(u.portal_user_id))
          .map((u: { portal_user_id: string; username: string; email: string }) => ({
            id: u.portal_user_id,
            name: u.username,
            email: u.email,
            type: "portal" as UserType,
          }));

        onAddUsers(newUsers);
        setSelectedTagIds([]);
      }
    } catch (error) {
      console.error("Error loading users by tags:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <p className="text-sm text-slate-500 mb-4">
        Seleziona uno o più tag per aggiungere tutti gli utenti associati.
      </p>

      {isLoadingTags ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-slate-500">Caricamento tag...</span>
        </div>
      ) : tags.length === 0 ? (
        <div className="text-center py-12">
          <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Nessun tag disponibile</p>
          <p className="text-xs text-slate-400 mt-1">
            Crea tag dalla sezione Impostazioni → Tag Utenti
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.tag_id);
            return (
              <button
                key={tag.tag_id}
                type="button"
                onClick={() => toggleTag(tag.tag_id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                  isSelected ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center h-5">
                  <input type="checkbox" checked={isSelected} onChange={() => {}} className="w-4 h-4 rounded border-slate-300 text-primary" />
                </div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: tag.color ? `${tag.color}20` : "rgb(241, 245, 249)" }}
                >
                  <Tag className="w-4 h-4" style={{ color: tag.color || "#64748b" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{tag.name}</p>
                  <p className="text-xs text-slate-500">
                    {tag.user_count} utent{tag.user_count !== 1 ? "i" : "e"}
                  </p>
                </div>
                {isSelected && <Check className="w-5 h-5 text-primary flex-shrink-0" />}
              </button>
            );
          })}

          {selectedTagIds.length > 0 && (
            <button
              onClick={addUsersByTags}
              disabled={isLoading}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Aggiungi utenti da {selectedTagIds.length} tag
            </button>
          )}
        </div>
      )}
    </div>
  );
}
