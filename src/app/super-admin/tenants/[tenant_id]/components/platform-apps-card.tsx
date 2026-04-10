"use client";

import { useEffect, useState } from "react";

interface PlatformApp {
  app_id: string;
  name: string;
  description?: string;
  url: string;
  is_active: boolean;
}

interface PlatformAppsCardProps {
  tenantId: string;
  enabledApps: string[] | undefined;
  onSaved: (apps: string[]) => void;
}

export default function PlatformAppsCard({
  tenantId,
  enabledApps,
  onSaved,
}: PlatformAppsCardProps) {
  const [apps, setApps] = useState<PlatformApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/platform-apps?is_active=true")
      .then((res) => res.json())
      .then((data) => {
        const fetchedApps: PlatformApp[] = data.apps || [];
        setApps(fetchedApps);

        // If enabledApps is set, use it; otherwise all apps enabled by default
        if (enabledApps && enabledApps.length > 0) {
          setSelected(enabledApps);
        } else {
          setSelected(fetchedApps.map((a) => a.app_id));
        }
      })
      .catch(() => setApps([]))
      .finally(() => setLoadingApps(false));
  }, [enabledApps]);

  function toggleApp(appId: string) {
    setSelected((prev) =>
      prev.includes(appId)
        ? prev.filter((id) => id !== appId)
        : [...prev, appId]
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled_apps: selected }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setMessage("Saved successfully");
      onSaved(selected);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white">
          Platform Applications
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Enable or disable platform-level applications for this tenant
        </p>
      </div>
      <div className="p-6 space-y-4">
        {loadingApps ? (
          <p className="text-sm text-slate-400">Loading apps...</p>
        ) : apps.length === 0 ? (
          <p className="text-sm text-slate-500">
            No platform apps configured yet. Create apps in the{" "}
            <a
              href="/super-admin/platform-apps"
              className="text-blue-400 hover:underline"
            >
              Platform Apps
            </a>{" "}
            page.
          </p>
        ) : (
          <>
            {apps.map((app) => {
              const isOn = selected.includes(app.app_id);
              return (
                <div
                  key={app.app_id}
                  className="flex items-center justify-between"
                >
                  <div>
                    <label className="text-sm font-medium text-white">
                      {app.name}
                    </label>
                    {app.description && (
                      <p className="text-xs text-slate-400">
                        {app.description}
                      </p>
                    )}
                    {app.url && (
                      <p className="text-xs text-slate-500 font-mono truncate max-w-[300px]">
                        {app.url}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleApp(app.app_id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isOn ? "bg-blue-600" : "bg-slate-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isOn ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              );
            })}

            {!enabledApps && (
              <p className="text-xs text-slate-500">
                No explicit configuration — all apps enabled by default.
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {saving ? "Saving..." : "Save Applications"}
              </button>
              {message && (
                <span
                  className={`text-sm ${
                    message.includes("success")
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {message}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
