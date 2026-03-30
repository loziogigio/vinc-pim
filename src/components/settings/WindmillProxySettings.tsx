"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  OPERATION_DOMAINS,
  HOOK_PHASES,
  type WindmillProxySettings as ProxySettings,
  type ChannelHookConfig,
  type OperationHookConfig,
  type HookOperation,
  type HookPhase,
} from "@/lib/types/windmill-proxy";
import {
  Settings,
  Plus,
  Trash2,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  FolderOpen,
} from "lucide-react";

const DEFAULT_SETTINGS: ProxySettings = {
  enabled: false,
  timeout_ms: 5000,
  channels: [],
};

type WindmillProxySettingsProps = {
  /** When set, only show hooks for this domain (e.g. "cart", "order"). */
  filterDomain?: string;
};

export function WindmillProxySettings({ filterDomain }: WindmillProxySettingsProps = {}) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ProxySettings>(DEFAULT_SETTINGS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ssoUsers, setSSOUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [ssoLoading, setSSOLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );
  const [activeChannel, setActiveChannel] = useState(0);
  const [folderStatus, setFolderStatus] = useState<{
    exists: boolean;
    name: string;
  } | null>(null);
  const [availableChannels, setAvailableChannels] = useState<
    { code: string; name: string }[]
  >([]);

  const fetchSettings = useCallback(async () => {
    try {
      const [settingsRes, channelsRes] = await Promise.all([
        fetch("/api/b2b/settings/windmill-proxy"),
        fetch("/api/b2b/channels"),
      ]);
      const data = await settingsRes.json();
      if (data.success) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.windmill_proxy, channels: data.windmill_proxy?.channels || [] });
        setSSOUsers(data.windmill_proxy.sso_users || []);
        if (data.folder) setFolderStatus(data.folder);
      }
      const chData = await channelsRes.json();
      if (chData.success) {
        setAvailableChannels(chData.channels || []);
      }
    } catch {
      console.error("Failed to load windmill proxy settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/b2b/settings/windmill-proxy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, sso_users: ssoUsers }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus("saved");
        if (data.windmill_proxy?.sso_users) {
          setSSOUsers(data.windmill_proxy.sso_users);
        }
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/b2b/settings/windmill-proxy/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
    } catch {
      setTestResult({ success: false, message: "Network error" });
    } finally {
      setTesting(false);
    }
  };

  const handleOpenWindmill = async () => {
    setSSOLoading(true);
    try {
      const res = await fetch("/api/b2b/windmill/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success && data.windmill_url) {
        window.open(data.windmill_url, "_blank");
      } else {
        // Fallback: open raw URL without SSO
        const fallbackUrl =
          settings.windmill_external_url ||
          settings.windmill_base_url ||
          "#";
        window.open(fallbackUrl, "_blank");
      }
    } catch {
      const fallbackUrl =
        settings.windmill_external_url ||
        settings.windmill_base_url ||
        "#";
      window.open(fallbackUrl, "_blank");
    } finally {
      setSSOLoading(false);
    }
  };

  const addChannel = () => {
    const newChannel: ChannelHookConfig = {
      channel: settings.channels.length === 0 ? "*" : "",
      enabled: true,
      hooks: [],
    };
    setSettings((s) => ({ ...s, channels: [...s.channels, newChannel] }));
    setActiveChannel(settings.channels.length);
  };

  const removeChannel = (index: number) => {
    setSettings((s) => ({
      ...s,
      channels: s.channels.filter((_, i) => i !== index),
    }));
    if (activeChannel >= settings.channels.length - 1) {
      setActiveChannel(Math.max(0, settings.channels.length - 2));
    }
  };

  const updateChannel = (
    index: number,
    updates: Partial<ChannelHookConfig>,
  ) => {
    setSettings((s) => ({
      ...s,
      channels: s.channels.map((ch, i) =>
        i === index ? { ...ch, ...updates } : ch,
      ),
    }));
  };

  const findHook = (
    channelIdx: number,
    op: HookOperation,
    phase: HookPhase,
  ): OperationHookConfig | undefined => {
    return settings.channels[channelIdx]?.hooks.find(
      (h) => h.operation === op && h.phase === phase,
    );
  };

  const toggleHook = (
    channelIdx: number,
    op: HookOperation,
    phase: HookPhase,
  ) => {
    setSettings((s) => {
      const channels = [...s.channels];
      const ch = { ...channels[channelIdx] };
      const hooks = [...ch.hooks];

      const existingIdx = hooks.findIndex(
        (h) => h.operation === op && h.phase === phase,
      );
      if (existingIdx >= 0) {
        hooks.splice(existingIdx, 1);
      } else {
        hooks.push({
          operation: op,
          phase,
          script_path: `f/${folderStatus?.name || "erp"}/${channels[channelIdx]?.channel || "default"}/${phase}_${op.replace(".", "_")}`,
          enabled: true,
          blocking: phase === "on",
        });
      }

      ch.hooks = hooks;
      channels[channelIdx] = ch;
      return { ...s, channels };
    });
  };

  const updateHook = (
    channelIdx: number,
    op: HookOperation,
    phase: HookPhase,
    updates: Partial<OperationHookConfig>,
  ) => {
    setSettings((s) => {
      const channels = [...s.channels];
      const ch = { ...channels[channelIdx] };
      ch.hooks = ch.hooks.map((h) =>
        h.operation === op && h.phase === phase ? { ...h, ...updates } : h,
      );
      channels[channelIdx] = ch;
      return { ...s, channels };
    });
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentChannel = settings.channels?.[activeChannel] ?? null;

  return (
    <div className="space-y-4">
      {/* Master Toggle */}
      {!filterDomain && (
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <Label className="text-sm font-medium">
              {t("pages.settings.windmill.enableProxy")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("pages.settings.windmill.enableProxyDesc")}
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) =>
              setSettings((s) => ({ ...s, enabled }))
            }
          />
        </div>
      )}

      {/* Everything below is gated on enabled */}
      {(settings.enabled || filterDomain) && (
        <>
          {/* Connection Settings */}
          {!filterDomain && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">
                {t("pages.settings.windmill.connection")}
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">
                  {t("pages.settings.windmill.workspaceName")}
                </Label>
                <Input
                  type="text"
                  value={settings.workspace_name || ""}
                  disabled
                  className="text-xs bg-muted"
                  placeholder={t("pages.settings.windmill.workspaceNotSet")}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">
                  {t("pages.settings.windmill.defaultTimeout")}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={500}
                    max={30000}
                    step={500}
                    value={settings.timeout_ms}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        timeout_ms: parseInt(e.target.value) || 5000,
                      }))
                    }
                    className="text-xs w-24"
                  />
                  <span className="text-xs text-muted-foreground">ms</span>
                </div>
              </div>

              {/* Folder status */}
              {folderStatus && (
                <div className="flex items-center gap-2 col-span-2">
                  <FolderOpen className={`h-4 w-4 ${folderStatus.exists ? "text-green-600" : "text-red-500"}`} />
                  <span className="text-xs font-mono">{`f/${folderStatus.name}/`}</span>
                  {folderStatus.exists ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <span className="text-xs text-red-500">
                      {t("pages.settings.windmill.folderNotFound")}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing}
                  className="text-xs"
                >
                  {testing ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Zap className="h-3 w-3 mr-1" />
                  )}
                  {t("pages.settings.windmill.testConnection")}
                </Button>
                {testResult && (
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      testResult.success ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {testResult.message}
                  </span>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Channel Selector */}
          <div className="space-y-4 rounded-lg bg-white p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] border border-[#ebe9f1]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {t("pages.settings.windmill.channels")}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={addChannel}
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                {t("pages.settings.windmill.addChannel")}
              </Button>
            </div>

            {settings.channels.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {t("pages.settings.windmill.noChannels")}
              </p>
            ) : (
              <>
                {/* Channel Tabs */}
                <div className="flex gap-1 flex-wrap">
                  {settings.channels.map((ch, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveChannel(idx)}
                      className={`px-3 py-1.5 text-xs rounded-md transition ${
                        activeChannel === idx
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {ch.channel || t("pages.settings.windmill.unnamed")}
                      {!ch.enabled && " (off)"}
                    </button>
                  ))}
                </div>

                {/* Active Channel Config */}
                {currentChannel && (
                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    <div className="flex-1">
                      <Label className="text-xs">
                        {t("pages.settings.windmill.channelName")}
                      </Label>
                      <select
                        value={currentChannel.channel}
                        onChange={(e) =>
                          updateChannel(activeChannel, {
                            channel: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">
                          {t("pages.settings.windmill.selectChannel")}
                        </option>
                        <option value="*">* ({t("pages.settings.windmill.allChannels")})</option>
                        {availableChannels.map((ch) => (
                          <option key={ch.code} value={ch.code}>
                            {ch.name} ({ch.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <Switch
                        checked={currentChannel.enabled}
                        onCheckedChange={(enabled) =>
                          updateChannel(activeChannel, { enabled })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeChannel(activeChannel)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Operations by Domain */}
          {currentChannel && (
            <div className="space-y-4">
              {Object.entries(OPERATION_DOMAINS)
                      .filter(([domain, ops]) => {
                        if (filterDomain) return domain === filterDomain;
                        // Main page: only show domains with active hooks
                        return (ops as readonly HookOperation[]).some(op =>
                          HOOK_PHASES.some(phase => findHook(activeChannel, op, phase))
                        );
                      })
                      .map(([domain, ops]) => {
                        const domainOps = ops as readonly HookOperation[];
                        const activeCount = domainOps.filter(op =>
                          HOOK_PHASES.some(phase => findHook(activeChannel, op, phase))
                        ).length;

                        return (
                      <div key={domain} id={`domain-${domain}`} className="scroll-mt-4">
                        {/* Domain header */}
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/60 rounded-t-md border border-border border-b-0">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {t(`pages.settings.windmill.domains.${domain}`)}
                          </h3>
                          <span className="text-[10px] text-muted-foreground/60">
                            {activeCount > 0 ? (
                              <span className="text-primary font-medium">{activeCount} active</span>
                            ) : (
                              `${domainOps.length} ops`
                            )}
                          </span>
                        </div>

                        {/* Operations list */}
                        <div className="border border-border rounded-b-md divide-y divide-border overflow-hidden">
                          {domainOps.map((op) => {
                            const phaseHooks = HOOK_PHASES.map(phase => ({
                              phase,
                              hook: findHook(activeChannel, op, phase),
                            }));
                            const hasAnyHook = phaseHooks.some(h => !!h.hook);

                            return (
                              <div
                                key={op}
                                className={
                                  hasAnyHook
                                    ? "bg-primary/[0.04] border-l-2 border-l-primary"
                                    : "bg-card"
                                }
                              >
                                {/* Operation row: name + phase toggles */}
                                <div className="flex items-center px-3 py-2">
                                  <span
                                    className={`flex-1 font-mono text-[11px] ${
                                      hasAnyHook
                                        ? "font-medium text-foreground"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {op}
                                  </span>
                                  <div className="flex items-center gap-3">
                                    {phaseHooks.map(({ phase, hook }) => (
                                      <div key={phase} className="flex items-center gap-1.5 w-[70px] justify-center">
                                        <span
                                          className={`text-[10px] ${
                                            hook
                                              ? "text-primary font-semibold"
                                              : "text-muted-foreground/40"
                                          }`}
                                        >
                                          {phase}
                                        </span>
                                        <Switch
                                          checked={!!hook}
                                          onCheckedChange={() =>
                                            toggleHook(activeChannel, op, phase)
                                          }
                                          className={`scale-75 ${
                                            !hook ? "opacity-40 hover:opacity-100 transition-opacity" : ""
                                          }`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Detail cards for active phases */}
                                {hasAnyHook && (
                                  <div className="px-3 pb-2.5 space-y-1.5">
                                    {phaseHooks
                                      .filter(h => !!h.hook)
                                      .map(({ phase, hook }) => (
                                        <div
                                          key={phase}
                                          className="flex items-center gap-2 rounded-md bg-card border border-border px-2.5 py-1.5"
                                        >
                                          <span className="text-[10px] font-semibold text-primary uppercase w-11 shrink-0">
                                            {phase}
                                          </span>
                                          <Input
                                            type="text"
                                            value={hook!.script_path}
                                            onChange={(e) =>
                                              updateHook(activeChannel, op, phase as HookPhase, {
                                                script_path: e.target.value,
                                              })
                                            }
                                            className="text-[11px] h-7 flex-1 font-mono"
                                            placeholder={`f/${folderStatus?.name || "tenant"}/${currentChannel?.channel || "ch"}/${phase}_${op.replace(".", "_")}`}
                                          />
                                          {phase !== "after" && (
                                            <label className="flex items-center gap-1.5 text-[10px] cursor-pointer select-none shrink-0">
                                              <input
                                                type="checkbox"
                                                checked={hook!.blocking}
                                                onChange={(e) =>
                                                  updateHook(activeChannel, op, phase as HookPhase, {
                                                    blocking: e.target.checked,
                                                  })
                                                }
                                                className="h-3.5 w-3.5 rounded border-border"
                                              />
                                              <span
                                                className={
                                                  hook!.blocking
                                                    ? "text-amber-600 font-semibold"
                                                    : "text-muted-foreground"
                                                }
                                              >
                                                {t("pages.settings.windmill.blocking")}
                                              </span>
                                            </label>
                                          )}
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                        );
                      })}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleOpenWindmill}
              disabled={ssoLoading}
            >
              {ssoLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <ExternalLink className="h-3 w-3 mr-1" />
              )}
              {ssoLoading
                ? t("pages.settings.windmill.openingWindmill")
                : t("pages.settings.windmill.openWindmill")}
            </Button>

            <div className="flex items-center gap-2">
              {saveStatus === "saved" && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t("pages.settings.windmill.saved")}
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-xs text-red-600">
                  {t("pages.settings.windmill.saveError")}
                </span>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                )}
                {t("common.save")}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Save button always visible (to persist the enabled/disabled toggle) */}
      {!settings.enabled && !filterDomain && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {t("common.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
