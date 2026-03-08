import { useState, useRef, useEffect, useCallback } from "react";
import { geocode } from "@/api/client";
import type { GeocodeResponse } from "@/types";
import { usePosterStore } from "@/stores/posterStore";

export default function CitySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResponse[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const setCity = usePosterStore((s) => s.setCity);
  const city = usePosterStore((s) => s.city);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await geocode(q);
      setResults(data);
      setIsOpen(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (result: GeocodeResponse) => {
    setCity({
      name: result.display_name,
      lat: result.lat,
      lon: result.lon,
    });
    setQuery(result.display_name);
    setIsOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Extract short city + country from display_name
  const formatResult = (name: string) => {
    const parts = name.split(",").map((s) => s.trim());
    if (parts.length >= 2) {
      return { city: parts[0], country: parts[parts.length - 1] };
    }
    return { city: parts[0], country: "" };
  };

  return (
    <div ref={wrapperRef} className="relative w-[280px]">
      {/* Search input */}
      <div className="relative">
        {/* Magnifying glass icon */}
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>

        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={city ? city.name.split(",")[0] : "Search city..."}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-xs text-white/90 placeholder-white/25 outline-none backdrop-blur-md transition-colors focus:border-white/20 focus:bg-white/8"
        />

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/60" />
          </div>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {isOpen && (
        <ul className="absolute top-full z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-white/10 bg-black/70 py-1 shadow-2xl backdrop-blur-xl animate-fade-in">
          {results.map((r, i) => {
            const formatted = formatResult(r.display_name);
            return (
              <li
                key={`${r.lat}-${r.lon}-${i}`}
                onClick={() => handleSelect(r)}
                className="group flex cursor-pointer items-baseline justify-between border-b border-white/5 px-3.5 py-2 last:border-0 transition-colors hover:bg-white/8"
              >
                <span className="text-xs text-white/80 group-hover:text-white">
                  {formatted.city}
                </span>
                {formatted.country && (
                  <span className="ml-2 text-[10px] text-white/25 group-hover:text-white/40">
                    {formatted.country}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
