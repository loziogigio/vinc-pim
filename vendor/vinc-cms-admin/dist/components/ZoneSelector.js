"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZoneSelector = ZoneSelector;
const jsx_runtime_1 = require("react/jsx-runtime");
const label_js_1 = require("../ui/label.js");
const radio_group_js_1 = require("../ui/radio-group.js");
const input_js_1 = require("../ui/input.js");
const lucide_react_1 = require("lucide-react");
const adapter_js_1 = require("../adapter.js");
const ZONE_OPTIONS = [
    {
        value: "zone1",
        icon: lucide_react_1.LayoutPanelLeft
    },
    {
        value: "zone2",
        icon: lucide_react_1.LayoutPanelTop
    },
    {
        value: "zone3",
        icon: lucide_react_1.TabletSmartphone,
        needsTabLabel: true
    },
    {
        value: "zone4",
        icon: lucide_react_1.LayoutGrid
    }
];
function ZoneSelector({ zone = "zone3", tabLabel = "", onChange }) {
    const t = (0, adapter_js_1.useCmsAdminT)();
    const handleZoneChange = (newZone) => {
        onChange(newZone, tabLabel);
    };
    const handleTabLabelChange = (newLabel) => {
        onChange(zone, newLabel);
    };
    const selectedOption = ZONE_OPTIONS.find(opt => opt.value === zone);
    const zoneLabels = {
        zone1: {
            label: t("components.builder.zoneSelector.zone1Label"),
            description: t("components.builder.zoneSelector.zone1Description"),
        },
        zone2: {
            label: t("components.builder.zoneSelector.zone2Label"),
            description: t("components.builder.zoneSelector.zone2Description"),
        },
        zone3: {
            label: t("components.builder.zoneSelector.zone3Label"),
            description: t("components.builder.zoneSelector.zone3Description"),
        },
        zone4: {
            label: t("components.builder.zoneSelector.zone4Label"),
            description: t("components.builder.zoneSelector.zone4Description"),
        },
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-medium", children: t("components.builder.zoneSelector.placementLabel") }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-muted-foreground mt-1", children: t("components.builder.zoneSelector.placementHint") })] }), (0, jsx_runtime_1.jsx)(radio_group_js_1.RadioGroup, { value: zone, onValueChange: handleZoneChange, children: (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: ZONE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const isSelected = zone === option.value;
                        const { label, description } = zoneLabels[option.value];
                        return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: `flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${isSelected
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"}`, children: [(0, jsx_runtime_1.jsx)(radio_group_js_1.RadioGroupItem, { value: option.value, id: option.value, className: "mt-0.5" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Icon, { className: "h-4 w-4 text-primary" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-sm", children: label })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-muted-foreground mt-1", children: description })] })] }), option.needsTabLabel && isSelected && ((0, jsx_runtime_1.jsxs)("div", { className: "ml-9 space-y-2", children: [(0, jsx_runtime_1.jsxs)(label_js_1.Label, { htmlFor: "tabLabel", className: "text-xs", children: [t("components.builder.zoneSelector.tabLabelField"), " *"] }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { id: "tabLabel", value: tabLabel, onChange: (e) => handleTabLabelChange(e.target.value), placeholder: t("components.builder.zoneSelector.tabLabelPlaceholder"), className: "text-sm" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-muted-foreground", children: t("components.builder.zoneSelector.tabLabelHint") })] }))] }, option.value));
                    }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 p-3 bg-muted rounded-lg", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs font-medium mb-2", children: t("components.builder.zoneSelector.previewLabel") }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-muted-foreground", children: [selectedOption?.value === "zone1" && ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: t("components.builder.zoneSelector.previewZone1") })), selectedOption?.value === "zone2" && ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: t("components.builder.zoneSelector.previewZone2") })), selectedOption?.value === "zone3" && ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: t("components.builder.zoneSelector.previewZone3", { tabLabel: tabLabel ? ` "${tabLabel}"` : "" }) })), selectedOption?.value === "zone4" && ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: t("components.builder.zoneSelector.previewZone4") }))] })] })] }));
}
//# sourceMappingURL=ZoneSelector.js.map