"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { ImageGallery } from "@/components/pim/ImageGallery";
import { MediaGallery } from "@/components/pim/MediaGallery";
import { ConflictResolver } from "@/components/pim/ConflictResolver";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { ProductTypeSelector } from "@/components/pim/ProductTypeSelector";
import { CollectionsSelector } from "@/components/pim/CollectionsSelector";
import { CategorySelector } from "@/components/pim/CategorySelector";
import { BrandSelector } from "@/components/pim/BrandSelector";
import { FeaturesForm } from "@/components/pim/FeaturesForm";
import { AttributesEditor } from "@/components/pim/AttributesEditor";
import { TagSelector, TagReference } from "@/components/pim/TagSelector";
import { MultilingualInput } from "@/components/pim/MultilingualInput";
import { MultilingualTextarea } from "@/components/pim/MultilingualTextarea";
import { LanguageSwitcher } from "@/components/pim/LanguageSwitcher";
import { useLanguageStore } from "@/lib/stores/languageStore";
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
} from "lucide-react";

type Product = {
  _id: string;
  entity_code: string;
  sku: string;
  name: string | Record<string, string>;
  version: number;
  updated_at?: string;
  edited_at?: string;
  last_manual_update_at?: string;
  last_api_update_at?: string;
  description?: string | Record<string, string>;
  short_description?: string | Record<string, string>;
  price?: number;
  currency?: string;
  quantity: number;
  status: "draft" | "published" | "archived";
  image: {
    id: string;
    thumbnail: string;
    medium?: string;
    large?: string;
    original: string;
    blur?: string;
  };
  images?: {
    url: string;
    cdn_key: string;
    position: number;
    file_name?: string;
    size_bytes?: number;
    uploaded_at: string;
    uploaded_by: string;
  }[];
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
  tag?: TagReference[];
  tags?: string[];
  completeness_score: number;
  critical_issues: string[];
  updated_at: string;
  // Conflict tracking
  has_conflict?: boolean;
  conflict_data?: {
    field: string;
    manual_value: any;
    api_value: any;
    detected_at: Date;
  }[];
  last_api_update_at?: string;
  last_manual_update_at?: string;
  // Analytics
  analytics?: {
    views_30d?: number;
    clicks_30d?: number;
    add_to_cart_30d?: number;
    conversions_30d?: number;
    priority_score?: number;
    last_synced_at?: string;
  };
};

