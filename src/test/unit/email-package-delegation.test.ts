import { describe, it, expect } from "vitest";
import { sendEmailViaSmtp, sendEmailViaGraph } from "vinc-notifications/server";

describe("vinc-notifications/server is importable from CS", () => {
  it("exposes the email transports", () => {
    expect(typeof sendEmailViaSmtp).toBe("function");
    expect(typeof sendEmailViaGraph).toBe("function");
  });
});
