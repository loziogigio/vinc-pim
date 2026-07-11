// src/test/unit/channel-config-drawer.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChannelConfigDrawer } from "@/components/notifications/ChannelConfigDrawer";

vi.mock("@/lib/i18n/useTranslation", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

describe("ChannelConfigDrawer", () => {
  it("renders the SMS field group and not email fields", () => {
    render(
      <ChannelConfigDrawer kind="sms" channel="default" recordData={{}} relationId="_channel" open onClose={() => {}} onSaved={() => {}} />,
    );
    expect(screen.getAllByText(/sms/i).length).toBeGreaterThanOrEqual(3);
    // email-only field label must not appear in the SMS drawer
    expect(screen.queryByText("Host SMTP")).toBeNull();
  });
  it("shows the configured placeholder for a masked secret", () => {
    render(
      <ChannelConfigDrawer kind="sms" channel="default" recordData={{ sms_api_key: "__VINC_SECRET_SET__" }} relationId="_channel" open onClose={() => {}} onSaved={() => {}} />,
    );
    const input = screen.getByLabelText(/API key SMS/i) as HTMLInputElement;
    expect(input.placeholder).toContain("secretConfiguredPlaceholder");
  });
  it("preserves other channels' fields when saving (cross-channel wipe regression)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const originalFetch = global.fetch;
    global.fetch = mockFetch;
    try {
      render(
        <ChannelConfigDrawer
          kind="sms"
          channel="default"
          recordData={{ email_enabled: true, smtp_host: "smtp.example.com", email_from: "x@y.z", sms_enabled: true }}
          relationId="_channel"
          open
          onClose={() => {}}
          onSaved={() => {}}
        />,
      );
      const saveBtn = screen.getByText("pages.notifications.settings.save");
      fireEvent.click(saveBtn);
      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      const call = mockFetch.mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain("/api/b2b/data-models/notification_settings/records");
      const body = JSON.parse((call[1] as RequestInit).body as string);
      expect(body.data.email_enabled).toBe(true);
      expect(body.data.smtp_host).toBe("smtp.example.com");
      expect(body.data.email_from).toBe("x@y.z");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
