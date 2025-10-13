'use client';

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  Moon,
  Percent,
  Search,
  ShoppingCart,
  Star,
  Store,
  Sun
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const MotionImage = motion.create(Image);

type Category = {
  id: number;
  name: string;
  image: string;
};

type Product = {
  id: number;
  name: string;
  price: string;
  compareAt: string | null;
  rating: number;
  image: string;
};

type Post = {
  id: number;
  title: string;
  image: string;
  excerpt: string;
};

const categories: Category[] = [
  {
    id: 1,
    name: "Pipe Fittings",
    image: "https://images.unsplash.com/photo-1555001972-76611884af13?auto=format&fit=crop&w=320&q=80"
  },
  {
    id: 2,
    name: "Valves & Controls",
    image: "https://images.unsplash.com/photo-1581166397057-235af2b3c6dd?auto=format&fit=crop&w=320&q=80"
  },
  {
    id: 3,
    name: "Drainage",
    image: "https://images.unsplash.com/photo-1620825141088-a824daf6a46b?auto=format&fit=crop&w=320&q=80"
  },
  {
    id: 4,
    name: "Faucets",
    image: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=320&q=80"
  },
  {
    id: 5,
    name: "Showers",
    image: "https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?auto=format&fit=crop&w=320&q=80"
  },
  {
    id: 6,
    name: "Bath Furniture",
    image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=320&q=80"
  },
  {
    id: 7,
    name: "Heating & Boilers",
    image: "https://images.unsplash.com/photo-1588619461335-b81119fee1b5?auto=format&fit=crop&w=320&q=80"
  },
  {
    id: 8,
    name: "Sealants & Tape",
    image: "https://images.unsplash.com/photo-1654923203455-23b1e9dd97ec?auto=format&fit=crop&w=320&q=80"
  },
  {
    id: 9,
    name: "Power Tools",
    image: "https://images.unsplash.com/photo-1581166418878-11f0dde922c2?auto=format&fit=crop&w=320&q=80"
  },
  {
    id: 10,
    name: "Service Kits",
    image: "https://images.unsplash.com/photo-1654440122140-f1fc995ddb34?auto=format&fit=crop&w=320&q=80"
  }
];

const products: Product[] = [
  {
    id: 1,
    name: "ProPEX Expansion Tool Kit",
    price: "129.90",
    compareAt: "149.90",
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1581166397057-235af2b3c6dd?auto=format&fit=crop&w=640&q=80"
  },
  {
    id: 2,
    name: "Thermostatic Shower Column",
    price: "499.00",
    compareAt: "549.00",
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?auto=format&fit=crop&w=640&q=80"
  },
  {
    id: 3,
    name: "Wall-Mounted Vanity Set",
    price: "899.00",
    compareAt: null,
    rating: 4.0,
    image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=640&q=80"
  },
  {
    id: 4,
    name: "Stainless Work Basin & Faucet",
    price: "259.90",
    compareAt: "289.90",
    rating: 5,
    image: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=640&q=80"
  },
  {
    id: 5,
    name: "High-Flow Sump Pump",
    price: "349.00",
    compareAt: null,
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1620825141088-a824daf6a46b?auto=format&fit=crop&w=640&q=80"
  },
  {
    id: 6,
    name: "Copper Press Fittings (50 pcs)",
    price: "189.00",
    compareAt: "209.00",
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1555001972-76611884af13?auto=format&fit=crop&w=640&q=80"
  },
  {
    id: 7,
    name: "Condensing Boiler Maintenance Kit",
    price: "129.00",
    compareAt: null,
    rating: 4,
    image: "https://images.unsplash.com/photo-1588619461335-b81119fee1b5?auto=format&fit=crop&w=640&q=80"
  },
  {
    id: 8,
    name: "Pro Service Tool Roll",
    price: "89.90",
    compareAt: "99.90",
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1654923203455-23b1e9dd97ec?auto=format&fit=crop&w=640&q=80"
  }
];

