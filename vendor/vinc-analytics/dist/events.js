/**
 * Canonical event taxonomy (Segment/RudderStack e-commerce spec aligned, so GA4/
 * Facebook/Google destinations map cleanly). DO NOT use string literals at call
 * sites — always reference EVENTS.* so the taxonomy stays single-sourced.
 */
export const EVENTS = {
    // Page Viewed is emitted via page(); the constant exists for reference/queries.
    PAGE_VIEWED: 'Page Viewed',
    CTA_CLICKED: 'CTA Clicked',
    CONTENT_ENGAGED: 'Content Engaged',
    PRODUCT_VIEWED: 'Product Viewed',
    CATEGORY_VIEWED: 'Category Viewed',
    PRODUCTS_SEARCHED: 'Products Searched',
    SEARCH_NO_RESULTS: 'Search Returned No Results',
    PRODUCT_UNAVAILABLE_VIEWED: 'Product Unavailable Viewed',
    LEAD_SUBMITTED: 'Lead Submitted',
    SIGNED_UP: 'Signed Up',
    ORDER_COMPLETED: 'Order Completed',
    // Selling-machine loop events (Phase 1)
    DEMO_CREDENTIALS_SENT: 'Demo Credentials Sent',
    DEMO_ACTIVATED: 'Demo Activated',
    AUDIT_BOOKED: 'Audit Booked',
    AUDIT_SOLD: 'Audit Sold',
    GO_LIVE_SOLD: 'Go-Live Sold',
    CASH_COLLECTED: 'Cash Collected',
    DEAL_WON: 'Deal Won',
    DEAL_LOST: 'Deal Lost',
};
//# sourceMappingURL=events.js.map