/**
 * Pricing Provider Types
 *
 * ErpPriceData mirrors vinc-b2b's interface exactly — this is the output contract.
 * PIM normalizes all external provider responses to this shape.
 */

// ============================================
// SUB-TYPES (mirror vinc-b2b erp-prices.ts)
// ============================================

export interface PackagingOption {
  packaging_uom_description: string;
  packaging_code: string;
  packaging_is_default: boolean;
  packaging_is_smallest: boolean;
  qty_x_packaging: number;
  packaging_uom: string;
}

export interface PackagingOptionLegacy {
  CodiceImballo1: string;
  Descrizione: string;
  DescrizioneUM: string;
  IdImballo: number;
  IsImballoDiDefaultXVendita: boolean;
  IsImballoDiDefaultXVenditaDiretta: boolean;
  IsImballoPiuPiccolo: boolean;
  Message: string;
  QtaXImballo: number;
  ReturnCode: number;
  UM: string;
  id: number;
  label: string;
  amount: number;
}

export interface SupplierArrival {
  article_code: string;
  expected_date?: string;
  confirmed_date?: string;
  week_number?: number;
  expected_qty?: number;
}

export interface ProductLabelAction {
  LABEL: string;
  ADD_TO_CART: boolean;
  availability: number;
  is_managed_substitutes: boolean;
  is_managed_supplier_order: boolean;
  substitute_available: boolean;
  order_supplier_available: SupplierArrival[];
  case: number;
}

export interface ImprovingPromo {
  is_improving_promo: boolean;
  is_improving_promo_net_price: boolean;
  promo_price: number;
  promo_code: string;
  promo_title: string;
  promo_row: number;
  start_promo_date: string;
  end_promo_date: string;
  discount_extra: number[];
  num_promo: number;
  num_promo_canvas: number;
  promozionale: boolean;
  is_promo: boolean;
  promo: boolean;
}

// ============================================
// CORE OUTPUT CONTRACT
// ============================================

export interface ErpPriceData {
  entity_code: string;
  net_price: number;
  gross_price: number;
  price: number;
  price_discount: number;
  vat_percent: number;
  availability: number;
  discount: number[];

  packaging_option_smallest?: PackagingOption;
  packaging_option_default?: PackagingOption;
  packaging_options_all?: PackagingOption[];
  packaging_options?: PackagingOptionLegacy[];

  improving_promo?: ImprovingPromo;

  product_label_action?: ProductLabelAction;

  // Optional ERP/logic-related fields
  count_promo?: number;
  is_improving_promo_net_price?: boolean;
  buy_did?: boolean;
  buy_did_amount?: number;
  buy_did_last_date?: string;

  promo_price?: number;
  promo_code?: string;
  promo_row?: number;
  is_improving_promo?: boolean;
  is_promo?: boolean;
  promo?: boolean;
  promozionale?: boolean;
  promo_title?: string;
  start_promo_date?: string;
  end_promo_date?: string;
  discount_extra?: number[];
  num_promo?: number;
  num_promo_canvas?: number;
  discount_description: string;

  pricelist_type?: string;
  pricelist_code?: string;

  order_suplier_available?: SupplierArrival[];
  prod_substitution?: any[];
}

// ============================================
// REQUEST / CONTEXT
// ============================================

export interface IPricingRequest {
  entity_codes: string[];
  quantity_list: number[];
  customer_code: string;
  address_code: string;
  id_cart: string;
}

export interface IPricingContext {
  tenant_id: string;
  tenant_db: string;
  customer_code: string;
  address_code: string;
  id_cart: string;
  channel?: string;
}

// ============================================
// PROVIDER CONFIG (per-tenant, stored in DB)
// ============================================

export interface ILegacyErpProviderConfig {
  api_base_url: string;
  auth_method: "bearer" | "api_key" | "none";
  api_key?: string;
  bearer_token?: string;
  timeout_ms: number;
  enabled: boolean;
}

export interface IGenericHttpResponseMapping {
  entity_code_field: string;
  net_price_field: string;
  gross_price_field: string;
  price_field: string;
  vat_percent_field?: string;
  availability_field?: string;
  discount_field?: string;
}

export interface IGenericHttpProviderConfig {
  api_base_url: string;
  auth_method: "bearer" | "api_key" | "basic" | "none";
  api_key?: string;
  api_secret?: string;
  bearer_token?: string;
  custom_headers?: Record<string, string>;
  endpoint: string;
  timeout_ms: number;
  response_mapping: IGenericHttpResponseMapping;
  enabled: boolean;
}

export interface ICircuitBreakerConfig {
  failure_threshold: number;
  recovery_timeout_ms: number;
  success_threshold: number;
}

export interface ITenantPricingConfig {
  tenant_id: string;
  active_provider: string;

  providers: {
    legacy_erp?: ILegacyErpProviderConfig;
    generic_http?: IGenericHttpProviderConfig;
  };

  cache: {
    enabled: boolean;
    ttl_seconds: number;
  };

  fallback: {
    log_errors: boolean;
    max_retries: number;
  };

  circuit_breaker: ICircuitBreakerConfig;

  created_at: Date;
  updated_at: Date;
}

// ============================================
// SERVICE RESPONSE
// ============================================

export interface IPricingErrors {
  timed_out?: string[];
  invalid_response?: string[];
  provider_error?: string;
}

export interface IPricingResponse {
  status: string;
  data: Record<string, ErpPriceData>;
  errors?: IPricingErrors;
}
