"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeBlockSettings = YouTubeBlockSettings;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const input_js_1 = require("../ui/input.js");
const label_js_1 = require("../ui/label.js");
const lucide_react_1 = require("lucide-react");
/**
 * Extract YouTube video ID from various URL formats
 */
function getYouTubeVideoId(url) {
    if (!url)
        return null;
    // Handle youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch)
        return watchMatch[1];
    // Handle youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([^?]+)/);
    if (shortMatch)
        return shortMatch[1];
    // Handle youtube.com/embed/VIDEO_ID
    const embedMatch = url.match(/embed\/([^?]+)/);
    if (embedMatch)
        return embedMatch[1];
    return null;
}
/**
 * Get YouTube thumbnail URL
 */
function getYouTubeThumbnail(videoId, quality = 'hq') {
    const qualityMap = {
        default: 'default.jpg',
        hq: 'hqdefault.jpg',
        maxres: 'maxresdefault.jpg'
    };
    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}`;
}
function YouTubeBlockSettings({ config, onChange }) {
    const [localConfig, setLocalConfig] = (0, react_1.useState)(config);
    const videoId = getYouTubeVideoId(localConfig.url);
    (0, react_1.useEffect)(() => {
        // Debounce changes
        const timeout = setTimeout(() => {
            onChange(localConfig);
        }, 300);
        return () => clearTimeout(timeout);
    }, [localConfig, onChange]);
    const updateField = (field, value) => {
        setLocalConfig(prev => ({ ...prev, [field]: value }));
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "youtube-url", className: "text-sm font-medium text-[#5e5873]", children: "YouTube URL *" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { id: "youtube-url", type: "url", placeholder: "https://www.youtube.com/watch?v=...", value: localConfig.url || "", onChange: (e) => updateField("url", e.target.value), className: "h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[0.75rem] text-[#b9b9c3]", children: "Paste any YouTube video URL (youtube.com/watch, youtu.be, or embed link)" })] }), videoId && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-medium text-[#5e5873]", children: "Preview" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative overflow-hidden rounded-lg border-2 border-[#ebe9f1] bg-black", children: [(0, jsx_runtime_1.jsx)("img", { src: getYouTubeThumbnail(videoId, 'hq'), alt: "YouTube video thumbnail", className: "w-full h-auto" }), (0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 flex items-center justify-center bg-black/30", children: (0, jsx_runtime_1.jsx)("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg transition hover:bg-red-700", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Youtube, { className: "h-8 w-8 text-white", fill: "white" }) }) })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-[0.75rem] text-[#009688]", children: "\u2713 Valid YouTube video detected" })] })), localConfig.url && !videoId && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-yellow-300 bg-yellow-50 p-3", children: (0, jsx_runtime_1.jsx)("p", { className: "text-[0.857rem] text-yellow-800", children: "\u26A0\uFE0F Invalid YouTube URL. Please check the URL and try again." }) })), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "youtube-title", className: "text-sm font-medium text-[#5e5873]", children: "Video Title (Optional)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { id: "youtube-title", type: "text", placeholder: "e.g., Product Installation Guide", value: localConfig.title || "", onChange: (e) => updateField("title", e.target.value), className: "h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[0.75rem] text-[#b9b9c3]", children: "Shown above the video on the product page" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-lg border border-[#ebe9f1] bg-[#fafafc] p-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "youtube-autoplay", className: "text-sm font-medium text-[#5e5873]", children: "Autoplay Video" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[0.75rem] text-[#b9b9c3]", children: "Video starts playing automatically when page loads" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "relative inline-flex cursor-pointer items-center", children: [(0, jsx_runtime_1.jsx)("input", { id: "youtube-autoplay", type: "checkbox", checked: localConfig.autoplay || false, onChange: (e) => updateField("autoplay", e.target.checked), className: "peer sr-only" }), (0, jsx_runtime_1.jsx)("div", { className: "peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#009688]/20" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "youtube-width", className: "text-sm font-medium text-[#5e5873]", children: "Width" }), (0, jsx_runtime_1.jsxs)("select", { id: "youtube-width", value: localConfig.width || "100%", onChange: (e) => updateField("width", e.target.value), className: "h-10 w-full rounded-[0.428rem] border border-[#ebe9f1] bg-white px-3 text-[0.857rem] text-[#5e5873]", children: [(0, jsx_runtime_1.jsx)("option", { value: "100%", children: "Full Width (100%)" }), (0, jsx_runtime_1.jsx)("option", { value: "75%", children: "Large (75%)" }), (0, jsx_runtime_1.jsx)("option", { value: "50%", children: "Medium (50%)" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "youtube-height", className: "text-sm font-medium text-[#5e5873]", children: "Height" }), (0, jsx_runtime_1.jsxs)("select", { id: "youtube-height", value: localConfig.height || "450px", onChange: (e) => updateField("height", e.target.value), className: "h-10 w-full rounded-[0.428rem] border border-[#ebe9f1] bg-white px-3 text-[0.857rem] text-[#5e5873]", children: [(0, jsx_runtime_1.jsx)("option", { value: "300px", children: "Small (300px)" }), (0, jsx_runtime_1.jsx)("option", { value: "450px", children: "Medium (450px)" }), (0, jsx_runtime_1.jsx)("option", { value: "600px", children: "Large (600px)" }), (0, jsx_runtime_1.jsx)("option", { value: "responsive", children: "Responsive (16:9)" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-blue-200 bg-blue-50 p-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "mb-2 text-[0.857rem] font-medium text-blue-900", children: "\uD83D\uDCCC Example YouTube URLs:" }), (0, jsx_runtime_1.jsxs)("ul", { className: "space-y-1 text-[0.75rem] text-blue-800", children: [(0, jsx_runtime_1.jsx)("li", { children: "\u2022 youtube.com/watch?v=VIDEO_ID" }), (0, jsx_runtime_1.jsx)("li", { children: "\u2022 youtu.be/VIDEO_ID" }), (0, jsx_runtime_1.jsx)("li", { children: "\u2022 youtube.com/embed/VIDEO_ID" })] })] })] }));
}
//# sourceMappingURL=YouTubeBlockSettings.js.map