import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PermissionsProvider, useCan, Can, usePriceAccess } from "@/components/b2b/permissions/permissions-context";

const DTO = {
  permissions: ["orders.view"],
  entitledApps: ["store-orders"],
  scope: { channels: "all", customers: "all", price_lists: "all" },
} as const;

function Probe() {
  const canView = useCan("orders.view");
  const canCancel = useCan("orders.cancel");
  return <div>{`${canView}:${canCancel}`}</div>;
}

describe("PermissionsProvider / useCan / Can", () => {
  it("useCan reflects the provided permissions", () => {
    render(
      <PermissionsProvider value={DTO as never}>
        <Probe />
      </PermissionsProvider>
    );
    expect(screen.getByText("true:false")).toBeInTheDocument();
  });

  it("<Can> renders children only when permitted", () => {
    render(
      <PermissionsProvider value={DTO as never}>
        <Can permission="orders.view"><span>YES</span></Can>
        <Can permission="orders.cancel"><span>NO</span></Can>
      </PermissionsProvider>
    );
    expect(screen.getByText("YES")).toBeInTheDocument();
    expect(screen.queryByText("NO")).toBeNull();
  });

  it("useCan returns false outside a provider (fail-closed)", () => {
    function Bare() { return <div>{`${useCan("orders.view")}`}</div>; }
    render(<Bare />);
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  function PriceProbe() {
    return <div>{`price:${usePriceAccess()}`}</div>;
  }

  it("usePriceAccess returns the provided level", () => {
    const dto = { permissions: [], entitledApps: [], scope: { channels: "all", customers: "all", price_lists: "all" }, priceAccess: "edit" };
    render(<PermissionsProvider value={dto as never}><PriceProbe /></PermissionsProvider>);
    expect(screen.getByText("price:edit")).toBeInTheDocument();
  });

  it("usePriceAccess defaults to none outside a provider", () => {
    render(<PriceProbe />);
    expect(screen.getByText("price:none")).toBeInTheDocument();
  });
});
