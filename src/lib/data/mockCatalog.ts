import type { CategoryItem } from "@/lib/types/blocks";

export interface MockProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAt?: number;
  image: string;
  collection: string[];
  rating?: number;
  category?: string;
  brand?: string;
  description?: string;
  badge?: string;
}

const MOCK_PRODUCTS: MockProduct[] = Array.from({ length: 50 }).map((_, index) => {
  const base = index + 1;
  const categories = ["Hydronic Heating", "Bathroom Suites", "Kitchen Tapware", "Service Tools", "Water Heaters"];
  const brands = ["Bosch", "Viessmann", "Grundfos", "Vaillant", "Honeywell", "Danfoss"];
  const category = categories[base % categories.length];
  const brand = brands[base % brands.length];

  return {
    id: `prod-${base}`,
    slug: `professional-kit-${base}`,
    name: `${brand} Professional ${category} Kit ${base}`,
    price: 149 + base * 12,
    compareAt: base % 3 === 0 ? 199 + base * 10 : undefined,
    image: `https://images.unsplash.com/photo-1581166397057-235af2b3c6dd?auto=format&fit=crop&w=640&q=${70 + base}`,
    rating: 3.5 + ((base % 5) * 0.3),
    collection: base % 2 === 0 ? ["featured", "all"] : ["best-sellers", "featured", "all"],
    category,
    brand,
    description: `High-quality ${category.toLowerCase()} equipment from ${brand}. Professional grade with warranty.`,
    badge: base % 5 === 0 ? "New" : base % 7 === 0 ? "Sale" : undefined
  };
});

const MOCK_CATEGORIES: CategoryItem[] = [
  {
    id: "hydronics",
    name: "Hydronic Heating",
    image: "https://images.unsplash.com/photo-1620825141088-a824daf6a46b?auto=format&fit=crop&w=640&q=80",
    link: "/categories/hydronics"
  },
  {
    id: "bathroom",
    name: "Bathroom Suites",
    image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=640&q=80",
    link: "/categories/bathroom"
  },
  {
    id: "kitchen",
    name: "Kitchen Tapware",
    image: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=640&q=80",
    link: "/categories/kitchen"
  },
  {
    id: "tools",
    name: "Service Tools",
    image: "https://images.unsplash.com/photo-1654923203455-23b1e9dd97ec?auto=format&fit=crop&w=640&q=80",
    link: "/categories/tools"
  },
  {
    id: "water-heaters",
    name: "Water Heaters",
    image: "https://images.unsplash.com/photo-1580983669876-26ce2fe10723?auto=format&fit=crop&w=640&q=80",
    link: "/categories/water-heaters"
  },
  {
    id: "filtration",
    name: "Water Filtration",
    image: "https://images.unsplash.com/photo-1613478836448-0e4ac259b010?auto=format&fit=crop&w=640&q=80",
    link: "/categories/filtration"
  },
  {
    id: "outdoor",
    name: "Outdoor Kitchens",
    image: "https://images.unsplash.com/photo-1505692952047-897bf90f17f3?auto=format&fit=crop&w=640&q=80",
    link: "/categories/outdoor"
  },
  {
    id: "commercial",
    name: "Commercial Plumbing",
    image: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=640&q=80",
    link: "/categories/commercial"
  },
  {
    id: "smart-home",
    name: "Smart Home",
    image: "https://images.unsplash.com/photo-1495375225758-c0c23fef4241?auto=format&fit=crop&w=640&q=80",
    link: "/categories/smart-home"
  }
];

export const getMockProducts = (collection: string, limit: number) => {
  const filtered = MOCK_PRODUCTS.filter((product) => product.collection.includes(collection));
  return (filtered.length ? filtered : MOCK_PRODUCTS).slice(0, limit);
};

export const getMockCategories = (limit?: number) =>
  typeof limit === "number" ? MOCK_CATEGORIES.slice(0, limit) : MOCK_CATEGORIES;

// Export the full catalog for search page
export const mockCatalog = MOCK_PRODUCTS;
