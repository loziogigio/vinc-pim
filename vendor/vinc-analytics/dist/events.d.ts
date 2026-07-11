/**
 * Canonical event taxonomy (Segment/RudderStack e-commerce spec aligned, so GA4/
 * Facebook/Google destinations map cleanly). DO NOT use string literals at call
 * sites — always reference EVENTS.* so the taxonomy stays single-sourced.
 */
export declare const EVENTS: {
    readonly PAGE_VIEWED: "Page Viewed";
    readonly CTA_CLICKED: "CTA Clicked";
    readonly CONTENT_ENGAGED: "Content Engaged";
    readonly PRODUCT_VIEWED: "Product Viewed";
    readonly CATEGORY_VIEWED: "Category Viewed";
    readonly PRODUCTS_SEARCHED: "Products Searched";
    readonly SEARCH_NO_RESULTS: "Search Returned No Results";
    readonly PRODUCT_UNAVAILABLE_VIEWED: "Product Unavailable Viewed";
    readonly LEAD_SUBMITTED: "Lead Submitted";
    readonly SIGNED_UP: "Signed Up";
    readonly ORDER_COMPLETED: "Order Completed";
    readonly DEMO_CREDENTIALS_SENT: "Demo Credentials Sent";
    readonly DEMO_ACTIVATED: "Demo Activated";
    readonly AUDIT_BOOKED: "Audit Booked";
    readonly AUDIT_SOLD: "Audit Sold";
    readonly GO_LIVE_SOLD: "Go-Live Sold";
    readonly CASH_COLLECTED: "Cash Collected";
    readonly DEAL_WON: "Deal Won";
    readonly DEAL_LOST: "Deal Lost";
};
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
//# sourceMappingURL=events.d.ts.map