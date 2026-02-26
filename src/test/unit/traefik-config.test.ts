/**
 * Unit Tests for Traefik Config Service
 *
 * Tests YAML generation logic (buildRouterConfig).
 * Does not test file I/O or database queries.
 */

import { describe, it, expect } from "vitest";
import { buildRouterConfig } from "@/lib/services/traefik-config.service";

describe("unit: Traefik Config - buildRouterConfig", () => {
  it("should generate valid router config for multiple domains", () => {
    const config = buildRouterConfig(
      ["hidros-b2b.vendereincloud.it", "dfl-b2b.vendereincloud.it"],
      "vinc-b2b-tenants",
      "vinc-b2b@file",
      90
    );

    expect(config).toHaveProperty("http.routers.vinc-b2b-tenants");
    const router = (config as Record<string, Record<string, Record<string, Record<string, unknown>>>>)
      .http.routers["vinc-b2b-tenants"];

    expect(router.rule).toBe(
      "Host(`hidros-b2b.vendereincloud.it`) || Host(`dfl-b2b.vendereincloud.it`)"
    );
    expect(router.entryPoints).toEqual(["websecure"]);
    expect(router.service).toBe("vinc-b2b@file");
    expect(router.priority).toBe(90);
    expect(router.tls).toEqual({ certResolver: "letsencrypt" });
    expect(router.middlewares).toEqual(["chain-public@file"]);
  });

  it("should generate valid router config for a single domain", () => {
    const config = buildRouterConfig(
      ["shop.example.com"],
      "vinc-b2b-tenants",
      "vinc-b2b@file",
      90
    );

    const router = (config as Record<string, Record<string, Record<string, Record<string, unknown>>>>)
      .http.routers["vinc-b2b-tenants"];

    expect(router.rule).toBe("Host(`shop.example.com`)");
  });

  it("should return empty http config when no domains provided", () => {
    const config = buildRouterConfig(
      [],
      "vinc-b2b-tenants",
      "vinc-b2b@file",
      90
    );

    expect(config).toEqual({ http: {} });
  });

  it("should use the provided router name as the key", () => {
    const config = buildRouterConfig(
      ["example.com"],
      "custom-router",
      "my-service@file",
      50
    );

    expect(config).toHaveProperty("http.routers.custom-router");
    expect(config).not.toHaveProperty("http.routers.vinc-b2b-tenants");
  });

  it("should use the provided service and priority", () => {
    const config = buildRouterConfig(
      ["example.com"],
      "test-router",
      "custom-service@docker",
      120
    );

    const router = (config as Record<string, Record<string, Record<string, Record<string, unknown>>>>)
      .http.routers["test-router"];

    expect(router.service).toBe("custom-service@docker");
    expect(router.priority).toBe(120);
  });

  it("should handle domains with ports", () => {
    const config = buildRouterConfig(
      ["localhost:3000", "dev.local:8080"],
      "vinc-b2b-tenants",
      "vinc-b2b@file",
      90
    );

    const router = (config as Record<string, Record<string, Record<string, Record<string, unknown>>>>)
      .http.routers["vinc-b2b-tenants"];

    expect(router.rule).toBe(
      "Host(`localhost:3000`) || Host(`dev.local:8080`)"
    );
  });
});
