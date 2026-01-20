"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { ImageGallery } from "@/components/pim/ImageGallery";
import { MediaGallery } from "@/components/pim/MediaGallery";
import { ConflictResolver } from "@/components/pim/ConflictResolver";
import { ProductTypeSelector } from "@/components/pim/ProductTypeSelector";
import { CollectionsSelector } from "@/components/pim/CollectionsSelector";
import { CategorySelector } from "@/components/pim/CategorySelector";
import { BrandSelector } from "@/components/pim/BrandSelector";
import { FeaturesForm } from "@/components/pim/FeaturesForm";
import { AttributesEditor } from "@/components/pim/AttributesEditor";
import { TagSelector, TagReference } from "@/components/pim/TagSelector";
import { SynonymDictionarySelector } from "@/components/pim/SynonymDictionarySelector";
import { MultilingualInput } from "@/components/pim/MultilingualInput";
import { MultilingualTextarea } from "@/components/pim/MultilingualTextarea";
import { LanguageSwitcher } from "@/components/pim/LanguageSwitcher";
import { PackagingOptionModal } from "@/components/pim/PackagingOptionModal";
import { PromotionModal } from "@/components/pim/PromotionModal";
import { useLanguageStore } from "@/lib/stores/languageStore";
import {
  ProductImage,
  extractAttributesForLanguage,
  mergeAttributesToMultilingual,
  PIMPricing,
  PackagingOption,
  Promotion,
} from "@/lib/types/pim";
import {
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Package,
  AlertTriangle,
  CheckCircle2,
  History,
  RefreshCw,
  Code2,
  List,
  Globe,
  GlobeLock,
  Trash2,
  Loader2,
  Plus,
  Pencil,
} from "lucide-react";

type Product = {
  _id: string;
  entity_code: string;
  sku: string;
  name: string | Record<string, string>;
  product_model?: string;
  version: number;
  updated_at?: string;
  edited_at?: string;
  last_manual_update_at?: string;
  last_api_update_at?: string;
  description?: string | Record<string, string>;
  short_description?: string | Record<string, string>;
  price?: number;
  currency?: string;
  // ERP pricing structure (from pim.ts)
  pricing?: PIMPricing;
  packaging_options?: PackagingOption[];
  promotions?: Promotion[];
  promo_code?: string[];
  promo_type?: string[];
  has_active_promo?: boolean;
  quantity: number;
  status: "draft" | "published" | "archived";
  images?: ProductImage[];
  media?: {
    type: "document" | "video" | "3d-model";
    file_type: string;
    url: string;
    cdn_key: string;
    label?: string;
    size_bytes?: number;
    uploaded_at: string;
    uploaded_by?: string;
    is_external_link?: boolean;
    position: number;
  }[];
  brand?: {
    id: string;
    name: string | Record<string, string>;
    slug: string;
  };
  product_type?: {
    id: string;
    name: string | Record<string, string>;
    slug: string;
    features?: any[];
  };
  collections?: {
    id: string;
    name: string | Record<string, string>;
    slug: string;
  }[];
  category?: {
    id: string;
    name: string | Record<string, string>;
    slug: string;
  };
  tags?: {
    tag_id: string;
    name: string | Record<string, string>;
    slug: string;
    color?: string;
    is_active?: boolean;
  }[];
  completeness_score: number;
  critical_issues: string[];
  // Conflict tracking
  has_conflict?: boolean;
  conflict_data?: {
    field: string;
    manual_value: any;
    api_value: any;
    detected_at: Date;
  }[];
  // Analytics
  analytics?: {
    views_30d?: number;
    clicks_30d?: number;
    add_to_cart_30d?: number;
    conversions_30d?: number;
    priority_score?: number;
    last_synced_at?: string;
  };
  // Variant/Parent relationships
  parent_sku?: string;
  parent_entity_code?: string;
  is_parent?: boolean;
  include_faceting?: boolean;
  share_images_with_variants?: boolean;
  share_media_with_variants?: boolean;
  variations_sku?: string[];
  variations_entity_code?: string[];
};

type FormData = {
  name: Record<string, string>;
  product_model: string;
  description: Record<string, string>;
  short_description: Record<string, string>;
  stock_quantity: string;
  status: "draft" | "published" | "archived";
  brand_name: string;
  category_name: string;
};

/**
 * Helper function to extract text from multilingual objects
 * Uses default language first, then fallback chain
 * IMPORTANT: This function MUST always return a string, never an object
 */
function getMultilingualText(
  text: string | Record<string, string> | undefined | null | any,
  defaultLanguageCode: string = "it",
  fallback: string = ""
): string {
  // Handle null, undefined, or empty values
  if (!text) return fallback;

  // If already a string, return it
  if (typeof text === "string") return text;

  // If not an object, convert to string
  if (typeof text !== "object") return String(text);

  // Try to extract string from multilingual object
  try {
    const result = text[defaultLanguageCode] || text.en || Object.values(text)[0];

    // Ensure result is a string
    if (typeof result === "string" && result) return result;
    if (result) return String(result);

    return fallback;
  } catch (error) {
    console.error("Error extracting multilingual text:", error, text);
    return fallback;
  }
}