const posts: Post[] = [
  {
    id: 1,
    title: "How to spec the right valve for commercial jobs",
    image: "https://images.unsplash.com/photo-1595345263387-c01f60e7c1b9?auto=format&fit=crop&w=880&q=80",
    excerpt: "Key pressure ratings, media compatibility, and install tips to help you choose the perfect valve every time."
  },
  {
    id: 2,
    title: "Planning spa-like bathrooms clients will love",
    image: "https://images.unsplash.com/photo-1487015307662-6ce6210680f1?auto=format&fit=crop&w=880&q=80",
    excerpt: "From concealed mixers to floating vanities, here’s how installers elevate residential bath projects."
  },
  {
    id: 3,
    title: "Five must-have tools for rapid callouts",
    image: "https://images.unsplash.com/photo-1618373012585-ae012fc350e8?auto=format&fit=crop&w=880&q=80",
    excerpt: "A curated checklist to keep every emergency service van stocked and profitable."
  },
  {
    id: 4,
    title: "Troubleshooting hydronic heating complaints",
    image: "https://images.unsplash.com/photo-1654440122140-f1fc995ddb34?auto=format&fit=crop&w=880&q=80",
    excerpt: "Learn the diagnostic flow our pros follow before swapping pumps or controls."
  }
];

const Section = ({
  children,
  title,
  className = ""
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) => (
  <section className={`max-w-screen-xl mx-auto px-4 md:px-6 ${className}`}>
    {title && (
      <div className="mb-4 flex items-center justify-between md:mb-6">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
        <Button variant="ghost" className="text-sm">
          View all
        </Button>
      </div>
    )}
    {children}
  </section>
);

const useDarkMode = () => {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [dark]);

  return { dark, setDark };
};

