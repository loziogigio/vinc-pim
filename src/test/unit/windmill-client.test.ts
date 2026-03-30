/**
 * Windmill Client Tests
 *
 * Unit tests for the Windmill HTTP client module.
 * Mocks global fetch to test success, timeout, and error scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original env
const originalEnv = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    WINDMILL_BASE_URL: "http://windmill-test:8000",
    WINDMILL_TOKEN: "test-token-abc",
  };
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

describe("unit: WindmillError", () => {
  it("should create error with status and upstream", async () => {
    const { WindmillError } = await import("@/lib/services/windmill-client");

    // Arrange & Act
    const err = new WindmillError("test error", 500, "upstream body");

    // Assert
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("WindmillError");
    expect(err.message).toBe("test error");
    expect(err.status).toBe(500);
    expect(err.upstream).toBe("upstream body");
  });

  it("should create error without upstream", async () => {
    const { WindmillError } = await import("@/lib/services/windmill-client");

    const err = new WindmillError("timeout", 504);

    expect(err.status).toBe(504);
    expect(err.upstream).toBeUndefined();
  });
});

describe("unit: windmillRun", () => {
  it("should call Windmill sync endpoint and return parsed JSON", async () => {
    // Arrange
    const mockResponse = { allowed: true, message: "ok" };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const { windmillRun } = await import("@/lib/services/windmill-client");

    // Act
    const result = await windmillRun(
      "vinc-tenant1",
      "f/erp/check_stock",
      { entity_code: "SKU-001" },
      5000,
      "http://windmill-test:8000",
    );

    // Assert
    expect(result).toEqual(mockResponse);
    expect(fetchSpy).toHaveBeenCalledOnce();

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      "http://windmill-test:8000/api/w/vinc-tenant1/jobs/run_wait_result/p/f/erp/check_stock",
    );
    expect(opts?.method).toBe("POST");
    expect(JSON.parse(opts?.body as string)).toEqual({ entity_code: "SKU-001" });
  });

  it("should include Authorization header when WINDMILL_TOKEN is set", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const { windmillRun } = await import("@/lib/services/windmill-client");

    await windmillRun("ws", "script", {}, 5000, "http://windmill-test:8000");

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token-abc");
  });

  it("should throw WindmillError on non-OK response", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );

    const { windmillRun, WindmillError } = await import("@/lib/services/windmill-client");

    // Act & Assert
    await expect(
      windmillRun("ws", "f/missing/script", {}, 5000, "http://windmill-test:8000"),
    ).rejects.toThrow(WindmillError);

    try {
      await windmillRun("ws", "f/missing/script", {}, 5000, "http://windmill-test:8000");
    } catch (err) {
      expect((err as InstanceType<typeof WindmillError>).status).toBe(404);
    }
  });

  it("should throw WindmillError with status 504 on timeout", async () => {
    // Arrange — fetch that never resolves, triggers AbortController
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, opts) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const { windmillRun, WindmillError } = await import("@/lib/services/windmill-client");

    // Act & Assert
    await expect(
      windmillRun("ws", "f/slow/script", {}, 50, "http://windmill-test:8000"),
    ).rejects.toThrow(WindmillError);

    try {
      await windmillRun("ws", "f/slow/script", {}, 50, "http://windmill-test:8000");
    } catch (err) {
      expect((err as InstanceType<typeof WindmillError>).status).toBe(504);
      expect((err as InstanceType<typeof WindmillError>).message).toBe("Windmill timeout");
    }
  });

  it("should throw WindmillError with status 502 on network error", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const { windmillRun, WindmillError } = await import("@/lib/services/windmill-client");

    // Act & Assert
    try {
      await windmillRun("ws", "f/script", {}, 5000, "http://windmill-test:8000");
    } catch (err) {
      expect(err).toBeInstanceOf(WindmillError);
      expect((err as InstanceType<typeof WindmillError>).status).toBe(502);
      expect((err as InstanceType<typeof WindmillError>).message).toContain("ECONNREFUSED");
    }
  });
});

describe("unit: windmillRunAsync", () => {
  it("should call Windmill async endpoint and return job ID", async () => {
    // Arrange
    const jobId = "job-abc-123";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(jobId), { status: 200 }),
    );

    const { windmillRunAsync } = await import("@/lib/services/windmill-client");

    // Act
    const result = await windmillRunAsync(
      "vinc-tenant1",
      "f/erp/after_confirm",
      { order_id: "ORD-001" },
      "http://windmill-test:8000",
    );

    // Assert
    expect(result).toBe(jobId);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      "http://windmill-test:8000/api/w/vinc-tenant1/jobs/run/p/f/erp/after_confirm",
    );
  });

  it("should throw WindmillError on non-OK async response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Error", { status: 500 }),
    );

    const { windmillRunAsync, WindmillError } = await import("@/lib/services/windmill-client");

    await expect(
      windmillRunAsync("ws", "f/broken", {}, "http://windmill-test:8000"),
    ).rejects.toThrow(WindmillError);
  });
});

describe("unit: windmillCreateWorkspace", () => {
  it("should call workspace creation endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 201 }),
    );

    const { windmillCreateWorkspace } = await import("@/lib/services/windmill-client");

    // Act
    await windmillCreateWorkspace("vinc-new-tenant", "http://windmill-test:8000");

    // Assert
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://windmill-test:8000/api/workspaces/create");
    expect(JSON.parse(opts?.body as string)).toEqual({
      id: "vinc-new-tenant",
      name: "vinc-new-tenant",
    });
  });

  it("should not throw on 409 (workspace already exists)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Conflict", { status: 409 }),
    );

    const { windmillCreateWorkspace } = await import("@/lib/services/windmill-client");

    // Act & Assert — should not throw
    await expect(
      windmillCreateWorkspace("vinc-existing", "http://windmill-test:8000"),
    ).resolves.toBeUndefined();
  });

  it("should throw WindmillError on other error status codes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Forbidden", { status: 403 }),
    );

    const { windmillCreateWorkspace, WindmillError } = await import(
      "@/lib/services/windmill-client"
    );

    await expect(
      windmillCreateWorkspace("vinc-bad", "http://windmill-test:8000"),
    ).rejects.toThrow(WindmillError);
  });
});

describe("unit: windmillCreateUserToken", () => {
  it("should call token creation endpoint and return token", async () => {
    const token = "wm-token-xyz";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(token), { status: 200 }),
    );

    const { windmillCreateUserToken } = await import("@/lib/services/windmill-client");

    // Act
    const result = await windmillCreateUserToken(
      "vinc-tenant1",
      "user@example.com",
      "http://windmill-test:8000",
    );

    // Assert
    expect(result).toBe(token);

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      "http://windmill-test:8000/api/w/vinc-tenant1/users/tokens/create",
    );
    expect(JSON.parse(opts?.body as string)).toEqual({
      email: "user@example.com",
      label: "vinc-sso",
    });
  });

  it("should throw WindmillError on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    const { windmillCreateUserToken, WindmillError } = await import(
      "@/lib/services/windmill-client"
    );

    await expect(
      windmillCreateUserToken("ws", "bad@example.com", "http://windmill-test:8000"),
    ).rejects.toThrow(WindmillError);
  });
});
