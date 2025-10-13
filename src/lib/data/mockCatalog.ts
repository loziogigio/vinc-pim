import type { CategoryItem } from "@/lib/types/blocks";

export interface MockProduct {
  id: string;
  name: string;
  price: number;
  compareAt?: number;
  image: string;
  collection: string[];
  rating?: number;
}

const MOCK_PRODUCTS: MockProduct[] = Array.from({ length: 16 }).map((_, index) => {
  const base = index + 1;
  return {
    id: `prod-${base}`,
    name: `Professional Kit ${base}`,
    price: 149 + base * 12,
    compareAt: base % 3 === 0 ? 199 + base * 10 : undefined,
    image: `https://images.unsplash.com/photo-1581166397057-235af2b3c6dd?auto=format&fit=crop&w=640&q=${70 + base}`,
    rating: 4 + ((base + 1) % 2) * 0.5,
    collection: base % 2 === 0 ? ["featured", "all"] : ["best-sellers", "featured", "all"]
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
  }
];

export const getMockProducts = (collection: string, limit: number) => {
  const filtered = MOCK_PRODUCTS.filter((product) => product.collection.includes(collection));
  return (filtered.length ? filtered : MOCK_PRODUCTS).slice(0, limit);
};

export const getMockCategories = (limit?: number) =>
  typeof limit === "number" ? MOCK_CATEGORIES.slice(0, limit) : MOCK_CATEGORIES;
