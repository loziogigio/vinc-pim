"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BadgeCheck,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronRightIcon,
  ClipboardList,
  FileText,
  Heart,
  Info,
  LifeBuoy,
  MessageCircle,
  Minus,
  Package,
  PlayCircle,
  Plus,
  RefreshCw,
  Ruler,
  ShieldCheck,
  Star,
  Truck,
  Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MockProduct } from "@/lib/data/mockCatalog";
import { ProductMediaGallery, type ProductGalleryImage } from "./ProductMediaGallery";

type BadgeVariant = "info" | "warning" | "success";
type IconKey =
  | "truck"
  | "shield"
  | "refresh"
  | "support"
  | "badge"
  | "package"
  | "file"
  | "wrench"
  | "ruler"
  | "video"
  | "clipboard";

const iconLibrary: Record<IconKey, typeof Truck> = {
  truck: Truck,
  shield: ShieldCheck,
  refresh: RefreshCw,
  support: LifeBuoy,
  badge: BadgeCheck,
  package: Package,
  file: FileText,
  wrench: Wrench,
  ruler: Ruler,
  video: PlayCircle,
  clipboard: ClipboardList
};

export type ProductDetailTabContent = {
  description: {
    paragraphs: string[];
    features: string[];
    materials: string[];
    applications: string[];
  };
  reviews: {
    average: number;
    total: number;
    highlights: string[];
    testimonials: Array<{
      author: string;
      role?: string;
      rating: number;
      comment: string;
      date?: string;
    }>;
  };
  installation: {
    summary: string[];
  };
  warranty: {
    summary: string[];
  };
};

export type ProductDetailData = {
  slug: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  name: string;
  brand: string;
  sku: string;
  category: string;
  tagline: string;
  stockMessage: string;
  price: {
    amount: number;
    currency: string;
    compareAt?: number;
  };
  rating: {
    average: number;
    count: number;
  };
  badges: Array<{ variant: BadgeVariant; text: string }>;
  shippingEstimate: string;
  paymentNotice?: string;
  trustBadges: Array<{ icon: IconKey; title: string; description: string }>;
  bulkRequestCopy?: string;
  bulkRequestCta?: string;
  bulkRequestHref?: string;
  guaranteeCopy: string;
  configurationSections?: Array<{
    id: string;
    title: string;
    info?: string;
    options: Array<{
      label: string;
      description?: string;
      priceDelta?: string;
      badge?: "popular" | "new";
    }>;
  }>;
  colorOptions?: Array<{ name: string; swatch: string }>;
  sizeOptions?: string[];
  images: ProductGalleryImage[];
  specification: Array<{ label: string; value: string }>;
  whatsIncluded: Array<{ item: string; quantity: string }>;
  documents: Array<{ icon: IconKey; title: string; subtitle: string }>;
  serviceHighlights: Array<{ icon: IconKey; title: string; description: string }>;
  assuranceBlocks: Array<{ icon: IconKey; title: string; description: string }>;
  tabs: ProductDetailTabContent;
};

const badgeStyles: Record<BadgeVariant, string> = {
  info: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900"
};

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format(amount);

const StarRating = ({ rating }: { rating: number }) => {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} size={16} className={index < rounded ? "fill-current" : ""} />
      ))}
    </div>
  );
};

const QuantityStepper = ({ quantity, onChange }: { quantity: number; onChange: (value: number) => void }) => {
  const decrease = () => onChange(Math.max(1, quantity - 1));
  const increase = () => onChange(quantity + 1);
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl border bg-card px-2 py-2">
      <button
        type="button"
        onClick={decrease}
        className="flex h-10 w-10 items-center justify-center rounded-xl border bg-background"
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[2ch] text-lg font-semibold">{quantity}</span>
      <button
        type="button"
        onClick={increase}
        className="flex h-10 w-10 items-center justify-center rounded-xl border bg-background"
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
};