type FormData = {
  name: Record<string, string>;
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

  // Language store for getting default language from database
  const { languages } = useLanguageStore();
  const defaultLanguage = languages.find(lang => lang.isDefault) || languages.find(lang => lang.code === "it");
  const defaultLanguageCode = defaultLanguage?.code || "it";

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isOldVersion, setIsOldVersion] = useState(false);
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: {},
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
  const [brand, setBrand] = useState<{ id: string; name: string | Record<string, string>; slug: string; image?: any } | null>(null);
  const [featureValues, setFeatureValues] = useState<any[]>([]);
  const [customAttributes, setCustomAttributes] = useState<Record<string, any>>({});
  const [tagRefs, setTagRefs] = useState<TagReference[]>([]);

  // Original values for comparison
  const [originalProductType, setOriginalProductType] = useState<any>(null);
  const [originalCollections, setOriginalCollections] = useState<{ id: string; name: string | Record<string, string>; slug: string }[]>([]);
  const [originalCategory, setOriginalCategory] = useState<{ id: string; name: string | Record<string, string>; slug: string } | null>(null);
  const [originalBrand, setOriginalBrand] = useState<{ id: string; name: string | Record<string, string>; slug: string; image?: any } | null>(null);
  const [originalFeatureValues, setOriginalFeatureValues] = useState<any[]>([]);
  const [originalCustomAttributes, setOriginalCustomAttributes] = useState<Record<string, any>>({});
  const [originalTagRefs, setOriginalTagRefs] = useState<TagReference[]>([]);

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
    const productTypeChanged = productType?.id !== originalProductType?.id;

    // Check if collections changed
    const collectionsChanged = JSON.stringify(collections) !== JSON.stringify(originalCollections);

    // Check if category changed
    const categoryChanged = category?.id !== originalCategory?.id;

    // Check if brand changed
    const brandChanged = brand?.id !== originalBrand?.id;

    // Check if feature values changed
    const featuresChanged = JSON.stringify(featureValues) !== JSON.stringify(originalFeatureValues);

    // Check if custom attributes changed
    const attributesChanged = JSON.stringify(customAttributes) !== JSON.stringify(originalCustomAttributes);

    // Check if tags changed
    const tagsChanged = JSON.stringify(tagRefs) !== JSON.stringify(originalTagRefs);

    const hasAnyChanges =
      formChanged ||
      productTypeChanged ||
      collectionsChanged ||
      categoryChanged ||
      brandChanged ||
      featuresChanged ||
      attributesChanged ||
      tagsChanged;

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
    originalTagRefs
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
        const loadedAttributes = data.product.attributes || {};
        const loadedTagRefs: TagReference[] = Array.isArray(data.product.tag)
          ? data.product.tag.map((tag: any) => {
              // Extract string from multilingual name if needed
              let tagNameString = '';
              if (typeof tag.name === 'string') {
                tagNameString = tag.name;
              } else if (tag.name && typeof tag.name === 'object') {
                tagNameString = tag.name.it || tag.name.en || Object.values(tag.name)[0] || '';
              }

              return {
                id: tag.id || tag.tag_id || tag.slug || tagNameString,
                name: tag.name,
                slug: tag.slug || (tagNameString ? tagNameString.toLowerCase().replace(/\s+/g, "-") : ""),
                color: tag.color,
              };
            })
          : [];

        if (loadedTagRefs.length === 0 && Array.isArray(data.product.tags)) {
          data.product.tags.forEach((tag: any) => {
            if (!tag) return;

            // Handle both string tags and tag objects with multilingual names
            let tagName: string;
            if (typeof tag === 'string') {
              tagName = tag;
            } else if (tag.name) {
              // Extract name from multilingual object or use string directly
              tagName = typeof tag.name === 'string'
                ? tag.name
                : (tag.name.it || tag.name.en || Object.values(tag.name)[0] || '');
            } else {
              return;
            }

            const slug = tag.slug || tagName.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
            loadedTagRefs.push({
              id: tag.id || slug,
              name: tag.name || tagName,
              slug,
            });
          });
        }

        setProductType(loadedProductType);
        setFeatureValues(loadedFeatures);
        setCollections(loadedCollections);
        setCategory(loadedCategory);
        setBrand(loadedBrand);
        setCustomAttributes(loadedAttributes);
        setTagRefs(loadedTagRefs);

        // Set original values for change detection
        setOriginalProductType(loadedProductType);
        setOriginalFeatureValues(loadedFeatures);
        setOriginalCollections(loadedCollections);
        setOriginalCategory(loadedCategory);
        setOriginalBrand(loadedBrand);
        setOriginalCustomAttributes(loadedAttributes);
        setOriginalTagRefs(loadedTagRefs);
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

      // Add brand
      if (brand) {
        updates.brand = {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          image: brand.image,
        };
      }

      // Add custom attributes
      updates.attributes = customAttributes;

      // Add tags
      updates.tag = tagRefs;
      updates.tags = tagRefs.map((tag) => tag.name);

      console.log("💾 Saving product with updates:", {
        product_type: updates.product_type,
        collections: updates.collections,
        brand: updates.brand,
        attributes: updates.attributes,
        tags: updates.tags,
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
        setOriginalTagRefs(tagRefs);

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

  async function handleImageUpload(files: File[]) {
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
      // Refresh product data to get new images
      await fetchProduct();
    } else {
      const error = await res.json();
      throw new Error(error.error || "Upload failed");
    }
  }

  async function handleImageDelete(cdn_key: string) {
    const res = await fetch(
      `/api/b2b/pim/products/${entity_code}/images?cdn_key=${encodeURIComponent(cdn_key)}`,
      {
        method: "DELETE",
      }
    );

    if (!res.ok) {
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

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Reorder failed");
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
            href="/b2b/pim/products"
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
              href="/b2b/pim/products"
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
            href={`/b2b/pim/products/${entity_code}/history`}
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
              href={`/b2b/pim/products/${entity_code}`}
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
                className={`inline-flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg ${
                  product.completeness_score >= 80
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
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                  product.status === "published"
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
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                        isSynced
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Product Image */}
        <div className="lg:col-span-1">
          <div className="rounded-lg bg-card p-4 shadow-sm sticky top-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">Product Image</h3>
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              {product.image?.large || product.image?.original ? (
                <Image
                  src={product.image.large || product.image.original}
                  alt={getMultilingualText(product.name, defaultLanguageCode, "Product image")}
                  width={400}
                  height={400}
                  quality={90}
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  priority
                  placeholder={product.image.blur ? "blur" : "empty"}
                  blurDataURL={product.image.blur}
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
        <div className="lg:col-span-2 space-y-6">
          {/* Language Switcher */}
          <div className="rounded-lg bg-card p-4 shadow-sm">
            <LanguageSwitcher variant="compact" showLabel={true} />
          </div>

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
            <h3 className="text-lg font-semibold text-foreground mb-4">Product Type</h3>
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
          </div>

          {/* Category */}
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Category</h3>
            <CategorySelector
              value={category || undefined}
              onChange={setCategory}
              disabled={isOldVersion}
            />
          </div>

          {/* Collections */}
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Collections</h3>
            <CollectionsSelector
              value={collections}
              onChange={setCollections}
              disabled={isOldVersion}
            />
          </div>

          {/* Brand */}
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Brand</h3>
            <BrandSelector
              value={brand}
              onChange={setBrand}
            />
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
            <h3 className="text-lg font-semibold text-foreground mb-4">Tags</h3>
            <TagSelector value={tagRefs} onChange={setTagRefs} disabled={isOldVersion} />
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
          disabled={isSaving}
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
                {product.image?.large || product.image?.original ? (
                  <Image
                    src={product.image.large || product.image.original}
                    alt={getMultilingualText(formData.name, defaultLanguageCode, "Product")}
                    width={600}
                    height={600}
                    quality={90}
                    placeholder={product.image.blur ? "blur" : "empty"}
                    blurDataURL={product.image.blur}
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
                    <div className="text-sm font-medium text-foreground">{brand.name}</div>
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
    </div>
  );
}
