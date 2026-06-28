// src/test/unit/channel-config-drawer.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChannelConfigDrawer } from "@/components/notifications/ChannelConfigDrawer";

vi.mock("@/lib/i18n/useTranslation", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

describe("ChannelConfigDrawer", () => {
  it("renders the SMS field group and not email fields", () => {
    render(
      <ChannelConfigDrawer kind="sms" channel="default" recordData={{}} relationId="_channel" open onClose={() => {}} onSaved={() => {}} />,
    );
    expect(screen.getAllByText(/sms/i).length).toBeGreaterThan(0);
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
});