const ProductRail = ({
  title,
  subtitle,
  products
}: {
  title: string;
  subtitle?: string;
  products: MockProduct[];
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  if (!products.length) {
    return null;
  }

  const scrollBy = (delta: number) => containerRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold md:text-2xl">{title}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="hidden gap-2 md:flex">
          <button
            type="button"
            onClick={() => scrollBy(-320)}
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-background text-foreground shadow"
            aria-label="Scroll products left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(320)}
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-background text-foreground shadow"
            aria-label="Scroll products right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="no-scrollbar flex gap-4 overflow-x-auto pb-2 scroll-smooth"
      >
        {products.map((product) => {
          const discount =
            product.compareAt && product.compareAt > product.price
              ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
              : null;
          return (
            <div
              key={product.id}
              className="w-[220px] shrink-0 overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md md:w-[240px]"
            >
              <div className="relative">
                <Image
                  src={product.image}
                  alt={product.name}
                  width={640}
                  height={480}
                  className="h-48 w-full object-cover"
                  loading="lazy"
                  sizes="(min-width: 1024px) 240px, (min-width: 768px) 220px, 70vw"
                />
                {discount ? (
                  <span className="absolute left-3 top-3 rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow">
                    -{discount}%
                  </span>
                ) : null}
              </div>
              <div className="space-y-2 p-3">
                <p className="text-sm font-semibold line-clamp-2">{product.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">
                    €{product.price.toFixed(2)}
                  </span>
                  {product.compareAt ? (
                    <span className="text-sm text-muted-foreground line-through">
                      €{product.compareAt.toFixed(2)}
                    </span>
                  ) : null}
                </div>
                <Button size="sm" className="w-full rounded-xl">
                  Add to cart
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const ProductDetailView = ({
  product,
  peopleAlsoBought,
  recentlyViewed
}: {
  product: ProductDetailData;
  peopleAlsoBought: MockProduct[];
  recentlyViewed: MockProduct[];
}) => {
  const [selectedColor, setSelectedColor] = useState(product.colorOptions?.[0]?.name ?? "");
  const [selectedSize, setSelectedSize] = useState(product.sizeOptions?.[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<keyof ProductDetailTabContent>("description");
  const [configSelections, setConfigSelections] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        (product.configurationSections ?? []).map((section) => [section.id, 0])
      )
  );

  const discountValue = useMemo(() => {
    const { compareAt, amount } = product.price;
    if (!compareAt || compareAt <= amount) {
      return null;
    }
    return Math.round(((compareAt - amount) / compareAt) * 100);
  }, [product.price]);

  const hasColorOptions = Boolean(product.colorOptions?.length);
  const hasSizeOptions = Boolean(product.sizeOptions?.length);
  const hasConfigurations = Boolean(product.configurationSections?.length);

  const tabOrder: Array<{ id: keyof ProductDetailTabContent; label: string }> = [
    { id: "description", label: "Description" },
    { id: "reviews", label: "Reviews" },
    { id: "installation", label: "Installation" },
    { id: "warranty", label: "Warranty" }
  ];

  const handleConfigurationSelect = (sectionId: string, optionIndex: number) => {
    setConfigSelections((prev) => ({
      ...prev,
      [sectionId]: optionIndex
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Content Section */}
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4">
          {/* Main Product Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-card rounded-xl p-5 mb-6 border">
            {/* Breadcrumb - Spans full width */}
            <nav aria-label="Breadcrumb" className="lg:col-span-2 mb-4">
              <ol className="flex flex-wrap items-center text-xs text-muted-foreground">
                {product.breadcrumb.map((item, index) => (
                  <Fragment key={`${item.label}-${index}`}>
                    {item.href ? (
                      <Link href={item.href} className="hover:text-primary transition">
                        {item.label}
                      </Link>
                    ) : (
                      <span className="text-foreground">{item.label}</span>
                    )}
                    {index < product.breadcrumb.length - 1 ? <span className="mx-1.5">/</span> : null}
                  </Fragment>
                ))}
              </ol>
            </nav>

            {/* Image Gallery - Sticky */}
            <div className="lg:sticky lg:top-24 h-fit">
              <ProductMediaGallery images={product.images} />
            </div>

        {/* Product Info */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {product.name}
            </h1>

            <div className="flex items-center gap-2 mt-2">
              <StarRating rating={product.rating.average} />
              <span className="text-sm text-muted-foreground">
                {product.rating.average.toFixed(1)} ({product.rating.count} verified reviews)
              </span>
            </div>
          </div>

          <div className="bg-muted border rounded-lg px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-bold text-foreground">
                {formatCurrency(product.price.amount, product.price.currency)}
              </span>
              {product.price.compareAt ? (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    {formatCurrency(product.price.compareAt, product.price.currency)}
                  </span>
                  {discountValue ? (
                    <span className="text-primary font-bold">Save {discountValue}%</span>
                  ) : null}
                </>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{product.paymentNotice ?? "Free EU-wide shipping • Flexible payment terms available"}</p>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-4 py-2.5 rounded-lg font-medium text-sm border border-emerald-200 dark:border-emerald-900">
            ✓ {product.stockMessage}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {product.trustBadges.slice(0, 3).map((badge, index) => {
              const Icon = iconLibrary[badge.icon];
              return (
                <div key={`trust-badge-${index}`} className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <span className="w-5 h-5 bg-emerald-600 dark:bg-emerald-500 rounded-full flex items-center justify-center text-white">
                    <Icon className="h-3 w-3" />
                  </span>
                  <span>{badge.title}</span>
                </div>
              );
            })}
          </div>

          {/* Configuration Section */}
          <div className="space-y-4">
            {hasConfigurations ? (
              <div className="space-y-4">
                {product.configurationSections?.map((section) => {
                  const selectedIndex = configSelections[section.id] ?? 0;
                  return (
                    <div key={section.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground text-sm">{section.title}</span>
                        {section.info ? (
                          <span className="text-muted-foreground cursor-help" title={section.info}>
                            <Info className="h-4 w-4" />
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {section.options.map((option, optionIndex) => {
                          const isSelected = optionIndex === selectedIndex;
                          return (
                            <button
                              key={`${section.id}-${option.label}`}
                              type="button"
                              onClick={() => handleConfigurationSelect(section.id, optionIndex)}
                              className={`w-full p-3 rounded-lg border-2 text-left transition relative ${
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/30"
                              }`}
                              aria-pressed={isSelected}
                            >
                              <div className="font-medium text-sm text-foreground">{option.label}</div>
                              {option.description ? (
                                <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
                              ) : null}
                              {option.priceDelta ? (
                                <div className="text-xs text-muted-foreground mt-0.5">{option.priceDelta}</div>
                              ) : null}
                              {option.badge && isSelected ? (
                                <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase">
                                  {option.badge === "popular" ? "POPULAR" : "NEW"}
                                </div>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {hasColorOptions ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Color</span>
                  <span className="text-muted-foreground">{selectedColor}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {product.colorOptions?.map((option) => {
                    const isSelected = selectedColor === option.name;
                    return (
                      <button
                        key={option.name}
                        type="button"
                        onClick={() => setSelectedColor(option.name)}
                        className={`flex items-center gap-2 rounded-[16px] border-2 px-3 py-2 text-sm transition ${
                          isSelected ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"
                        }`}
                        aria-pressed={isSelected}
                      >
                        <span
                          className="h-5 w-5 rounded-full border"
                          style={{ backgroundColor: option.swatch }}
                        />
                        {option.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {hasSizeOptions ? (
              <div className="space-y-2">
                <div className="font-semibold text-foreground text-sm">Pump & Control Variant</div>
                <div className="flex gap-2 flex-wrap">
                  {product.sizeOptions?.map((size) => {
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`flex-1 p-2.5 rounded-lg border-2 font-medium text-sm transition ${
                          isSelected
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border hover:border-primary/30 text-foreground"
                        }`}
                        aria-pressed={isSelected}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Quantity */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-medium text-sm text-foreground">Quantity:</span>
              <QuantityStepper quantity={quantity} onChange={setQuantity} />
              {product.bulkRequestCopy ? (
                <span className="text-xs text-muted-foreground">
                  Need 5+?{" "}
                  {product.bulkRequestCta ? (
                    <Link
                      href={product.bulkRequestHref ?? "#"}
                      className="text-primary hover:underline"
                    >
                      {product.bulkRequestCta}
                    </Link>
                  ) : (
                    <a href="#" className="text-primary hover:underline">Request bulk pricing</a>
                  )}
                </span>
              ) : null}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button className="flex-1 py-3 px-4 rounded-lg font-semibold transition text-sm">
                Add to Cart - {formatCurrency(product.price.amount * quantity, product.price.currency)}
              </Button>
              <Button variant="outline" className="flex-1 py-3 px-4 rounded-lg font-semibold border-2 transition text-sm">
                Request Installation Quote
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button className="py-2 px-3 border rounded-lg text-xs hover:bg-muted transition flex items-center justify-center gap-1.5 text-foreground">
                <MessageCircle className="h-3.5 w-3.5" /> Ask Expert
              </button>
              <button className="py-2 px-3 border rounded-lg text-xs hover:bg-muted transition flex items-center justify-center gap-1.5 text-foreground">
                <Heart className="h-3.5 w-3.5" /> Wishlist
              </button>
              <button className="py-2 px-3 border rounded-lg text-xs hover:bg-muted transition flex items-center justify-center gap-1.5 text-foreground">
                <Bell className="h-3.5 w-3.5" /> Email Quote
              </button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {product.serviceHighlights.map((item, index) => {
              const Icon = iconLibrary[item.icon];
              return (
                <div key={`${item.title}-${index}`} className="flex items-start gap-2 rounded-lg border bg-muted px-3 py-2">
                  <Icon className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Key Specs */}
          <div className="mb-4">
            <h3 className="font-semibold text-base mb-3 text-foreground">Key Specifications</h3>
            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                {product.specification.map((item, index) => (
                  <div key={`spec-${index}`} className="flex justify-between items-center pb-2 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-sm text-right text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* What's Included */}
          <div className="mb-4">
            <h3 className="font-semibold text-base mb-3 text-foreground">What&apos;s Included</h3>
            <div className="bg-muted p-4 rounded-lg">
              <div className="space-y-2">
                {product.whatsIncluded.map((item, index) => (
                  <div key={`included-${index}`} className="flex justify-between items-center pb-2 border-b border-border last:border-0">
                    <span className="text-xs text-foreground">{item.item}</span>
                    <span className="font-medium text-sm text-foreground">{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Technical Docs */}
          <div>
            <h3 className="font-semibold text-base mb-3 text-foreground">Technical Documentation</h3>
            <div className="grid grid-cols-3 gap-2">
              {product.documents.map((doc, index) => {
                const Icon = iconLibrary[doc.icon];
                return (
                  <button
                    key={`doc-${index}`}
                    className="p-3 border rounded-lg hover:border-primary hover:shadow-md transition text-center bg-card"
                  >
                    <div className="flex items-center justify-center mb-1.5">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="font-medium text-xs text-foreground">{doc.title}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{doc.subtitle}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold mb-3 text-foreground">Guarantee & support</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {product.assuranceBlocks.map((item, index) => {
                const Icon = iconLibrary[item.icon];
                return (
                  <div key={`${item.title}-${index}`} className="flex items-start gap-2 rounded-lg border bg-muted px-3 py-2">
                    <Icon className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{product.guaranteeCopy}</p>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="bg-card rounded-xl p-5 border">
        <div className="flex gap-3 border-b-2 mb-5">
          {tabOrder.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 px-3 font-medium capitalize transition text-sm ${
                  isActive
                    ? "border-b-3 text-primary border-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
                style={isActive ? { borderBottom: "3px solid currentColor" } : {}}
                aria-pressed={isActive}
              >
                {tab.label}
                {tab.id === "reviews" ? ` (${product.tabs.reviews.total})` : ""}
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
          {activeTab === "description" ? (
            <>
              {product.tabs.description.paragraphs.map((paragraph, index) => (
                <p key={`desc-${index}`}>{paragraph}</p>
              ))}
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="text-base font-semibold text-foreground">Features</h4>
                  <ul className="mt-3 space-y-2">
                    {product.tabs.description.features.map((feature, index) => (
                      <li key={`feature-${index}`} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-base font-semibold text-foreground">Materials & Care</h4>
                  <ul className="mt-3 space-y-2">
                    {product.tabs.description.materials.map((item, index) => (
                      <li key={`material-${index}`} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {product.tabs.description.applications.length ? (
                <div>
                  <h4 className="text-base font-semibold text-foreground">Applications</h4>
                  <ul className="mt-3 space-y-2">
                    {product.tabs.description.applications.map((application, index) => (
                      <li key={`application-${index}`} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{application}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <h3 className="text-xl font-semibold mb-4 text-foreground">Warranty & Support</h3>
              <div className="grid grid-cols-3 gap-6">
                {product.assuranceBlocks.slice(0, 3).map((item, idx) => {
                  const Icon = iconLibrary[item.icon];
                  return (
                    <div key={`assurance-${idx}`} className="p-6 border rounded-lg text-center">
                      <div className="text-5xl mb-3 flex justify-center">
                        <Icon className="h-12 w-12 text-primary" />
                      </div>
                      <h4 className="font-semibold mb-2 text-foreground">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {activeTab === "reviews" ? (
            <div className="space-y-6">
              <div className="rounded-3xl border bg-background px-6 py-5">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Average rating</p>
                    <p className="text-3xl font-semibold text-foreground">{product.tabs.reviews.average.toFixed(1)} / 5.0</p>
                  </div>
                  <StarRating rating={product.tabs.reviews.average} />
                  <span className="text-sm text-muted-foreground">{product.tabs.reviews.total} reviews</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {product.tabs.reviews.highlights.map((highlight, index) => (
                    <span
                      key={`review-highlight-${index}`}
                      className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {product.tabs.reviews.testimonials.map((item, index) => (
                  <div key={`testimonial-${index}`} className="rounded-3xl border bg-background p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.author}</p>
                        {item.role ? <p className="text-xs text-muted-foreground">{item.role}</p> : null}
                      </div>
                      <StarRating rating={item.rating} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{item.comment}</p>
                    {item.date ? <p className="mt-3 text-xs text-muted-foreground">{item.date}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "installation" ? (
            <ul className="space-y-3">
              {product.tabs.installation.summary.map((item, index) => (
                <li key={`installation-${index}`} className="flex items-start gap-3">
                  <Wrench className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {activeTab === "warranty" ? (
            <ul className="space-y-3">
              {product.tabs.warranty.summary.map((item, index) => (
                <li key={`warranty-${index}`} className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

        <ProductRail
          title="People Also Bought"
          subtitle="Pairs well with your hydronic installations"
          products={peopleAlsoBought}
        />

        <ProductRail
          title="Recently Viewed"
          subtitle="Pick up where you left off"
          products={recentlyViewed}
        />
        </div>
      </div>
    </div>
  );
};
