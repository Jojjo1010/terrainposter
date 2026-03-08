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

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        placeholder={city ? city.name : "Search city..."}
        className="w-64 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white placeholder-white/40 outline-none ring-1 ring-white/10 transition focus:ring-purple-500/50"
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
          ...
        </div>
      )}
      {isOpen && (
        <ul className="absolute top-full z-50 mt-1 max-h-60 w-80 overflow-y-auto rounded-lg border border-white/10 bg-gray-900 shadow-xl">
          {results.map((r, i) => (
            <li
              key={`${r.lat}-${r.lon}-${i}`}
              onClick={() => handleSelect(r)}
              className="cursor-pointer px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              {r.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