export default function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ entity_code: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { entity_code } = use(params);
  const { version: versionParam } = use(searchParams);
  const router = useRouter();
  const pathname = usePathname();
  // Extract tenant prefix from URL (e.g., "/dfl-eventi-it/b2b/pim/products/..." -> "/dfl-eventi-it")
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  // Language store for getting default language from database
  const { languages } = useLanguageStore();
  const defaultLanguage = languages.find(lang => lang.isDefault) || languages.find(lang => lang.code === "it");
  const defaultLanguageCode = defaultLanguage?.code || "it";

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isOldVersion, setIsOldVersion] = useState(false);
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number | null>(null);

  // Packaging & Promotion modals
  const [packagingModalOpen, setPackagingModalOpen] = useState(false);
  const [editingPackaging, setEditingPackaging] = useState<PackagingOption | null>(null);
  const [promotionModalOpen, setPromotionModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<{ promotion: Promotion | null; packagingCode: string }>({ promotion: null, packagingCode: "" });

  const [formData, setFormData] = useState<FormData>({
    name: {},
    product_model: "",
    description: {},
    short_description: {},
    stock_quantity: "",
    status: "draft",
    brand_name: "",
    category_name: "",
  });

  const [originalData, setOriginalData] = useState<FormData | null>(null);

  // Product associations
  const [productType, setProductType] = useState<any>(null);
  const [collections, setCollections] = useState<{ id: string; name: string | Record<string, string>; slug: string }[]>([]);
  const [category, setCategory] = useState<{ id: string; name: string | Record<string, string>; slug: string } | null>(null);
  const [brand, setBrand] = useState<{ brand_id: string; label: string; slug: string; logo_url?: string; description?: string; is_active?: boolean } | null>(null);
  const [featureValues, setFeatureValues] = useState<any[]>([]);

  // View mode toggles for self-contained data
  const [showProductTypeJSON, setShowProductTypeJSON] = useState(false);
  const [showCategoryJSON, setShowCategoryJSON] = useState(false);
  const [showCollectionsJSON, setShowCollectionsJSON] = useState(false);
  const [showBrandJSON, setShowBrandJSON] = useState(false);
  const [showTagsJSON, setShowTagsJSON] = useState(false);
  const [customAttributes, setCustomAttributes] = useState<Record<string, any>>({});
  const [rawMultilingualAttributes, setRawMultilingualAttributes] = useState<Record<string, any>>({});
  const [tagRefs, setTagRefs] = useState<TagReference[]>([]);
  const [synonymKeys, setSynonymKeys] = useState<string[]>([]);

  // Original values for comparison
  const [originalProductType, setOriginalProductType] = useState<any>(null);
  const [originalCollections, setOriginalCollections] = useState<{ id: string; name: string | Record<string, string>; slug: string }[]>([]);
  const [originalCategory, setOriginalCategory] = useState<{ id: string; name: string | Record<string, string>; slug: string } | null>(null);
  const [originalBrand, setOriginalBrand] = useState<{ id: string; name: string | Record<string, string>; slug: string; image?: any } | null>(null);
  const [originalFeatureValues, setOriginalFeatureValues] = useState<any[]>([]);
  const [originalCustomAttributes, setOriginalCustomAttributes] = useState<Record<string, any>>({});
  const [originalTagRefs, setOriginalTagRefs] = useState<TagReference[]>([]);
  const [originalSynonymKeys, setOriginalSynonymKeys] = useState<string[]>([]);

  useEffect(() => {
    if (entity_code) {
      fetchProduct();
    }
  }, [entity_code]);

  useEffect(() => {
    if (!originalData) return;

    // Check if basic form fields changed
    const formChanged = Object.keys(formData).some(
      (key) => formData[key as keyof FormData] !== originalData[key as keyof FormData]
    );

    // Check if product type changed
    const productTypeChanged = productType?.product_type_id !== originalProductType?.product_type_id;

    // Check if collections changed
    const collectionsChanged = JSON.stringify(collections) !== JSON.stringify(originalCollections);

    // Check if category changed
    const categoryChanged = category?.id !== originalCategory?.id;

    // Check if brand changed
    const brandChanged = brand?.brand_id !== originalBrand?.brand_id;

    // Check if feature values changed
    const featuresChanged = JSON.stringify(featureValues) !== JSON.stringify(originalFeatureValues);

    // Check if custom attributes changed
    const attributesChanged = JSON.stringify(customAttributes) !== JSON.stringify(originalCustomAttributes);

    // Check if tags changed
    const tagsChanged = JSON.stringify(tagRefs) !== JSON.stringify(originalTagRefs);

    // Check if synonym keys changed
    const synonymsChanged = JSON.stringify(synonymKeys) !== JSON.stringify(originalSynonymKeys);

    const hasAnyChanges =
      formChanged ||
      productTypeChanged ||
      collectionsChanged ||
      categoryChanged ||
      brandChanged ||
      featuresChanged ||
      attributesChanged ||
      tagsChanged ||
      synonymsChanged;

    setHasChanges(hasAnyChanges);
  }, [
    formData,
    originalData,
    productType,
    originalProductType,
    collections,
    originalCollections,
    category,
    originalCategory,
    brand,
    originalBrand,
    featureValues,
    originalFeatureValues,
    customAttributes,
    originalCustomAttributes,
    tagRefs,
    originalTagRefs,
    synonymKeys,
    originalSynonymKeys
  ]);

  async function fetchProduct() {
    setIsLoading(true);
    try {
      // Build URL with version parameter if provided
      const url = versionParam
        ? `/api/b2b/pim/products/${entity_code}?version=${versionParam}`
        : `/api/b2b/pim/products/${entity_code}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProduct(data.product);

        // Check if viewing old version
        if (data.isOldVersion) {
          setIsOldVersion(true);
          setCurrentVersionNumber(data.currentVersion);
        } else {
          setIsOldVersion(false);
          setCurrentVersionNumber(null);
        }

        // Initialize form data - keep full multilingual objects
        const initialData: FormData = {
          name: (typeof data.product.name === 'object' && data.product.name !== null)
            ? data.product.name
            : { [defaultLanguageCode]: data.product.name || "" },
          product_model: data.product.product_model || "",
          description: (typeof data.product.description === 'object' && data.product.description !== null)
            ? data.product.description
            : { [defaultLanguageCode]: data.product.description || "" },
          short_description: (typeof data.product.short_description === 'object' && data.product.short_description !== null)
            ? data.product.short_description
            : { [defaultLanguageCode]: data.product.short_description || "" },
          stock_quantity: data.product.quantity?.toString() || "0",
          status: data.product.status || "draft",
          brand_name: getMultilingualText(data.product.brand?.name, defaultLanguageCode, ""),
          category_name: getMultilingualText(data.product.category?.name, defaultLanguageCode, ""),
        };
        setFormData(initialData);
        setOriginalData(initialData);

        // Initialize product associations
        const loadedProductType = data.product.product_type || null;
        const loadedFeatures = data.product.product_type?.features || [];
        const loadedCollections = data.product.collections || [];
        const loadedCategory = data.product.category || null;
        const loadedBrand = data.product.brand || null;
        // Extract attributes for current language (converts multilingual to flat format)
        const rawAttributes = data.product.attributes || {};
        const loadedAttributes = extractAttributesForLanguage(rawAttributes, defaultLanguageCode);
        // Load tags from the 'tags' field (TagEmbedded format)
        const loadedTagRefs: TagReference[] = Array.isArray(data.product.tags)
          ? data.product.tags
              .filter((tag: any) => tag && tag.name)
              .map((tag: any) => {
                // Extract string from multilingual name if needed
                let tagNameString = '';
                if (typeof tag.name === 'string') {
                  tagNameString = tag.name;
                } else if (tag.name && typeof tag.name === 'object') {
                  tagNameString = tag.name.it || tag.name.en || Object.values(tag.name)[0] || '';
                }

                return {
                  id: tag.tag_id || tag.id || tag.slug || tagNameString,
                  name: tag.name,
                  slug: tag.slug || (tagNameString ? tagNameString.toLowerCase().replace(/\s+/g, "-") : ""),
                  color: tag.color,
                };
              })
          : [];

        setProductType(loadedProductType);
        setFeatureValues(loadedFeatures);
        setCollections(loadedCollections);
        setCategory(loadedCategory);
        setBrand(loadedBrand);
        setCustomAttributes(loadedAttributes);
        setRawMultilingualAttributes(rawAttributes);
        setTagRefs(loadedTagRefs);

        // Load synonym keys
        const loadedSynonymKeys = data.product.synonym_keys || [];
        setSynonymKeys(loadedSynonymKeys);

        // Auto-enable JSON view for self-contained data (only if arrays have content)
        if (loadedProductType && ((loadedProductType.hierarchy && loadedProductType.hierarchy.length > 0) || (loadedProductType.inherited_features && loadedProductType.inherited_features.length > 0))) {
          setShowProductTypeJSON(true);
        }
        if (loadedCategory && (loadedCategory as any).hierarchy && (loadedCategory as any).hierarchy.length > 0) {
          setShowCategoryJSON(true);
        }
        if (loadedCollections && loadedCollections.length > 0 && loadedCollections.some((c: any) => c.hierarchy && c.hierarchy.length > 0)) {
          setShowCollectionsJSON(true);
        }
        if (loadedBrand && (loadedBrand as any).hierarchy && (loadedBrand as any).hierarchy.length > 0) {
          setShowBrandJSON(true);
        }
        if (loadedTagRefs && loadedTagRefs.length > 0 && loadedTagRefs.some((t: any) => t.tag_group_data && Object.keys(t.tag_group_data).length > 0)) {
          setShowTagsJSON(true);
        }

        // Set original values for change detection
        setOriginalProductType(loadedProductType);
        setOriginalFeatureValues(loadedFeatures);
        setOriginalCollections(loadedCollections);
        setOriginalCategory(loadedCategory);
        setOriginalBrand(loadedBrand);
        setOriginalCustomAttributes(loadedAttributes);
        setOriginalTagRefs(loadedTagRefs);
        setOriginalSynonymKeys(loadedSynonymKeys);
      } else if (res.status === 404) {
        setProduct(null);
      } else {
        console.error("Failed to fetch product");
      }
    } catch (error) {
      console.error("Error fetching product:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      const updates: any = {
        name: formData.name,
        product_model: formData.product_model,
        description: formData.description,
        short_description: formData.short_description,
        status: formData.status,
      };

      // Add stock quantity if it has a value
      if (formData.stock_quantity) {
        updates.stock_quantity = parseInt(formData.stock_quantity);
      }

      // Add brand if changed
      if (formData.brand_name !== originalData?.brand_name) {
        updates.brand = formData.brand_name
          ? {
            name: formData.brand_name,
            id: product?.brand?.id || formData.brand_name.toLowerCase().replace(/\s+/g, "-"),
            slug: formData.brand_name.toLowerCase().replace(/\s+/g, "-"),
          }
          : null;
      }

      // Add category if changed (using the CategorySelector value)
      if (category !== product?.category) {
        updates.category = category;
      }

      // Add product type if changed
      if (productType) {
        updates.product_type = {
          id: productType.product_type_id || productType.id,
          name: productType.name,
          slug: productType.slug,
          features: featureValues,
        };
      }

      // Add collections
      updates.collections = collections;

      // Add brand (using BrandBase field names)
      if (brand) {
        updates.brand = {
          brand_id: brand.brand_id,
          label: brand.label,
          slug: brand.slug,
          logo_url: brand.logo_url,
          description: brand.description,
          is_active: brand.is_active ?? true,
        };
      }

      // Add custom attributes (merge back into multilingual format)
      updates.attributes = mergeAttributesToMultilingual(customAttributes, rawMultilingualAttributes, defaultLanguageCode);

      // Add tags - send as 'tag' array, API will convert to proper 'tags' format
      updates.tag = tagRefs;

      // Add synonym keys
      updates.synonym_keys = synonymKeys;

      console.log("💾 Saving product with updates:", {
        product_type: updates.product_type,
        collections: updates.collections,
        brand: updates.brand,
        attributes: updates.attributes,
        tag: updates.tag,
        synonym_keys: updates.synonym_keys,
      });

      const res = await fetch(`/api/b2b/pim/products/${entity_code}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        setProduct(data.product);

        // Update original data to new saved state - keep full multilingual objects
        const savedData: FormData = {
          name: (typeof data.product.name === 'object' && data.product.name !== null)
            ? data.product.name
            : { [defaultLanguageCode]: data.product.name || "" },
          product_model: data.product.product_model || "",
          description: (typeof data.product.description === 'object' && data.product.description !== null)
            ? data.product.description
            : { [defaultLanguageCode]: data.product.description || "" },
          short_description: (typeof data.product.short_description === 'object' && data.product.short_description !== null)
            ? data.product.short_description
            : { [defaultLanguageCode]: data.product.short_description || "" },
          stock_quantity: data.product.quantity?.toString() || "0",
          status: data.product.status || "draft",
          brand_name: getMultilingualText(data.product.brand?.name, defaultLanguageCode, ""),
          category_name: getMultilingualText(data.product.category?.name, defaultLanguageCode, ""),
        };
        setFormData(savedData);
        setOriginalData(savedData);

        // Update original association values
        setOriginalProductType(productType);
        setOriginalCollections(collections);
        setOriginalCategory(category);
        setOriginalBrand(brand);
        setOriginalFeatureValues(featureValues);
        setOriginalCustomAttributes(customAttributes);
        setRawMultilingualAttributes(updates.attributes);
        setOriginalTagRefs(tagRefs);
        setOriginalSynonymKeys(synonymKeys);

        setHasChanges(false);

        // Show success message
        toast.success("Product updated successfully!", {
          description: `${getMultilingualText(data.product.name, defaultLanguageCode, "Product")} has been saved.`,
        });
      } else {
        const error = await res.json();
        toast.error("Failed to save product", {
          description: error.error || "Unknown error occurred",
        });
      }
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Failed to save product", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  // Handle save packaging option (create or update)
  async function handleSavePackaging(option: PackagingOption) {
    if (!product) return;

    const existingOptions = product.packaging_options || [];
    let updatedOptions: PackagingOption[];

    if (editingPackaging) {
      // Update existing
      updatedOptions = existingOptions.map((p) =>
        p.code === editingPackaging.code ? option : p
      );
    } else {
      // Add new
      option.position = existingOptions.length + 1;
      updatedOptions = [...existingOptions, option];
    }

    try {
      const res = await fetch(`/api/b2b/pim/products/${entity_code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packaging_options: updatedOptions }),
      });

      if (res.ok) {
        const data = await res.json();
        setProduct(data.product);
        toast.success(editingPackaging ? "Packaging option updated" : "Packaging option added");
        setPackagingModalOpen(false);
        setEditingPackaging(null);
      } else {
        toast.error("Failed to save packaging option");
      }
    } catch {
      toast.error("Failed to save packaging option");
    }
  }

  // Handle save promotion (create or update)
  async function handleSavePromotion(packagingCode: string, promotion: Promotion) {
    if (!product || !product.packaging_options) return;

    const updatedOptions = product.packaging_options.map((pkg) => {
      if (pkg.code !== packagingCode) return pkg;

      const existingPromos = pkg.promotions || [];
      let updatedPromos: Promotion[];

      if (editingPromotion.promotion) {
        // Update existing
        updatedPromos = existingPromos.map((p) =>
          p.promo_code === editingPromotion.promotion?.promo_code ? promotion : p
        );
      } else {
        // Add new
        updatedPromos = [...existingPromos, promotion];
      }

      return { ...pkg, promotions: updatedPromos };
    });

    try {
      const res = await fetch(`/api/b2b/pim/products/${entity_code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packaging_options: updatedOptions }),
      });

      if (res.ok) {
        const data = await res.json();
        setProduct(data.product);
        toast.success(editingPromotion.promotion ? "Promotion updated" : "Promotion added");
        setPromotionModalOpen(false);
        setEditingPromotion({ promotion: null, packagingCode: "" });
      } else {
        toast.error("Failed to save promotion");
      }
    } catch {
      toast.error("Failed to save promotion");
    }
  }

  async function handlePublish() {
    if (!product) return;
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/b2b/pim/products/${entity_code}/publish`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setProduct(data.product);
        setFormData((prev) => ({ ...prev, status: "published" }));
        toast.success("Product published!");
      } else {
        const error = await res.json();
        toast.error("Failed to publish", { description: error.error });
      }
    } catch (error) {
      toast.error("Failed to publish product");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!product) return;
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/b2b/pim/products/${entity_code}/unpublish`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setProduct(data.product);
        setFormData((prev) => ({ ...prev, status: "draft" }));
        toast.success("Product unpublished");
      } else {
        const error = await res.json();
        toast.error("Failed to unpublish", { description: error.error });
      }
    } catch (error) {
      toast.error("Failed to unpublish product");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleDelete() {
    if (!product) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete this product?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/b2b/pim/products/${entity_code}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Product deleted");
        router.push(`${tenantPrefix}/b2b/pim/products`);
      } else {
        const error = await res.json();
        toast.error("Failed to delete", { description: error.error });
      }
    } catch (error) {
      toast.error("Failed to delete product");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleImageUpload(files: File[]) {
    setIsUploadingImages(true);
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("images", file);
      });

      const res = await fetch(`/api/b2b/pim/products/${entity_code}/images`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // Update local state with new images without reloading page
        if (data.product && product) {
          setProduct({
            ...product,
            images: data.product.images,
          });

          // Show success notification
          toast.success("Images uploaded successfully!", {
            description: `${data.uploaded} image(s) added`,
          });
        }
      } else {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }
    } finally {
      setIsUploadingImages(false);
    }
  }

  async function handleImageDelete(cdn_key: string) {
    const res = await fetch(
      `/api/b2b/pim/products/${entity_code}/images?cdn_key=${encodeURIComponent(cdn_key)}`,
      {
        method: "DELETE",
      }
    );

    if (res.ok) {
      const data = await res.json();
      // Update local state with updated images without reloading page
      if (data.product && product) {
        setProduct({
          ...product,
          images: data.product.images,
        });

        // Show success notification
        toast.success("Image deleted successfully!");
      }
    } else {
      const error = await res.json();
      throw new Error(error.error || "Delete failed");
    }
  }

  async function handleImageReorder(newOrder: string[]) {
    const res = await fetch(`/api/b2b/pim/products/${entity_code}/images/order`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageOrder: newOrder }),
    });

    if (res.ok) {
      const data = await res.json();
      // Update local state with reordered images without reloading page
      if (data.product && product) {
        setProduct({
          ...product,
          images: data.product.images,
        });
      }
    } else {
      const error = await res.json();
      throw new Error(error.error || "Reorder failed");
    }
  }

  async function handleImageSetPrimary(cdn_key: string) {
    console.log("Setting primary image:", cdn_key);

    const res = await fetch(`/api/b2b/pim/products/${entity_code}/images`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cdn_key }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log("Primary image response:", data);

      // Update local state with updated images
      if (data.product) {
        // Force a complete state update
        setProduct((prev) => ({
          ...prev,
          images: data.product.images,
          updated_at: data.product.updated_at,
        }));

        // Show success notification
        toast.success("Primary image updated!", {
          description: "Image moved to first position",
        });

        console.log("State updated with new primary:", cdn_key);
      }
    } else {
      const error = await res.json();
      console.error("Failed to set primary:", error);
      toast.error("Failed to set primary image", {
        description: error.error || "Please try again",
      });
      throw new Error(error.error || "Failed to set primary image");
    }
  }

  async function handleMediaUpload(files: File[], type: "document" | "video" | "3d-model") {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("media", file);
    });
    formData.append("type", type);

    const res = await fetch(`/api/b2b/pim/products/${entity_code}/media`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      // Update local state with new media without reloading page
      if (data.product && product) {
        setProduct({
          ...product,
          media: data.product.media,
        });
      }
    } else {
      const error = await res.json();
      throw new Error(error.error || "Upload failed");
    }
  }

  async function handleMediaAddLink(url: string, type: "document" | "video" | "3d-model", label?: string) {
    const res = await fetch(`/api/b2b/pim/products/${entity_code}/media/link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, type, label }),
    });

    if (res.ok) {
      const data = await res.json();
      // Update local state with new media without reloading page
      if (data.product && product) {
        setProduct({
          ...product,
          media: data.product.media,
        });
      }
    } else {
      const error = await res.json();
      throw new Error(error.error || "Failed to add link");
    }
  }

  async function handleMediaReorder(type: "document" | "video" | "3d-model", newOrder: string[]) {
    const res = await fetch(`/api/b2b/pim/products/${entity_code}/media/reorder`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type, order: newOrder }),
    });

    if (res.ok) {
      const data = await res.json();
      // Update local state with reordered media without reloading page
      if (data.product && product) {
        setProduct({
          ...product,
          media: data.product.media,
        });
      }
    } else {
      const error = await res.json();
      throw new Error(error.error || "Reorder failed");
    }
  }

  async function handleMediaDelete(cdn_key: string) {
    const res = await fetch(
      `/api/b2b/pim/products/${entity_code}/media?cdn_key=${encodeURIComponent(cdn_key)}`,
      {
        method: "DELETE",
      }
    );

    if (res.ok) {
      const data = await res.json();
      // Update local state with updated media without reloading page
      if (data.product && product) {
        setProduct({
          ...product,
          media: data.product.media,
        });
      }
    } else {
      const error = await res.json();
      throw new Error(error.error || "Delete failed");
    }
  }

  async function handleMediaLabelUpdate(cdn_key: string, newLabel: string) {
    const res = await fetch(`/api/b2b/pim/products/${entity_code}/media/label`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cdn_key, label: newLabel }),
    });

    if (res.ok) {
      const data = await res.json();
      // Update local state with updated media without reloading page
      if (data.product && product) {
        setProduct({
          ...product,
          media: data.product.media,
        });
      }
    } else {
      const error = await res.json();
      throw new Error(error.error || "Label update failed");
    }
  }

  async function handleResolveConflicts(resolutions: Record<string, "manual" | "api">) {
    const res = await fetch(
      `/api/b2b/pim/products/${entity_code}/resolve-conflicts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resolutions }),
      }
    );

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to resolve conflicts");
    }

    // Refresh product data
    await fetchProduct();
  }

  async function handleSyncToSolr() {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/b2b/pim/products/${entity_code}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Synced to Search Engine!", {
          description: "Product updated in search index",
        });

        // Update only the sync timestamp without refreshing entire page
        setProduct((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            analytics: {
              ...prev.analytics,
              last_synced_at: data.synced_at,
            },
          };
        });
      } else {
        const error = await res.json();
        toast.error("Failed to sync to Search Engine", {
          description: error.message || "Unknown error occurred",
        });
      }
    } catch (error) {
      console.error("Error syncing to Search Engine:", error);
      toast.error("Failed to sync to Search Engine", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setIsSyncing(false);
    }
  }

  function handleInputChange(field: keyof FormData, value: string | Record<string, string>) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleDiscard() {
    if (originalData) {
      setFormData(originalData);
      setProductType(originalProductType);
      setCollections(originalCollections);
      setCategory(originalCategory);
      setFeatureValues(originalFeatureValues);
      setCustomAttributes(originalCustomAttributes);
      setTagRefs(originalTagRefs);
      setSynonymKeys(originalSynonymKeys);
      setHasChanges(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Product Information Management", href: "/b2b/pim" },
            { label: "Products", href: "/b2b/pim/products" },
            { label: "Loading..." },
          ]}
        />
        <div className="rounded-lg bg-card p-8 shadow-sm">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Product Information Management", href: "/b2b/pim" },
            { label: "Products", href: "/b2b/pim/products" },
            { label: "Not Found" },
          ]}
        />
        <div className="rounded-lg bg-card p-8 shadow-sm text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Product Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The product you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
          </p>
          <Link
            href={`${tenantPrefix}/b2b/pim/products`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Product Information Management", href: "/b2b/pim" },
          { label: "Products", href: "/b2b/pim/products" },
          { label: getMultilingualText(product.name, defaultLanguageCode, "Product") },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              href={`${tenantPrefix}/b2b/pim/products`}
              className="text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Edit Product</h1>
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            SKU: {product.sku} | Entity: {product.entity_code}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`${tenantPrefix}/b2b/pim/products/${entity_code}/history`}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-md hover:bg-muted text-sm font-medium transition"
          >
            <History className="h-4 w-4" />
            Version History
          </Link>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-md hover:bg-muted text-sm font-medium transition"
          >
            {showPreview ? (
              <>
                <EyeOff className="h-4 w-4" />
                Hide Preview
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Show Preview
              </>
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || isOldVersion}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition"
            title={isOldVersion ? "Cannot save changes to old versions" : ""}
          >
            <Save className="h-4 w-4" />
            {isSaving
              ? "Saving..."
              : formData.status === "published"
                ? "Commit Update"
                : formData.status === "draft"
                  ? "Save Draft"
                  : "Save Changes"
            }
          </button>

          {/* Publish/Unpublish Button */}
          {formData.status === "published" ? (
            <button
              onClick={handleUnpublish}
              disabled={isOldVersion || isPublishing}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition"
              title="Unpublish product"
            >
              {isPublishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GlobeLock className="h-4 w-4" />
              )}
              {isPublishing ? "Unpublishing..." : "Unpublish"}
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={isOldVersion || isPublishing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition"
              title="Publish product"
            >
              {isPublishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              {isPublishing ? "Publishing..." : "Publish"}
            </button>
          )}

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            disabled={isOldVersion || isDeleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition"
            title="Delete product"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {/* Old Version Warning Banner */}
      {isOldVersion && versionParam && currentVersionNumber && (
        <div className="rounded-lg bg-amber-50 border-2 border-amber-300 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900">
                  Viewing Old Version (v{versionParam})
                </h3>
                <p className="text-sm text-amber-700 mt-0.5">
                  This is not the current version. Changes cannot be saved to old versions.
                </p>
              </div>
            </div>
            <Link
              href={`${tenantPrefix}/b2b/pim/products/${entity_code}`}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition whitespace-nowrap"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Current (v{currentVersionNumber})
            </Link>
          </div>
        </div>
      )}

      {/* Conflict Warning */}
      {product.has_conflict && product.conflict_data && product.conflict_data.length > 0 && (
        <ConflictResolver
          conflicts={product.conflict_data}
          entityCode={product.entity_code}
          onResolve={handleResolveConflicts}
        />
      )}

      {/* Quality Status Bar */}
      <div className="rounded-lg bg-card p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`inline-flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg ${product.completeness_score >= 80
                    ? "bg-emerald-100 text-emerald-700"
                    : product.completeness_score >= 50
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}
              >
                {product.completeness_score}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Completeness Score</div>
                <div className="text-xs text-muted-foreground">
                  {product.completeness_score >= 80
                    ? "Excellent quality"
                    : product.completeness_score >= 50
                      ? "Good, needs improvement"
                      : "Needs attention"}
                </div>
              </div>
            </div>

            {product.critical_issues.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div className="text-sm">
                  <span className="font-semibold text-red-900">
                    {product.critical_issues.length} Critical Issue
                    {product.critical_issues.length !== 1 ? "s" : ""}
                  </span>
                  <div className="text-xs text-red-700 mt-0.5">
                    {product.critical_issues.slice(0, 2).join(", ")}
                    {product.critical_issues.length > 2 && ` +${product.critical_issues.length - 2} more`}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${product.status === "published"
                    ? "bg-emerald-100 text-emerald-700"
                    : product.status === "draft"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
              >
                {product.status === "published" && <CheckCircle2 className="h-3 w-3" />}
                {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
              </span>
              {product.status === "published" && (
                <button
                  onClick={handleSyncToSolr}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  title="Sync to search engine"
                >
                  <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "Syncing..." : "Sync to Search Engine"}
                </button>
              )}
            </div>
            {/* Sync Status Visual Display */}
            {product.status === "published" && (
              <div className="mt-2 flex flex-col gap-2">
                {(() => {
                  const updatedAt = product.updated_at ? new Date(product.updated_at) : null;
                  const syncedAt = product.analytics?.last_synced_at ? new Date(product.analytics.last_synced_at) : null;

                  // Determine sync status with 2-second tolerance for processing time
                  const SYNC_TOLERANCE_MS = 2000; // 2 seconds
                  const timeDiffMs = updatedAt && syncedAt ? updatedAt.getTime() - syncedAt.getTime() : 0;

                  const needsSync = updatedAt && syncedAt && timeDiffMs > SYNC_TOLERANCE_MS;
                  const isSynced = updatedAt && syncedAt && timeDiffMs <= SYNC_TOLERANCE_MS;
                  const neverSynced = !syncedAt;

                  return (
                    <>
                      {/* Sync Status Badge */}
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${isSynced
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : needsSync
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-gray-50 text-gray-600 border border-gray-200"
                        }`}>
                        {isSynced && <CheckCircle2 className="h-3 w-3" />}
                        {needsSync && <AlertTriangle className="h-3 w-3" />}
                        {isSynced && "Search index up to date"}
                        {needsSync && "Changes not synced"}
                        {neverSynced && "Not synced to search"}
                      </div>

                      {/* Timestamp Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {updatedAt && (
                          <div className="flex flex-col">
                            <span className="text-muted-foreground font-medium">DB Updated</span>
                            <span className="text-foreground">{updatedAt.toLocaleString()}</span>
                          </div>
                        )}
                        {syncedAt && (
                          <div className="flex flex-col">
                            <span className="text-muted-foreground font-medium">Search Synced</span>
                            <span className="text-foreground">{syncedAt.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Product Image */}
        <div className="lg:col-span-1">
          <div className="rounded-lg bg-card p-4 shadow-sm sticky top-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Product Image</h3>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
                PRIMARY
              </span>
            </div>
            <div className="aspect-square rounded-lg overflow-hidden bg-muted ring-2 ring-yellow-400 ring-offset-2">
              {product.images?.[0]?.url ? (
                <Image
                  key={product.images[0].cdn_key}
                  src={product.images[0].url}
                  alt={getMultilingualText(product.name, defaultLanguageCode, "Product image")}
                  width={400}
                  height={400}
                  quality={90}
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  priority
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Last updated: {new Date(product.updated_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Right Column - Edit Form */}
        <div className="lg:col-span-4 space-y-6">
          {/* Language Switcher */}
          <div className="rounded-lg bg-card p-4 shadow-sm">
            <LanguageSwitcher variant="compact" showLabel={true} />
          </div>
          {(product.parent_entity_code || product.is_parent || (product.variations_entity_code?.length ?? 0) > 0) && (
            <div className="rounded-lg bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-4">Variant Information</h3>
              <div className="space-y-3">
                {/* Parent/Child Status */}
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.is_parent
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      : product.parent_entity_code
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}>
                    {product.is_parent ? "Parent Product" : product.parent_entity_code ? "Child Variant" : "Single Product"}
                  </span>
                  {product.include_faceting !== undefined && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.include_faceting
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                      }`}>
                      {product.include_faceting ? "In Facets" : "Excluded from Facets"}
                    </span>
                  )}
                </div>

                {/* Parent Reference */}
                {product.parent_entity_code && (
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Parent Product</div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`${tenantPrefix}/b2b/pim/products/${product.parent_entity_code}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {product.parent_entity_code}
                      </Link>
                      {product.parent_sku && product.parent_sku !== product.parent_entity_code && (
                        <span className="text-xs text-muted-foreground">(SKU: {product.parent_sku})</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Child Variants */}
                {(product.variations_entity_code?.length ?? 0) > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Child Variants ({product.variations_entity_code.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {product.variations_entity_code.map((code, idx) => (
                        <Link
                          key={code}
                          href={`${tenantPrefix}/b2b/pim/products/${code}`}
                          className="px-2 py-1 text-xs bg-background rounded border hover:bg-muted transition-colors"
                        >
                          {code}
                          {product.variations_sku?.[idx] && product.variations_sku[idx] !== code && (
                            <span className="text-muted-foreground ml-1">({product.variations_sku[idx]})</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Share with Variants - only for parents */}
                {(product.is_parent || (product.variations_entity_code?.length ?? 0) > 0) && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <p className="text-sm font-medium text-foreground">Share with Variants</p>

                    {/* Share Images */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={product.share_images_with_variants === true}
                        onChange={async (e) => {
                          const newValue = e.target.checked;
                          try {
                            const res = await fetch(`/api/b2b/pim/products/${product.entity_code}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ share_images_with_variants: newValue }),
                            });
                            if (res.ok) {
                              setProduct({ ...product, share_images_with_variants: newValue });
                              toast.success(newValue ? "Images will be shared with variants" : "Images sharing disabled");
                            }
                          } catch (error) {
                            toast.error("Failed to update setting");
                          }
                        }}
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="text-sm text-foreground">Product Images</span>
                        <p className="text-xs text-muted-foreground">Append parent&apos;s images to all variants</p>
                      </div>
                    </label>

                    {/* Share Additional Media */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={product.share_media_with_variants === true}
                        onChange={async (e) => {
                          const newValue = e.target.checked;
                          try {
                            const res = await fetch(`/api/b2b/pim/products/${product.entity_code}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ share_media_with_variants: newValue }),
                            });
                            if (res.ok) {
                              setProduct({ ...product, share_media_with_variants: newValue });
                              toast.success(newValue ? "Media will be shared with variants" : "Media sharing disabled");
                            }
                          } catch (error) {
                            toast.error("Failed to update setting");
                          }
                        }}
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="text-sm text-foreground">Additional Media</span>
                        <p className="text-xs text-muted-foreground">Append parent&apos;s documents, videos, 3D models to all variants</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pricing & Packaging - Show if pricing or packaging data exists */}
          {(product.pricing || (product.packaging_options && product.packaging_options.length > 0) || (product.promotions && product.promotions.length > 0)) && (
            <div className="rounded-lg bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Pricing & Packaging
              </h3>
              <div className="space-y-6">
                {/* Product Pricing - Show default packaging pricing, fallback to product.pricing */}
                {(() => {
                  // Find default packaging option for pricing display
                  const defaultPkg = product.packaging_options?.find((p: any) => p.is_default);
                  const displayPricing = defaultPkg?.pricing || product.pricing;
                  const currency = product.pricing?.currency || "EUR";
                  const vatRate = product.pricing?.vat_rate;

                  if (!displayPricing) return null;

                  return (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        Product Pricing {defaultPkg && <span className="text-xs font-normal">({defaultPkg.code})</span>}
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {displayPricing.list !== undefined && (
                          <div className="p-3 bg-muted/50 rounded-lg border">
                            <div className="text-xs text-muted-foreground mb-1">List Price</div>
                            <div className="text-lg font-semibold text-foreground">
                              {currency === "EUR" ? "€" : currency}{displayPricing.list?.toFixed(2)}
                            </div>
                          </div>
                        )}
                        {displayPricing.retail !== undefined && (
                          <div className="p-3 bg-muted/50 rounded-lg border">
                            <div className="text-xs text-muted-foreground mb-1">Retail (MSRP)</div>
                            <div className="text-lg font-semibold text-foreground">
                              {currency === "EUR" ? "€" : currency}{displayPricing.retail?.toFixed(2)}
                            </div>
                          </div>
                        )}
                        {displayPricing.sale !== undefined && (
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            <div className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">Sale Price</div>
                            <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                              {currency === "EUR" ? "€" : currency}{displayPricing.sale?.toFixed(2)}
                            </div>
                          </div>
                        )}
                        <div className="p-3 bg-muted/50 rounded-lg border">
                          <div className="text-xs text-muted-foreground mb-1">Currency</div>
                          <div className="text-lg font-semibold text-foreground">{currency}</div>
                        </div>
                        {vatRate !== undefined && (
                          <div className="p-3 bg-muted/50 rounded-lg border">
                            <div className="text-xs text-muted-foreground mb-1">VAT Rate</div>
                            <div className="text-lg font-semibold text-foreground">{vatRate}%</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Packaging Options */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Packaging Options ({product.packaging_options?.length || 0})
                    </h4>
                    <button
                      onClick={() => {
                        setEditingPackaging(null);
                        setPackagingModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                  {product.packaging_options && product.packaging_options.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Code</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Label</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Qty</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">UOM</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">List</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Retail</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sale</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">List Disc.</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">Sale Disc.</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">Ref</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">Sellable</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">Flags</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground w-10"></th>
                        </tr>
                      </thead>
                        <tbody>
                          {product.packaging_options.map((pkg, idx) => (
                            <tr key={pkg.code + idx} className={`border-b border-border/50 ${pkg.is_default ? "bg-primary/5" : ""}`}>
                              <td className="py-2 px-3 font-mono text-foreground">{pkg.code}</td>
                              <td className="py-2 px-3 text-foreground">
                                {getMultilingualText(pkg.label, defaultLanguageCode, pkg.code)}
                              </td>
                              <td className="py-2 px-3 text-right text-foreground">{pkg.qty}</td>
                              <td className="py-2 px-3 text-foreground">{pkg.uom}</td>
                              <td className="py-2 px-3 text-right text-foreground">
                                {pkg.pricing?.list ? `€${pkg.pricing.list.toFixed(2)}` : "—"}
                              </td>
                              <td className="py-2 px-3 text-right text-foreground">
                                {pkg.pricing?.retail ? `€${pkg.pricing.retail.toFixed(2)}` : "—"}
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-600 font-medium">
                                {pkg.pricing?.sale ? `€${pkg.pricing.sale.toFixed(2)}` : "—"}
                              </td>
                              <td className="py-2 px-3 text-center text-muted-foreground text-xs">
                                {pkg.pricing?.list_discount_pct
                                  ? `-${pkg.pricing.list_discount_pct}%`
                                  : pkg.pricing?.list_discount_amt
                                    ? `-€${pkg.pricing.list_discount_amt}`
                                    : "—"}
                              </td>
                              <td className="py-2 px-3 text-center text-muted-foreground text-xs">
                                {pkg.pricing?.sale_discount_pct
                                  ? `-${pkg.pricing.sale_discount_pct}%`
                                  : pkg.pricing?.sale_discount_amt
                                    ? `-€${pkg.pricing.sale_discount_amt}`
                                    : "—"}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-muted-foreground">
                                {pkg.pricing?.price_ref || "—"}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={pkg.is_sellable !== false}
                                  onChange={async (e) => {
                                    const newValue = e.target.checked;
                                    const updatedOptions = product.packaging_options!.map((p, i) =>
                                      i === idx ? { ...p, is_sellable: newValue } : p
                                    );
                                    setProduct({ ...product, packaging_options: updatedOptions });
                                    try {
                                      await fetch(`/api/b2b/pim/products/${entity_code}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ packaging_options: updatedOptions }),
                                      });
                                      toast.success(`${pkg.code} is now ${newValue ? "sellable" : "not sellable"}`);
                                    } catch {
                                      toast.error("Failed to update packaging option");
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {pkg.is_default && (
                                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">Default</span>
                                  )}
                                  {pkg.is_smallest && (
                                    <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded">Smallest</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => {
                                    setEditingPackaging(pkg);
                                    setPackagingModalOpen(true);
                                  }}
                                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
                                  title="Edit packaging option"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Promotions Table - Collect from all packaging options */}
                {product.packaging_options && product.packaging_options.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        Promotions ({product.packaging_options.reduce((count, pkg) => count + (pkg.promotions?.filter(p => p.is_active).length || 0), 0)})
                      </h4>
                      <button
                        onClick={() => {
                          setEditingPromotion({ promotion: null, packagingCode: product.packaging_options?.[0]?.code || "" });
                          setPromotionModalOpen(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    </div>
                    {product.packaging_options.some(pkg => pkg.promotions && pkg.promotions.filter(p => p.is_active).length > 0) && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Packaging</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Promo Code</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Label</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Discount</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Min Qty</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Promo Price</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Start Date</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">End Date</th>
                            <th className="text-center py-2 px-3 font-medium text-muted-foreground w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {product.packaging_options.flatMap((pkg) =>
                            (pkg.promotions || []).filter(p => p.is_active).map((promo, promoIdx) => (
                              <tr key={`${pkg.code}-${promo.promo_code || promoIdx}`} className="border-b border-border/50">
                                <td className="py-2 px-3 font-mono text-foreground">{pkg.code}</td>
                                <td className="py-2 px-3">
                                  {promo.promo_code && (
                                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs font-mono rounded">
                                      {promo.promo_code}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-foreground">
                                  {promo.label
                                    ? getMultilingualText(promo.label, defaultLanguageCode, promo.promo_type || "Promo")
                                    : promo.promo_type || "Promo"}
                                </td>
                                <td className="py-2 px-3 text-right text-foreground">
                                  {promo.discount_percentage ? `-${promo.discount_percentage}%` : "—"}
                                </td>
                                <td className="py-2 px-3 text-right text-foreground">
                                  {promo.min_quantity || "—"}
                                </td>
                                <td className="py-2 px-3 text-right text-emerald-600 font-medium">
                                  {promo.promo_price ? `€${promo.promo_price.toFixed(2)}` : "—"}
                                </td>
                                <td className="py-2 px-3 text-muted-foreground">
                                  {promo.start_date ? new Date(promo.start_date).toLocaleDateString() : "—"}
                                </td>
                                <td className="py-2 px-3 text-muted-foreground">
                                  {promo.end_date ? new Date(promo.end_date).toLocaleDateString() : "—"}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    onClick={() => {
                                      setEditingPromotion({ promotion: promo, packagingCode: pkg.code });
                                      setPromotionModalOpen(true);
                                    }}
                                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
                                    title="Edit promotion"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </div>
                )}

                {/* Legacy Product-level Promotions (for backwards compatibility) */}
                {product.promotions && product.promotions.filter(p => p.is_active).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                      Product Promotions ({product.promotions.filter(p => p.is_active).length})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Promo Code</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Label</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Discount</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Promo Price</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Start Date</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">End Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {product.promotions.filter(p => p.is_active).map((promo, idx) => (
                            <tr key={promo.promo_code || idx} className="border-b border-border/50">
                              <td className="py-2 px-3">
                                {promo.promo_code && (
                                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs font-mono rounded">
                                    {promo.promo_code}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-foreground">
                                {promo.label
                                  ? getMultilingualText(promo.label, defaultLanguageCode, promo.promo_type || "Promotion")
                                  : promo.promo_type || "Promotion"}
                              </td>
                              <td className="py-2 px-3 text-right text-foreground">
                                {promo.discount_percentage ? `-${promo.discount_percentage}%` : "—"}
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-600 font-medium">
                                {promo.promo_price ? `€${promo.promo_price.toFixed(2)}` : "—"}
                              </td>
                              <td className="py-2 px-3 text-muted-foreground">
                                {promo.start_date ? new Date(promo.start_date).toLocaleDateString() : "—"}
                              </td>
                              <td className="py-2 px-3 text-muted-foreground">
                                {promo.end_date ? new Date(promo.end_date).toLocaleDateString() : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Basic Information</h3>
            <div className="space-y-4">
              <MultilingualInput
                label="Product Name"
                value={formData.name}
                onChange={(value) => handleInputChange("name", value)}
                placeholder="Enter product name"
                required={true}
                variant="reference"
                showReference={true}
              />

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={formData.product_model}
                  onChange={(e) => handleInputChange("product_model", e.target.value)}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="Enter product model"
                />
              </div>
              {/* Variant Information */}


              <MultilingualInput
                label="Short Description"
                value={formData.short_description}
                onChange={(value) => handleInputChange("short_description", value)}
                placeholder="Brief product description"
                variant="reference"
                showReference={true}
              />

              <MultilingualTextarea
                label="Description"
                value={formData.description}
                onChange={(value) => handleInputChange("description", value)}
                placeholder="Detailed product description"
                rows={8}
                variant="reference"
                showReference={true}
              />
            </div>
          </div>


          {/* Inventory */}
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Inventory</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Stock Quantity
                </label>
                <input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => handleInputChange("stock_quantity", e.target.value)}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange("status", e.target.value as "draft" | "published" | "archived")}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Product Type */}
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Product Type</h3>
              {productType && ((productType.hierarchy && productType.hierarchy.length > 0) || (productType.inherited_features && productType.inherited_features.length > 0)) && (
                <button
                  onClick={() => setShowProductTypeJSON(!showProductTypeJSON)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
                  title={showProductTypeJSON ? "Switch to selector" : "View JSON"}
                >
                  {showProductTypeJSON ? <List className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
                  {showProductTypeJSON ? "Use Selector" : "View JSON"}
                </button>
              )}
            </div>
            {productType && ((productType.hierarchy && productType.hierarchy.length > 0) || (productType.inherited_features && productType.inherited_features.length > 0)) && showProductTypeJSON ? (
              <div className="p-3 bg-muted/50 rounded border">
                <div className="text-xs font-medium text-muted-foreground mb-2">Self-Contained Data:</div>
                <pre className="text-xs overflow-auto max-h-64">
                  {JSON.stringify(productType, null, 2)}
                </pre>
              </div>
            ) : (
              <ProductTypeSelector
                value={productType ? {
                  id: productType.product_type_id || productType.id,
                  name: productType.name,
                  slug: productType.slug,
                } : undefined}
                onChange={(selectedType) => {
                  setProductType(selectedType);
                  // Clear feature values when product type changes
                  if (!selectedType) {
                    setFeatureValues([]);
                  }
                }}
                disabled={isOldVersion}
              />
            )}
          </div>



          {/* Category */}
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Category</h3>
              {category && (category as any).hierarchy && (category as any).hierarchy.length > 0 && (
                <button
                  onClick={() => setShowCategoryJSON(!showCategoryJSON)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
                  title={showCategoryJSON ? "Switch to selector" : "View JSON"}
                >
                  {showCategoryJSON ? <List className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
                  {showCategoryJSON ? "Use Selector" : "View JSON"}
                </button>
              )}
            </div>
            {category && (category as any).hierarchy && (category as any).hierarchy.length > 0 && showCategoryJSON ? (
              <div className="p-3 bg-muted/50 rounded border">
                <div className="text-xs font-medium text-muted-foreground mb-2">Self-Contained Data:</div>
                <pre className="text-xs overflow-auto max-h-64">
                  {JSON.stringify(category, null, 2)}
                </pre>
              </div>
            ) : (
              <CategorySelector
                value={category || undefined}
                onChange={setCategory}
                disabled={isOldVersion}
              />
            )}
          </div>

          {/* Collections */}
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Collections</h3>
              {collections && collections.length > 0 && collections.some((c: any) => c.hierarchy && c.hierarchy.length > 0) && (
                <button
                  onClick={() => setShowCollectionsJSON(!showCollectionsJSON)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
                  title={showCollectionsJSON ? "Switch to selector" : "View JSON"}
                >
                  {showCollectionsJSON ? <List className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
                  {showCollectionsJSON ? "Use Selector" : "View JSON"}
                </button>
              )}
            </div>
            {collections && collections.length > 0 && collections.some((c: any) => c.hierarchy && c.hierarchy.length > 0) && showCollectionsJSON ? (
              <div className="p-3 bg-muted/50 rounded border">
                <div className="text-xs font-medium text-muted-foreground mb-2">Self-Contained Data:</div>
                <pre className="text-xs overflow-auto max-h-64">
                  {JSON.stringify(collections, null, 2)}
                </pre>
              </div>
            ) : (
              <CollectionsSelector
                value={collections}
                onChange={setCollections}
                disabled={isOldVersion}
              />
            )}
          </div>

          {/* Brand */}
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Brand</h3>
              {brand && (brand as any).hierarchy && (brand as any).hierarchy.length > 0 && (
                <button
                  onClick={() => setShowBrandJSON(!showBrandJSON)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
                  title={showBrandJSON ? "Switch to selector" : "View JSON"}
                >
                  {showBrandJSON ? <List className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
                  {showBrandJSON ? "Use Selector" : "View JSON"}
                </button>
              )}
            </div>
            {brand && (brand as any).hierarchy && (brand as any).hierarchy.length > 0 && showBrandJSON ? (
              <div className="p-3 bg-muted/50 rounded border">
                <div className="text-xs font-medium text-muted-foreground mb-2">Self-Contained Data:</div>
                <pre className="text-xs overflow-auto max-h-64">
                  {JSON.stringify(brand, null, 2)}
                </pre>
              </div>
            ) : (
              <BrandSelector
                value={brand}
                onChange={setBrand}
              />
            )}
          </div>

          {/* Features - Only shown when product type is selected */}
          {productType && productType.featureDetails && productType.featureDetails.length > 0 && (
            <div className="rounded-lg bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-4">Features</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Complete the technical features for this product type
              </p>
              <FeaturesForm
                features={productType.featureDetails}
                values={featureValues}
                onChange={setFeatureValues}
                disabled={isOldVersion}
              />
            </div>
          )}

          {/* Custom Attributes */}
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Custom Attributes</h3>
            <AttributesEditor
              value={customAttributes}
              onChange={setCustomAttributes}
              disabled={isOldVersion}
            />
          </div>

          {/* Tags */}
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Tags</h3>
              {tagRefs && tagRefs.length > 0 && tagRefs.some((t: any) => t.tag_group_data && Object.keys(t.tag_group_data).length > 0) && (
                <button
                  onClick={() => setShowTagsJSON(!showTagsJSON)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
                  title={showTagsJSON ? "Switch to selector" : "View JSON"}
                >
                  {showTagsJSON ? <List className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
                  {showTagsJSON ? "Use Selector" : "View JSON"}
                </button>
              )}
            </div>
            {tagRefs && tagRefs.length > 0 && tagRefs.some((t: any) => t.tag_group_data && Object.keys(t.tag_group_data).length > 0) && showTagsJSON ? (
              <div className="p-3 bg-muted/50 rounded border">
                <div className="text-xs font-medium text-muted-foreground mb-2">Self-Contained Data:</div>
                <pre className="text-xs overflow-auto max-h-64">
                  {JSON.stringify(tagRefs, null, 2)}
                </pre>
              </div>
            ) : (
              <TagSelector value={tagRefs} onChange={setTagRefs} disabled={isOldVersion} />
            )}
          </div>

          {/* Synonym Dictionaries */}
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Synonym Dictionaries</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Associate this product with synonym dictionaries to improve search results
            </p>
            <SynonymDictionarySelector
              value={synonymKeys}
              onChange={setSynonymKeys}
              disabled={isOldVersion}
            />
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="rounded-lg bg-card p-6 shadow-sm">
        <ImageGallery
          images={product.images || []}
          onReorder={handleImageReorder}
          onDelete={handleImageDelete}
          onUpload={handleImageUpload}
          onSetPrimary={handleImageSetPrimary}
          primaryImageKey={product.images?.[0]?.cdn_key}
          disabled={isSaving || isUploadingImages}
        />
      </div>

      {/* Media Gallery */}
      <div className="rounded-lg bg-card p-6 shadow-sm">
        <MediaGallery
          media={product.media || []}
          onUpload={handleMediaUpload}
          onAddLink={handleMediaAddLink}
          onDelete={handleMediaDelete}
          onLabelUpdate={handleMediaLabelUpdate}
          onReorder={handleMediaReorder}
          disabled={isSaving}
        />
      </div>

      {/* Unsaved Changes Footer */}
      {hasChanges && !isOldVersion && (
        <div className="fixed bottom-0 left-0 right-0 bg-amber-50 border-t border-amber-200 shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <div className="text-sm font-semibold text-amber-900">
                    You have unsaved changes
                  </div>
                  <div className="text-xs text-amber-700">
                    Save your changes before leaving this page
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDiscard}
                  className="px-4 py-2 bg-white border border-border rounded-md hover:bg-gray-50 text-sm font-medium transition"
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Product Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <EyeOff className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                {product.images?.[0]?.url ? (
                  <Image
                    src={product.images[0].url}
                    alt={getMultilingualText(formData.name, defaultLanguageCode, "Product")}
                    width={600}
                    height={600}
                    quality={90}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-32 w-32 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {getMultilingualText(formData.name, defaultLanguageCode, "Product")}
                </h2>
                {getMultilingualText(formData.short_description, defaultLanguageCode, "") && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {getMultilingualText(formData.short_description, defaultLanguageCode, "")}
                  </p>
                )}
              </div>

              {getMultilingualText(formData.description, defaultLanguageCode, "") && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Description</h4>
                  <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                    {getMultilingualText(formData.description, defaultLanguageCode, "")}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">SKU</div>
                  <div className="text-sm font-medium text-foreground font-mono">{product.sku}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Stock</div>
                  <div className="text-sm font-medium text-foreground">{formData.stock_quantity} units</div>
                </div>
                {brand && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Brand</div>
                    <div className="text-sm font-medium text-foreground">{brand.label}</div>
                  </div>
                )}
                {formData.category_name && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Category</div>
                    <div className="text-sm font-medium text-foreground">{formData.category_name}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Packaging Option Modal */}
      <PackagingOptionModal
        open={packagingModalOpen}
        option={editingPackaging}
        defaultLanguageCode={defaultLanguageCode}
        onSave={handleSavePackaging}
        onClose={() => {
          setPackagingModalOpen(false);
          setEditingPackaging(null);
        }}
      />

      {/* Promotion Modal */}
      <PromotionModal
        open={promotionModalOpen}
        promotion={editingPromotion.promotion}
        packagingCode={editingPromotion.packagingCode}
        packagingOptions={product?.packaging_options || []}
        defaultLanguageCode={defaultLanguageCode}
        onSave={handleSavePromotion}
        onClose={() => {
          setPromotionModalOpen(false);
          setEditingPromotion({ promotion: null, packagingCode: "" });
        }}
      />
    </div>
  );
}
