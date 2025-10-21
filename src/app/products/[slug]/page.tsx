import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailView, type ProductDetailData } from "@/components/product/ProductDetailView";
import { getMockProducts } from "@/lib/data/mockCatalog";

const PRODUCTS: Record<string, ProductDetailData> = {
  "hydronic-control-pack": {
    slug: "hydronic-control-pack",
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Products", href: "/#products" },
      { label: "Hydronic Control Pack" }
    ],
    name: "Hydronic Control Pack Pro",
    brand: "VIC Hydronics",
    sku: "HC-4821",
    category: "Hydronic Heating",
    tagline:
      "Commercial-grade control assembly with pre-plumbed mixing valves, smart pump management, and remote-ready monitoring.",
    stockMessage: "In stock — ships within 24 hours from our Milan warehouse.",
    price: {
      amount: 1649,
      compareAt: 1899,
      currency: "EUR"
    },
    rating: {
      average: 4.7,
      count: 38
    },
    badges: [
      { variant: "success", text: "Selling fast! 18 installers have this kit in their cart." },
      { variant: "warning", text: "12 pros are reviewing this control pack right now." },
      { variant: "info", text: "Bundle with expansion vessels to unlock tiered project pricing." }
    ],
    shippingEstimate: "Free express delivery across the EU for orders placed before 15:00 CET.",
    paymentNotice: "Free EU shipping • Leasing and staged payments available for trade partners.",
    trustBadges: [
      { icon: "shield", title: "30-day returns", description: "Trade account exchanges without restocking fees." },
      { icon: "badge", title: "Extended warranty", description: "3-year coverage with on-site replacement service." },
      { icon: "support", title: "Installation support", description: "Accredited crews and remote commissioning help." }
    ],
    bulkRequestCopy: "Need 5+ assemblies?",
    bulkRequestCta: "Request project pricing",
    bulkRequestHref: "#",
    guaranteeCopy: "VINC trade partners enjoy priority hotline access and on-site warranty replacements within 48 hours.",
    configurationSections: [
      {
        id: "system-type",
        title: "System type",
        info: "Choose the assembly that fits your primary/secondary hydronic circuit.",
        options: [
          {
            label: "Standard configuration",
            description: "Balanced for single-plant rooms and standard radiant loops.",
            priceDelta: "Included",
            badge: "popular"
          },
          {
            label: "With isolation & mixing valve",
            description: "Adds isolation tees and bypass mixing for multi-zone layouts.",
            priceDelta: "+€280 upgrade"
          }
        ]
      },
      {
        id: "pump-size",
        title: "Pump group size",
        info: "Match flow rate and head pressure to your loop sizing.",
        options: [
          {
            label: "Standard 43 GPM",
            description: "Optimised for medium radiant or fan-coil applications.",
            priceDelta: "Included"
          },
          {
            label: "High flow 58 GPM",
            description: "Supports large manifolds and higher lift commercial circuits.",
            priceDelta: "+€150 upgrade"
          }
        ]
      },
      {
        id: "control-suite",
        title: "Control interface",
        info: "Select between manual balancing or connected monitoring.",
        options: [
          {
            label: "Manual control",
            description: "Analog gauges with mechanical balancing valves.",
            priceDelta: "Included"
          },
          {
            label: "Smart WiFi control",
            description: "App dashboard with live delta‑T analytics and alerts.",
            priceDelta: "+€195 upgrade"
          }
        ]
      }
    ],
    colorOptions: [
      { name: "Matte Graphite", swatch: "#1f2933" },
      { name: "Brushed Steel", swatch: "#a7b0bb" }
    ],
    sizeOptions: ["Standard kit", "With isolation valves", "With isolation & mixing valve"],
    images: [
      {
        src: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
        alt: "Hydronic control pack mounted in a mechanical room"
      },
      {
        src: "https://images.unsplash.com/photo-1523861751938-12104d043071?auto=format&fit=crop&w=1200&q=80",
        alt: "Close up of precision valves and gauges on a hydronic manifold"
      },
      {
        src: "https://images.unsplash.com/photo-1579844078642-ec22a7d52f98?auto=format&fit=crop&w=1200&q=80",
        alt: "Technician configuring hydronic pump controls"
      },
      {
        src: "https://images.unsplash.com/photo-1581092515367-265199cccdb1?auto=format&fit=crop&w=1200&q=80",
        alt: "Pre-assembled hydronic mixing module on workbench"
      },
      {
        src: "https://images.unsplash.com/photo-1562259920-47afc3030ba4?auto=format&fit=crop&w=1200&q=80",
        alt: "Hydronic installation layout illustration"
      }
    ],
    specification: [
      { label: "Output capacity", value: "Up to 18 kW" },
      { label: "Pump group", value: "Grundfos UPM3 Auto PN10" },
      { label: "Mixing range", value: "25°C – 70°C adjustable" },
      { label: "Control interface", value: "Modbus RTU / 0-10V" },
      { label: "Power supply", value: "230V AC, 50Hz" },
      { label: "Manifold size", value: "1\" BSP primary, 3/4\" secondary" },
      { label: "Max pressure", value: "10 bar" },
      { label: "Dimensions", value: "580 × 450 × 320 mm" },
      { label: "Weight", value: "18.5 kg" },
      { label: "Warranty", value: "5 years, on-site swap" }
    ],
    whatsIncluded: [
      { item: "Hydronic Control Pack (assembled & pressure tested)", quantity: "1×" },
      { item: "Grundfos circulation pump (UPM3 Auto)", quantity: "1×" },
      { item: "Pressure gauges with isolation manifold", quantity: "2×" },
      { item: "Lockable thermostatic mixing valve", quantity: "1×" },
      { item: "Thermal expansion tank with bracket", quantity: "1×" },
      { item: "Air separator with automatic vent", quantity: "1×" },
      { item: "Stainless braided connection hoses", quantity: "4×" },
      { item: "Mounting hardware & template kit", quantity: "1×" },
      { item: "Installation manual & wiring diagrams", quantity: "1×" }
    ],
    documents: [
      { icon: "file", title: "Installation guide", subtitle: "PDF • 2.4 MB" },
      { icon: "wrench", title: "Wiring diagram", subtitle: "PDF • 1.1 MB" },
      { icon: "ruler", title: "CAD drawings", subtitle: "DWG • 890 KB" },
      { icon: "video", title: "Commissioning tutorial", subtitle: "23 minute walkthrough" },
      { icon: "clipboard", title: "Spec sheet", subtitle: "PDF • 580 KB" },
      { icon: "badge", title: "Compatibility checker", subtitle: "Interactive planning tool" }
    ],
    serviceHighlights: [
      {
        icon: "truck",
        title: "Same-day dispatch",
        description: "Order by 15:00 CET to ship from the Milan warehouse the same day."
      },
      {
        icon: "support",
        title: "Installer hotline",
        description: "Priority support from hydronics specialists across the EU."
      },
      {
        icon: "shield",
        title: "Extended warranty",
        description: "5-year coverage with on-site replacement under 48 hours."
      },
      {
        icon: "refresh",
        title: "30-day exchange",
        description: "Swap unused kits if project specs change—no restocking fees."
      }
    ],
    assuranceBlocks: [
      {
        icon: "shield",
        title: "Certified for PED",
        description: "Pressure Equipment Directive compliant and factory tested."
      },
      {
        icon: "badge",
        title: "Project documentation",
        description: "Full schematics, wiring diagrams, and commissioning sheets."
      },
      {
        icon: "package",
        title: "Site-ready packaging",
        description: "Delivered on protective skid with lift points for easy handling."
      },
      {
        icon: "support",
        title: "Commissioning support",
        description: "Remote start-up guidance and balancing assistance included."
      }
    ],
    tabs: {
      description: {
        paragraphs: [
          "Built for installers who need reliability on commercial hydronic projects, the Hydronic Control Pack Pro arrives fully assembled, pressure tested, and ready to mount. Each kit includes smart temperature mixing, a high-efficiency pump group, and integrated monitoring for effortless commissioning.",
          "Precision gauges, purge valves, and isolation points are laid out for quick access, keeping install times tight even in plant rooms with limited space. Pair it with our prefabricated manifolds or integrate into existing loops—either way you keep projects on schedule."
        ],
        features: [
          "Pre-plumbed copper assembly with insulation and mounting rails.",
          "Integrated delta-T monitoring with Modbus output for BMS integration.",
          "Grundfos UPM3 pump group with auto-adapt for balanced flow.",
          "Lockable thermostatic mixing valve to protect low-temperature circuits.",
          "Dual pressure relief and air separator for safe operation."
        ],
        materials: [
          "Premium dezincification-resistant brass bodies with EPDM seals.",
          "304 stainless steel manifolds with welded brackets.",
          "Closed-cell insulation jacket rated for 95°C continuous operation.",
          "Pre-wired terminal box with flame-retardant harness."
        ],
        applications: [
          "Residential radiant floor and fan-coil heating projects.",
          "Commercial hydronic systems with multi-zone distribution.",
          "Retrofit upgrades requiring pre-balanced pump assemblies.",
          "Snow-melt manifolds and ice prevention loops."
        ]
      },
      reviews: {
        average: 4.7,
        total: 38,
        highlights: ["Fast install", "Quiet operation", "Pro support"],
        testimonials: [
          {
            author: "Marco B.",
            role: "Hydronics contractor, Turin",
            rating: 5,
            comment:
              "Arrived palletised and ready. We mounted it, connected loops, and ran hot water inside half a day. Support helped sync with the BMS in minutes.",
            date: "Reviewed 12 days ago"
          },
          {
            author: "Elisa R.",
            role: "Project engineer, Vienna",
            rating: 4.5,
            comment:
              "Documentation is spot on and the pump group is whisper quiet. Saved us two site visits compared to building in-house.",
            date: "Reviewed 3 weeks ago"
          },
          {
            author: "Patrick L.",
            role: "Commercial plumber, Lyon",
            rating: 4.5,
            comment:
              "Isolation valve kit was worth it—had to reconfigure zones and it took minutes. Commissioning support also answered a late-evening call.",
            date: "Reviewed 1 month ago"
          },
          {
            author: "Sofia D.",
            role: "Mechanical contractor, Madrid",
            rating: 5,
            comment:
              "Locks in stable supply temperatures. Clients noticed the comfort difference straight away and the dashboard data is useful for FM teams.",
            date: "Reviewed 2 months ago"
          }
        ]
      },
      installation: {
        summary: [
          "Ships pre-plumbed on a mounting backplate—lift into place and anchor with the included hardware.",
          "Color-coded wiring harness and labelled terminals speed up electrical connections.",
          "Commissioning checklist and QR-linked 23 minute video walk installers through final balancing.",
          "On-site start-up and balancing service available anywhere in the EU within 72 hours."
        ]
      },
      warranty: {
        summary: [
          "30-day trade returns on unused assemblies with carrier pick-up arranged by VINC.",
          "3-year extended coverage with advance replacement shipments for mission-critical sites.",
          "Priority hotline staffed by hydronic specialists for diagnostics and integration support.",
          "Automatic warranty registration and maintenance reminders once the kit is activated."
        ]
      }
    }
  }
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return Object.keys(PRODUCTS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = PRODUCTS[slug];
  if (!product) {
    return {
      title: "Product not found"
    };
  }

  return {
    title: `${product.name} | VINC Trade Supply`,
    description: product.tagline
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = PRODUCTS[slug];
  if (!product) {
    notFound();
  }

  const peopleAlsoBought = getMockProducts("featured", 6);
  const recentlyViewed = getMockProducts("all", 6);

  return <ProductDetailView product={product} peopleAlsoBought={peopleAlsoBought} recentlyViewed={recentlyViewed} />;
}
