"use client";

import { useState } from "react";
import { Search, Lock, Sparkles, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type QuickSearchSectionProps = {
  onSearch: (query: string, filter?: string) => void;
};

const filters = [
  { id: "not_enhanced", label: "Not Enhanced", icon: Lock },
  { id: "enhanced", label: "Enhanced", icon: Sparkles },
  { id: "missing_data", label: "Missing Data", icon: AlertCircle },
];

export function QuickSearchSection({ onSearch }: QuickSearchSectionProps) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const handleSearch = () => {
    onSearch(query, activeFilter || undefined);
  };

  const handleFilterClick = (filterId: string) => {
    const newFilter = activeFilter === filterId ? null : filterId;
    setActiveFilter(newFilter);
    onSearch(query, newFilter || undefined);
  };

  return (
    <div className="rounded-lg bg-card p-3.5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <Search className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Quick Search</h2>
      </div>

      <div className="space-y-2">
        <div className="flex gap-1.5">
          <Input
            type="text"
            placeholder="Search by SKU, title, category..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 h-8 text-xs"
          />
          <Button onClick={handleSearch} className="h-8 px-3 text-xs">
            <Search className="mr-1.5 h-3.5 w-3.5" />
            Search
          </Button>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Quick filters:</p>
          <div className="flex flex-wrap gap-1.5">
            {filters.map((filter) => {
              const Icon = filter.icon;
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => handleFilterClick(filter.id)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