const CategoryScroller = ({ items }: { items: Category[] }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const pointerId = useRef<number | null>(null);
  const dragStartX = useRef(0);
  const dragStartScroll = useRef(0);
  const [dragging, setDragging] = useState(false);
  const scrollBy = (delta: number) => {
    ref.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = ref.current;
    if (!container) {
      return;
    }
    pointerId.current = event.pointerId;
    dragStartX.current = event.clientX;
    dragStartScroll.current = container.scrollLeft;
    setDragging(true);
    container.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !ref.current) {
      return;
    }
    const delta = event.clientX - dragStartX.current;
    ref.current.scrollLeft = dragStartScroll.current - delta;
    event.preventDefault();
  };

  const endDrag = () => {
    if (!ref.current) {
      return;
    }
    if (pointerId.current !== null) {
      try {
        ref.current.releasePointerCapture(pointerId.current);
      } catch {
        // pointer already released
      }
      pointerId.current = null;
    }
    setDragging(false);
  };

  return (
    <div className="relative overflow-hidden">
      <button
        aria-label="scroll categories left"
        onClick={() => scrollBy(-240)}
        className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-background/80 p-1 shadow backdrop-blur md:flex"
      >
        <ChevronLeft size={18} />
      </button>
      <div
        ref={ref}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        className={`no-scrollbar flex overflow-x-auto gap-3 px-2 py-2 scroll-smooth select-none md:px-4 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {items.map((category) => (
          <button
            key={category.id}
            className="group inline-flex flex-shrink-0 items-center gap-3 rounded-2xl border bg-card px-3 py-2 shadow-sm transition-colors hover:bg-accent"
          >
            <Image
              src={category.image}
              alt={category.name}
              width={120}
              height={80}
              className="h-8 w-12 rounded-xl object-cover"
              sizes="48px"
            />
            <span className="text-sm font-medium whitespace-nowrap md:text-[15px]">
              {category.name}
            </span>
          </button>
        ))}
      </div>
      <button
        aria-label="scroll categories right"
        onClick={() => scrollBy(240)}
        className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-background/80 p-1 shadow backdrop-blur md:flex"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

const Header = ({
  dark,
  toggleDark
}: {
  dark: boolean;
  toggleDark: () => void;
}) => (
  <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
    <div className="mx-auto flex max-w-screen-xl items-center gap-3 px-4 py-3 md:px-6">
      <Button variant="ghost" size="icon" className="rounded-xl">
        <Menu />
      </Button>
      <div className="flex items-center gap-2">
        <Store className="text-primary" />
        <span className="text-lg font-semibold">VINC Trade Supply</span>
      </div>
      <div className="hidden flex-1 items-center gap-2 md:flex">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" size={18} />
          <Input placeholder="Search products…" className="rounded-xl pl-9" />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={toggleDark}>
          {dark ? <Sun /> : <Moon />}
        </Button>
        <Button variant="default" size="icon" className="rounded-xl">
          <ShoppingCart />
        </Button>
      </div>
    </div>
    <div className="mx-auto max-w-screen-xl px-4 pb-2 md:px-6">
      <CategoryScroller items={categories} />
    </div>
  </header>
);

const HeroBanner = () => (
  <div className="relative h-[48vh] w-full overflow-hidden rounded-3xl md:h-[56vh]">
    <Image
      src="https://images.unsplash.com/photo-1676210134188-4c05dd172f89?auto=format&fit=crop&w=1600&q=80"
      alt="Plumber at work installing piping"
      fill
      priority
      className="object-cover"
      sizes="100vw"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
    <div className="absolute bottom-6 left-6 max-w-xl text-white md:left-10">
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold leading-tight md:text-5xl"
      >
        Trade-Ready Plumbing Supply, Delivered Fast
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-2 text-white/90 md:mt-3"
      >
        Stock your crew with pro fixtures, fittings, and finish-grade bath furniture in one place.
      </motion.p>
      <div className="mt-4 flex gap-3">
        <Button className="rounded-xl">Shop Catalog</Button>
        <Button variant="secondary" className="rounded-xl">
          Request Trade Account
        </Button>
      </div>
    </div>
  </div>
);

const HeroSplit = () => (
  <div className="grid items-stretch gap-4 overflow-hidden rounded-3xl md:grid-cols-2 md:gap-6">
    <div className="flex flex-col justify-center rounded-3xl border bg-card p-6 md:p-10">
      <h1 className="text-3xl font-bold md:text-5xl">Built for Installers</h1>
      <p className="mt-3 text-muted-foreground">
        Upload supplier price lists, manage customer quotes, and bundle premium bath furniture in
        minutes.
      </p>
      <div className="mt-5 flex gap-3">
        <Button className="rounded-xl">Create Free Account</Button>
        <Button variant="outline" className="rounded-xl">
          Explore Platform
        </Button>
      </div>
    </div>
    <div className="relative overflow-hidden rounded-3xl">
      <Image
        src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80"
        alt="Modern bathroom interior with freestanding tub"
        fill
        className="object-cover"
        sizes="(min-width: 768px) 50vw, 100vw"
      />
    </div>
  </div>
);

const gridImages = [
  {
    label: "Copper & PEX",
    image: "https://images.unsplash.com/photo-1581166397057-235af2b3c6dd?auto=format&fit=crop&w=1200&q=80"
  },
  {
    label: "Bathroom Suites",
    image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80"
  },
  {
    label: "Drainage Kits",
    image: "https://images.unsplash.com/photo-1620825141088-a824daf6a46b?auto=format&fit=crop&w=1200&q=80"
  },
  {
    label: "Heating Systems",
    image: "https://images.unsplash.com/photo-1588619461335-b81119fee1b5?auto=format&fit=crop&w=1200&q=80"
  },
  {
    label: "Tool Bundles",
    image: "https://images.unsplash.com/photo-1654923203455-23b1e9dd97ec?auto=format&fit=crop&w=1200&q=80"
  },
  {
    label: "Service Packages",
    image: "https://images.unsplash.com/photo-1676210134188-4c05dd172f89?auto=format&fit=crop&w=1200&q=80"
  }
];

const HeroGrid = () => (
  <div className="grid grid-cols-2 gap-4 rounded-3xl md:grid-cols-3 md:gap-6">
    {gridImages.map((item, index) => (
      <div
        key={item.label}
        className={`group relative overflow-hidden rounded-3xl ${
          index === 0 ? "h-56 md:col-span-2 md:row-span-2 md:h-full" : "h-40 md:h-56"
        }`}
      >
        <Image
          src={item.image}
          alt={item.label}
          fill
          className="object-cover"
          sizes="(min-width: 768px) 33vw, 50vw"
        />
        <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/30" />
        <div className="absolute bottom-3 left-3 font-semibold text-white drop-shadow">
          {item.label}
        </div>
      </div>
    ))}
  </div>
);

const HeroCarousel = () => {
  const slides = useMemo(
    () => [
      {
        id: 1,
        title: "Express Boiler Replacement Kits",
        img: "https://images.unsplash.com/photo-1588619461335-b81119fee1b5?auto=format&fit=crop&w=1600&q=80"
      },
      {
        id: 2,
        title: "Designer Sinks & Tapware",
        img: "https://images.unsplash.com/photo-1540574163026-643ea20ade25?auto=format&fit=crop&w=1600&q=80"
      },
      {
        id: 3,
        title: "Service-Van Tool Bundles",
        img: "https://images.unsplash.com/photo-1654923203455-23b1e9dd97ec?auto=format&fit=crop&w=1600&q=80"
      }
    ],
    []
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((prev) => (prev + 1) % slides.length),
      4500
    );
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="relative h-[42vh] overflow-hidden rounded-3xl md:h-[56vh]">
      <AnimatePresence mode="wait">
        <MotionImage
          key={slides[index].id}
          src={slides[index].img}
          alt={slides[index].title}
          fill
          className="object-cover"
          sizes="100vw"
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.5 }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      <div className="absolute bottom-6 left-6 text-white md:left-10">
        <div className="text-2xl font-bold md:text-4xl">{slides[index].title}</div>
      </div>
      <div className="absolute bottom-4 right-4 flex gap-2">
        {slides.map((slide, idx) => (
          <button
            key={slide.id}
            onClick={() => setIndex(idx)}
            className={`h-2 w-6 rounded-full ${idx === index ? "bg-white" : "bg-white/50"}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

const HorizontalSlider = <T,>({
  items,
  renderItem,
  itemWidth = 260
}: {
  items: T[];
  renderItem: (item: T) => ReactNode;
  itemWidth?: number;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const scrollBy = (delta: number) => {
    ref.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <button
        className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-background/80 p-2 shadow backdrop-blur md:flex"
        onClick={() => scrollBy(-itemWidth * 2)}
        aria-label="scroll left"
      >
        <ChevronLeft />
      </button>
      <div
        ref={ref}
        className="no-scrollbar flex gap-4 overflow-x-auto px-2 py-2 scroll-smooth md:px-8"
      >
        {items.map((item) => renderItem(item))}
      </div>
      <button
        className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-background/80 p-2 shadow backdrop-blur md:flex"
        onClick={() => scrollBy(itemWidth * 2)}
        aria-label="scroll right"
      >
        <ChevronRight />
      </button>
    </div>
  );
};

const ProductCard = ({ product }: { product: Product }) => (
  <Card className="w-[240px] overflow-hidden rounded-2xl shadow-sm transition hover:shadow-md md:w-[260px]">
    <div className="relative">
      <Image
        src={product.image}
        alt={product.name}
        width={640}
        height={480}
        className="h-40 w-full object-cover md:h-48"
        sizes="(min-width: 768px) 260px, 240px"
      />
      {product.compareAt && (
        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground shadow">
          <Percent size={14} /> Sale
        </div>
      )}
    </div>
    <CardContent className="p-3">
      <div className="min-h-[2.5rem] text-sm font-medium line-clamp-2">{product.name}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className="text-base font-semibold">€{product.price}</div>
        {product.compareAt && (
          <div className="text-sm text-muted-foreground line-through">€{product.compareAt}</div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1 text-amber-500">
        {Array.from({ length: 5 }).map((_, starIdx) => (
          <Star
            key={starIdx}
            size={14}
            className={starIdx < Math.round(product.rating) ? "fill-current" : ""}
          />
        ))}
      </div>
      <div className="mt-3">
        <Button className="w-full rounded-xl" size="sm">
          Add to cart
        </Button>
      </div>
    </CardContent>
  </Card>
);

const BlogCard = ({ post }: { post: Post }) => (
  <Card className="w-[300px] overflow-hidden rounded-2xl md:w-[360px]">
    <Image
      src={post.image}
      alt={post.title}
      width={880}
      height={500}
      className="h-40 w-full object-cover md:h-48"
      sizes="(min-width: 768px) 360px, 300px"
    />
    <CardHeader className="p-4">
      <CardTitle className="text-base leading-tight md:text-lg line-clamp-2">{post.title}</CardTitle>
    </CardHeader>
    <CardContent className="px-4 pb-4 pt-0 text-sm text-muted-foreground line-clamp-3">
      {post.excerpt}
    </CardContent>
  </Card>
);

const Footer = () => (
  <footer className="mt-12 border-t">
    <div className="mx-auto grid max-w-screen-xl grid-cols-2 gap-6 px-4 py-10 text-sm md:grid-cols-4 md:px-6">
      <div>
        <div className="mb-2 font-semibold">VINC Trade Supply</div>
        <ul className="space-y-1 text-muted-foreground">
          <li>About</li>
          <li>Careers</li>
          <li>Partners</li>
        </ul>
      </div>
      <div>
        <div className="mb-2 font-semibold">Help</div>
        <ul className="space-y-1 text-muted-foreground">
          <li>Shipping</li>
          <li>Returns</li>
          <li>Support</li>
        </ul>
      </div>
      <div>
        <div className="mb-2 font-semibold">Legal</div>
        <ul className="space-y-1 text-muted-foreground">
          <li>Privacy</li>
          <li>Terms</li>
          <li>Cookies</li>
        </ul>
      </div>
      <div>
        <div className="mb-2 font-semibold">Newsletter</div>
        <div className="flex gap-2">
          <Input placeholder="you@example.com" className="rounded-xl" />
          <Button className="rounded-xl">Join</Button>
        </div>
      </div>
    </div>
    <div className="border-t py-4 text-center text-xs text-muted-foreground">
      © {new Date().getFullYear()} VINC Storefront
    </div>
  </footer>
);

type HeroVariant = "Banner" | "Split" | "Grid" | "Carousel";
type ToggleKeys = "product_slider" | "category_preview" | "blog_preview" | "brands_row";

const ControlPanel = ({
  hero,
  setHero,
  toggles,
  setToggles
}: {
  hero: HeroVariant;
  setHero: (hero: HeroVariant) => void;
  toggles: Record<ToggleKeys, boolean>;
  setToggles: React.Dispatch<React.SetStateAction<Record<ToggleKeys, boolean>>>;
}) => (
  <div className="fixed bottom-4 right-4 z-50 w-[260px] rounded-2xl border bg-background/90 p-3 shadow-xl backdrop-blur">
    <div className="mb-2 text-sm font-semibold">Page Builder • Preview</div>
    <div className="space-y-2 text-sm">
      <div>
        <div className="mb-1 text-xs text-muted-foreground">Hero variant</div>
        <div className="grid grid-cols-2 gap-2">
          {(["Banner", "Split", "Grid", "Carousel"] as HeroVariant[]).map((variant) => (
            <Button
              key={variant}
              size="sm"
              variant={hero === variant ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setHero(variant)}
            >
              {variant}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        {(Object.keys(toggles) as ToggleKeys[]).map((key) => (
          <label key={key} className="flex items-center justify-between capitalize">
            {key.replaceAll("_", " ")}
            <input
              type="checkbox"
              checked={toggles[key]}
              onChange={(event) =>
                setToggles((current) => ({ ...current, [key]: event.target.checked }))
              }
            />
          </label>
        ))}
      </div>
    </div>
  </div>
);

export default function StorefrontPage() {
  const { dark, setDark } = useDarkMode();
  const [hero, setHero] = useState<HeroVariant>("Banner");
  const [toggles, setToggles] = useState<Record<ToggleKeys, boolean>>({
    product_slider: true,
    category_preview: true,
    blog_preview: true,
    brands_row: true
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header dark={dark} toggleDark={() => setDark((value) => !value)} />

      <main className="mx-auto max-w-screen-xl px-4 pt-4 md:px-6 md:pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={hero}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {hero === "Banner" && <HeroBanner />}
            {hero === "Split" && <HeroSplit />}
            {hero === "Grid" && <HeroGrid />}
            {hero === "Carousel" && <HeroCarousel />}
          </motion.div>
        </AnimatePresence>
      </main>

      {toggles.product_slider && (
        <Section title="Best Sellers" className="mt-8">
          <HorizontalSlider
            items={products.slice(0, 5)}
            renderItem={(product) => <ProductCard key={product.id} product={product} />}
          />
        </Section>
      )}

      {toggles.category_preview && (
        <Section title="Shop by Category" className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {categories.slice(0, 12).map((category) => (
              <Card
                key={category.id}
                className="overflow-hidden rounded-2xl transition hover:shadow-md"
              >
                <Image
                  src={category.image}
                  alt={category.name}
                  width={320}
                  height={200}
                  className="h-24 w-full object-cover"
                  sizes="(min-width: 768px) 180px, 50vw"
                />
                <CardContent className="p-2 text-center text-sm font-medium">
                  {category.name}
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {toggles.blog_preview && (
        <Section title="Stories & Guides" className="mt-6">
          <HorizontalSlider
            items={posts}
            itemWidth={340}
            renderItem={(post) => <BlogCard key={post.id} post={post} />}
          />
        </Section>
      )}

      {toggles.brands_row && (
        <Section className="mt-8">
          <div className="grid grid-cols-2 items-center gap-4 opacity-80 sm:grid-cols-4 md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex h-10 items-center justify-center rounded-xl bg-muted text-xs"
              >
                Brand {index + 1}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Footer />

      <ControlPanel hero={hero} setHero={setHero} toggles={toggles} setToggles={setToggles} />
    </div>
  );
}
