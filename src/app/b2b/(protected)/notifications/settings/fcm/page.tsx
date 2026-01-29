"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Smartphone,
  Upload,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";

interface FCMSettings {
  configured: boolean;
  enabled: boolean;
  project_id: string;
  client_email: string;
  private_key_set: boolean;
  default_icon: string;
  default_color: string;
  ios_badge_behavior: string;
  // Client-side config
  messaging_sender_id: string;
  storage_bucket: string;
  // Android
  android_api_key: string;
  android_app_id: string;
  // iOS
  ios_api_key: string;
  ios_app_id: string;
  ios_bundle_id: string;
}

export default function FCMSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [privateKeySet, setPrivateKeySet] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [defaultIcon, setDefaultIcon] = useState("");
  const [defaultColor, setDefaultColor] = useState("#4285F4");
  const [iosBadgeBehavior, setIosBadgeBehavior] = useState("increment");

  // Client-side config state
  const [messagingSenderId, setMessagingSenderId] = useState("");
  const [storageBucket, setStorageBucket] = useState("");
  // Android
  const [androidApiKey, setAndroidApiKey] = useState("");
  const [androidAppId, setAndroidAppId] = useState("");
  // iOS
  const [iosApiKey, setIosApiKey] = useState("");
  const [iosAppId, setIosAppId] = useState("");
  const [iosBundleId, setIosBundleId] = useState("");

  // Load existing settings
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/b2b/settings/fcm");
      if (!res.ok) throw new Error("Failed to load settings");
      const data: FCMSettings = await res.json();

      setEnabled(data.enabled);
      setProjectId(data.project_id || "");
      setClientEmail(data.client_email || "");
      setPrivateKeySet(data.private_key_set || false);
      setDefaultIcon(data.default_icon || "");
      setDefaultColor(data.default_color || "#4285F4");
      setIosBadgeBehavior(data.ios_badge_behavior || "increment");
      // Client-side config
      setMessagingSenderId(data.messaging_sender_id || "");
      setStorageBucket(data.storage_bucket || "");
      // Android
      setAndroidApiKey(data.android_api_key || "");
      setAndroidAppId(data.android_app_id || "");
      // iOS
      setIosApiKey(data.ios_api_key || "");
      setIosAppId(data.ios_app_id || "");
      setIosBundleId(data.ios_bundle_id || "");
    } catch (err) {
      setError("Failed to load FCM settings");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Handle JSON file upload (service account or google-services.json)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        // Check if this is a service account JSON (has private_key)
        if (json.private_key) {
          if (json.project_id) setProjectId(json.project_id);
          if (json.client_email) setClientEmail(json.client_email);
          setPrivateKey(json.private_key);
          setPrivateKeySet(false);
          setSuccess("Firebase service account loaded from JSON file");
        }
        // Check if this is google-services.json (Android)
        else if (json.project_info) {
          // Extract from google-services.json format
          const projectInfo = json.project_info;
          const client = json.client?.[0];
          const apiKey = client?.api_key?.[0]?.current_key;
          const appId = client?.client_info?.mobilesdk_app_id;

          if (projectInfo.project_id) setProjectId(projectInfo.project_id);
          if (projectInfo.project_number) setMessagingSenderId(projectInfo.project_number);
          if (projectInfo.storage_bucket) setStorageBucket(projectInfo.storage_bucket);
          if (apiKey) setAndroidApiKey(apiKey);
          if (appId) setAndroidAppId(appId);

          setSuccess("Android google-services.json loaded. Remember to also upload the service account key for server-side push.");
        } else {
          throw new Error("Unknown format");
        }

        setTimeout(() => setSuccess(null), 5000);
      } catch {
        setError("Invalid JSON file. Upload either a service account key or google-services.json");
        setTimeout(() => setError(null), 5000);
      }
    };
    reader.readAsText(file);
  };

  // Save settings
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const payload: Record<string, unknown> = {
        enabled,
        project_id: projectId,
        client_email: clientEmail,
        default_icon: defaultIcon,
        default_color: defaultColor,
        ios_badge_behavior: iosBadgeBehavior,
        // Client-side config
        messaging_sender_id: messagingSenderId,
        storage_bucket: storageBucket,
        // Android
        android_api_key: androidApiKey,
        android_app_id: androidAppId,
        // iOS
        ios_api_key: iosApiKey,
        ios_app_id: iosAppId,
        ios_bundle_id: iosBundleId,
      };

      // Only send private key if it's been changed
      if (privateKey) {
        payload.private_key = privateKey;
      }

      const res = await fetch("/api/b2b/settings/fcm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setSuccess("FCM settings saved successfully!");
      setPrivateKey(""); // Clear the private key input
      setPrivateKeySet(true); // Mark as set
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Disable FCM
  const handleDisable = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/b2b/settings/fcm", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disable FCM");

      setEnabled(false);
      setSuccess("FCM disabled");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable FCM");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/b2b/notifications/settings"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Firebase Cloud Messaging (FCM)
            </h1>
            <p className="text-sm text-slate-500">
              Configure push notifications for iOS and Android mobile apps
            </p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-slate-900">Enable FCM</h3>
            <p className="text-sm text-slate-500">
              Toggle push notifications for mobile apps
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {/* Upload JSON File */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="font-medium text-slate-900 mb-4">
          Import Firebase Configuration
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Upload either the <strong>service account JSON</strong> (for server push) or <strong>google-services.json</strong> (for Android client config)
        </p>
        <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
          <Upload className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-600">
            Click to upload JSON file
          </span>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Manual Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="font-medium text-slate-900 mb-4">
          Firebase Configuration
        </h3>

        <div className="space-y-4">
          {/* Project ID */}
          <div>
            <Label htmlFor="project_id">Project ID</Label>
            <Input
              id="project_id"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="my-firebase-project"
              className="mt-1"
            />
          </div>

          {/* Client Email */}
          <div>
            <Label htmlFor="client_email">Client Email</Label>
            <Input
              id="client_email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="firebase-adminsdk-xxx@project.iam.gserviceaccount.com"
              className="mt-1"
            />
          </div>

          {/* Private Key */}
          <div>
            <Label htmlFor="private_key">
              Private Key
              {privateKeySet && !privateKey && (
                <span className="ml-2 text-xs text-emerald-600 font-normal">
                  ✓ Already configured
                </span>
              )}
            </Label>
            <div className="relative mt-1">
              <textarea
                id="private_key"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder={
                  privateKeySet
                    ? "Leave empty to keep existing key, or paste new key to replace"
                    : "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                }
                className="w-full h-32 px-3 py-2 border border-slate-200 rounded-lg font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                style={{
                  WebkitTextSecurity: showPrivateKey ? "none" : "disc",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600"
              >
                {showPrivateKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Optional Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="font-medium text-slate-900 mb-4">Optional Settings</h3>

        <div className="space-y-4">
          {/* Default Icon */}
          <div>
            <Label htmlFor="default_icon">Default Notification Icon URL</Label>
            <Input
              id="default_icon"
              value={defaultIcon}
              onChange={(e) => setDefaultIcon(e.target.value)}
              placeholder="https://example.com/icon.png"
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">
              URL to the default notification icon (recommended: 192x192px PNG)
            </p>
          </div>

          {/* Default Color */}
          <div>
            <Label htmlFor="default_color">Notification Accent Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                id="default_color"
                value={defaultColor}
                onChange={(e) => setDefaultColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <Input
                value={defaultColor}
                onChange={(e) => setDefaultColor(e.target.value)}
                placeholder="#4285F4"
                className="flex-1"
              />
            </div>
          </div>

          {/* iOS Badge Behavior */}
          <div>
            <Label htmlFor="ios_badge">iOS Badge Behavior</Label>
            <select
              id="ios_badge"
              value={iosBadgeBehavior}
              onChange={(e) => setIosBadgeBehavior(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="increment">Increment badge count</option>
              <option value="set">Set specific badge number</option>
              <option value="none">Don&apos;t modify badge</option>
            </select>
          </div>
        </div>
      </div>

      {/* Client-Side Config (for mobile app SDK) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="font-medium text-slate-900 mb-2">
          Client-Side Configuration
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          These values are used by the mobile app to initialize Firebase SDK
        </p>

        <div className="space-y-4">
          {/* Messaging Sender ID */}
          <div>
            <Label htmlFor="messaging_sender_id">Messaging Sender ID</Label>
            <Input
              id="messaging_sender_id"
              value={messagingSenderId}
              onChange={(e) => setMessagingSenderId(e.target.value)}
              placeholder="999634491165"
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">
              Found in google-services.json as project_number
            </p>
          </div>

          {/* Storage Bucket */}
          <div>
            <Label htmlFor="storage_bucket">Storage Bucket</Label>
            <Input
              id="storage_bucket"
              value={storageBucket}
              onChange={(e) => setStorageBucket(e.target.value)}
              placeholder="my-project.firebasestorage.app"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Android Configuration */}
      <div className="bg-white rounded-xl border border-green-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <span className="text-green-600 text-lg">🤖</span>
          </div>
          <h3 className="font-medium text-slate-900">Android Configuration</h3>
        </div>

        <div className="space-y-4">
          {/* Android API Key */}
          <div>
            <Label htmlFor="android_api_key">API Key</Label>
            <Input
              id="android_api_key"
              value={androidApiKey}
              onChange={(e) => setAndroidApiKey(e.target.value)}
              placeholder="AIzaSyCDpmyEki1PB6VbgINzR1zkVHJqx0iOUss"
              className="mt-1"
            />
          </div>

          {/* Android App ID */}
          <div>
            <Label htmlFor="android_app_id">App ID</Label>
            <Input
              id="android_app_id"
              value={androidAppId}
              onChange={(e) => setAndroidAppId(e.target.value)}
              placeholder="1:999634491165:android:93cbb900332b2bb312f3f4"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* iOS Configuration */}
      <div className="bg-white rounded-xl border border-blue-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="text-blue-600 text-lg">🍎</span>
          </div>
          <h3 className="font-medium text-slate-900">iOS Configuration</h3>
        </div>

        <div className="space-y-4">
          {/* iOS API Key */}
          <div>
            <Label htmlFor="ios_api_key">API Key</Label>
            <Input
              id="ios_api_key"
              value={iosApiKey}
              onChange={(e) => setIosApiKey(e.target.value)}
              placeholder="AIzaSyAbc123..."
              className="mt-1"
            />
          </div>

          {/* iOS App ID */}
          <div>
            <Label htmlFor="ios_app_id">App ID</Label>
            <Input
              id="ios_app_id"
              value={iosAppId}
              onChange={(e) => setIosAppId(e.target.value)}
              placeholder="1:999634491165:ios:abc123..."
              className="mt-1"
            />
          </div>

          {/* iOS Bundle ID */}
          <div>
            <Label htmlFor="ios_bundle_id">Bundle ID</Label>
            <Input
              id="ios_bundle_id"
              value={iosBundleId}
              onChange={(e) => setIosBundleId(e.target.value)}
              placeholder="it.dfl.eventi"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleDisable}
          disabled={saving || !enabled}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Disable FCM
        </Button>

        <Button
          onClick={handleSave}
          disabled={saving || !projectId || !clientEmail}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>

      {/* Help Text */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">How to get Firebase credentials</h3>
        <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
          <li>Go to Firebase Console → Your Project</li>
          <li>Click the gear icon ⚙️ → Project settings</li>
          <li>Go to &quot;Service accounts&quot; tab</li>
          <li>Click &quot;Generate new private key&quot;</li>
          <li>Upload the downloaded JSON file above</li>
        </ol>
      </div>
    </div>
  );
}
