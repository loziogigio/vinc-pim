import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ScriptsSection } from "@/components/b2c/storefront-settings/scripts-section";
import type { IB2CCustomScript } from "@/components/b2c/storefront-settings/types";

const EMPTY_SCRIPT: IB2CCustomScript = {
  label: "",
  src: "",
  inline_code: "",
  placement: "head",
  loading_strategy: "async",
  enabled: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ScriptsSection JavaScript upload", () => {
  it("sets the returned HTTPS asset as src without removing inline support", async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        url: "https://cdn.example.com/assets/tracking.js",
        fileName: "tracking.js",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ScriptsSection
        scripts={[{ ...EMPTY_SCRIPT, inline_code: "window.ready = true;" }]}
        onChange={onChange}
        saving={false}
        onSave={() => undefined}
        scriptUploadEndpoint="/api/b2b/b2b/portals/default/scripts/upload"
      />,
    );

    fireEvent.click(screen.getByText("Untitled Script"));
    fireEvent.change(screen.getByLabelText("Upload JavaScript file"), {
      target: {
        files: [
          new File(["window.tracking = true;"], "tracking.js", {
            type: "text/javascript",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({
          label: "tracking",
          src: "https://cdn.example.com/assets/tracking.js",
          inline_code: "window.ready = true;",
        }),
      ]);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/b2b/b2b/portals/default/scripts/upload",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
    expect(
      await screen.findByText("tracking.js uploaded and linked"),
    ).toBeInTheDocument();
  });

  it("keeps the existing script unchanged when upload fails", async () => {
    const onChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Only .js files are allowed" }),
      }),
    );

    render(
      <ScriptsSection
        scripts={[EMPTY_SCRIPT]}
        onChange={onChange}
        saving={false}
        onSave={() => undefined}
        scriptUploadEndpoint="/api/b2b/b2b/portals/default/scripts/upload"
      />,
    );

    fireEvent.change(screen.getByLabelText("Upload JavaScript file"), {
      target: {
        files: [new File(["plain"], "bad.txt", { type: "text/plain" })],
      },
    });

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Only .js files are allowed");
    expect(onChange).not.toHaveBeenCalled();
  });
});
