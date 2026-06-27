import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_CHANNELS,
  CHANNEL_UI_CONFIG,
  CHANNEL_LABELS,
} from "@/lib/constants/notification";
import { CHANNEL_ICONS } from "@/components/notifications/CampaignForm";

/**
 * Regression guard for the "Element type is invalid" crash in CampaignForm:
 * NOTIFICATION_CHANNELS gained "sms" but CHANNEL_ICONS was never updated, so the
 * campaign form rendered `<undefined />` for the SMS channel. tsc would have caught
 * the incomplete Record<NotificationChannel, ...>, but it is not enforced here — so
 * these run-time assertions stand in for it. Any new channel must appear in every map.
 */
describe("notification channel maps cover every channel", () => {
  it.each([...NOTIFICATION_CHANNELS])("CHANNEL_ICONS has a defined icon for %s", (channel) => {
    expect(CHANNEL_ICONS[channel]).toBeTruthy();
  });

  it.each([...NOTIFICATION_CHANNELS])("CHANNEL_UI_CONFIG has config for %s", (channel) => {
    expect(CHANNEL_UI_CONFIG[channel]).toBeTruthy();
    expect(CHANNEL_UI_CONFIG[channel].label).toBeTruthy();
  });

  it.each([...NOTIFICATION_CHANNELS])("CHANNEL_LABELS has a label for %s", (channel) => {
    expect(CHANNEL_LABELS[channel]).toBeTruthy();
  });

  it("has no extra keys in CHANNEL_ICONS beyond the known channels", () => {
    expect(Object.keys(CHANNEL_ICONS).sort()).toEqual([...NOTIFICATION_CHANNELS].sort());
  });
});
