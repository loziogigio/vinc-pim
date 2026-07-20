"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LivePreview = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const react_1 = require("react");
const LivePreview = ({ device, blocks, productId, pageType, pageSlug, customerWebUrl, previewUrl, isDirty = true }) => {
    const [previewKey, setPreviewKey] = (0, react_1.useState)(0);
    const [iframeReady, setIframeReady] = (0, react_1.useState)(false);
    // Send blocks to preview iframe via postMessage (instant, no DB save)
    const iframeRef = (0, react_1.useRef)(null);
    const blocksRef = (0, react_1.useRef)(blocks);
    blocksRef.current = blocks;
    const computedUrl = (0, react_1.useMemo)(() => {
        if (previewUrl)
            return previewUrl;
        let url;
        if (pageType === "home") {
            url = `${customerWebUrl}?preview=true`;
            if (pageSlug)
                url += `&page=${pageSlug}`;
        }
        else if (productId) {
            url = `${customerWebUrl}/products/${productId}?preview=true`;
        }
        else {
            url = `/preview?slug=home&embed=true`;
        }
        return url;
    }, [previewUrl, productId, pageType, pageSlug, customerWebUrl]);
    // Reset iframeReady when the iframe is recreated (previewKey changes)
    (0, react_1.useEffect)(() => {
        setIframeReady(false);
    }, [previewKey]);
    // Listen for PREVIEW_READY from the storefront iframe (sent after its app mounts)
    (0, react_1.useEffect)(() => {
        const handleMessage = (event) => {
            if (event.data?.type === 'PREVIEW_READY') {
                setIframeReady(true);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);
    const sendBlocksToIframe = () => {
        const currentBlocks = blocksRef.current;
        if (currentBlocks.length === 0 || !iframeRef.current?.contentWindow)
            return;
        const blocksWithPosition = currentBlocks.map((block, index) => ({
            ...block,
            _builderPosition: index + 1,
            _builderIndex: index,
        }));
        const payload = {
            type: 'PREVIEW_UPDATE',
            blocks: blocksWithPosition,
            productId,
            pageSlug,
            timestamp: Date.now(),
            isDirty,
            showPositionIndicators: true,
        };
        iframeRef.current.contentWindow.postMessage(payload, '*');
    };
    // Send blocks whenever they change, or when iframe signals it's ready
    (0, react_1.useEffect)(() => {
        if (!iframeReady)
            return;
        sendBlocksToIframe();
    }, [blocks, productId, computedUrl, customerWebUrl, isDirty, iframeReady]);
    // REMOVED: Auto-save to preview cache - not needed with postMessage
    // Preview is now instant via postMessage, only save when user clicks "Save Draft"
    /* Old auto-save code removed:
    useEffect(() => {
      if (blocks.length === 0) return;
  
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
  
      // Auto-save removed - using postMessage instead
      */
    const handleRefresh = () => {
        setPreviewKey((prev) => prev + 1);
    };
    // Get device-specific width
    const deviceWidth = (0, react_1.useMemo)(() => {
        switch (device) {
            case "mobile":
                return "375px";
            case "tablet":
                return "768px";
            case "desktop":
            default:
                return "100%";
        }
    }, [device]);
    const deviceLabel = (0, react_1.useMemo)(() => {
        switch (device) {
            case "mobile":
                return "Mobile (375px)";
            case "tablet":
                return "Tablet (768px)";
            case "desktop":
            default:
                return "Desktop";
        }
    }, [device]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex h-full flex-col", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-t-[0.428rem] bg-[#e8eaed] px-6 py-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-2", children: (0, jsx_runtime_1.jsxs)("span", { className: "text-[1rem] font-medium text-[#5e5873]", children: ["Live Preview - ", deviceLabel, productId && (0, jsx_runtime_1.jsxs)("span", { className: "ml-2 text-[0.786rem] text-[#009688]", children: ["Product: ", productId] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[0.786rem] text-[#b9b9c3]", children: "Instant preview (no saves)" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleRefresh, className: "flex h-7 w-7 items-center justify-center rounded-[5px] text-[#6e6b7b] transition hover:bg-white", title: "Reload iframe", children: (0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCcw, { className: "h-[1.1rem] w-[1.1rem]" }) })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex-1 overflow-auto rounded-b-[0.428rem] bg-[#f0f1f5]", children: !previewUrl && !customerWebUrl ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex h-full flex-col items-center justify-center gap-4 px-6 py-6 text-[#b9b9c3]", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-12 w-12 text-amber-500" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[0.95rem] font-medium text-[#5e5873]", children: "Shop URL not configured" }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-[0.857rem]", children: ["Set the ", (0, jsx_runtime_1.jsx)("strong", { children: "Shop URL" }), " in ", (0, jsx_runtime_1.jsx)("strong", { children: "Settings \u2192 Branding" }), " to enable live preview."] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-3 text-[0.75rem] text-[#b9b9c3]", children: ["Attempted URL: ", (0, jsx_runtime_1.jsx)("code", { className: "rounded bg-slate-200 px-1 py-0.5", children: computedUrl })] })] })] })) : blocks.length || productId ? ((0, jsx_runtime_1.jsx)("div", { className: "flex h-full items-start justify-center px-6 py-6", children: (0, jsx_runtime_1.jsx)("div", { style: {
                            width: deviceWidth,
                            maxWidth: "100%"
                        }, className: "h-full min-h-[480px] overflow-hidden rounded-[0.428rem] border border-[#d8d6de] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] transition-all duration-300", children: (0, jsx_runtime_1.jsx)("iframe", { ref: iframeRef, src: computedUrl, className: "h-full w-full border-0 bg-white", style: { minHeight: "100%" }, title: "Live Preview", allow: "clipboard-read; clipboard-write" }, previewKey) }) })) : ((0, jsx_runtime_1.jsxs)("div", { className: "flex h-full flex-col items-center justify-center gap-4 px-6 py-6 text-[#b9b9c3]", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-12 w-12 opacity-60" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[0.857rem]", children: "Preview will appear here once you add blocks." })] })) })] }));
};
exports.LivePreview = LivePreview;
//# sourceMappingURL=LivePreview.js.map