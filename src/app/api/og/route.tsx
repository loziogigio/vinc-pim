import { ImageResponse } from "next/og";
import { SEO_CONFIG } from "@/lib/config/seo";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? SEO_CONFIG.defaultMetadata.defaultTitle;
  const description = searchParams.get("description") ?? SEO_CONFIG.defaultMetadata.defaultDescription;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0f172a, #312e81)",
          color: "white",
          padding: "80px",
          fontFamily: "Inter, Arial, sans-serif"
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%"
          }}
        >
          <div style={{ fontSize: 28, opacity: 0.7, letterSpacing: "0.1em" }}>VINC Trade Supply</div>
          <div>
            <div style={{ fontSize: 70, fontWeight: 600, lineHeight: 1.1 }}>{title}</div>
            <div style={{ marginTop: 24, fontSize: 28, opacity: 0.85, maxWidth: "880px" }}>{description}</div>
          </div>
          <div style={{ fontSize: 24, opacity: 0.6 }}>Configure premium storefront experiences</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630
    }
  );
}
