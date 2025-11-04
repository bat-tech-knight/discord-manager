"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Common timezones grouped by region
const timezones = [
  // UTC
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  
  // Americas
  { value: "America/New_York", label: "Eastern Time (US & Canada)" },
  { value: "America/Chicago", label: "Central Time (US & Canada)" },
  { value: "America/Denver", label: "Mountain Time (US & Canada)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "America/Honolulu", label: "Hawaii" },
  { value: "America/Toronto", label: "Toronto" },
  { value: "America/Vancouver", label: "Vancouver" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "America/Buenos_Aires", label: "Buenos Aires" },
  { value: "America/Lima", label: "Lima" },
  
  // Europe
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Rome", label: "Rome" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/Amsterdam", label: "Amsterdam" },
  { value: "Europe/Brussels", label: "Brussels" },
  { value: "Europe/Vienna", label: "Vienna" },
  { value: "Europe/Stockholm", label: "Stockholm" },
  { value: "Europe/Warsaw", label: "Warsaw" },
  { value: "Europe/Prague", label: "Prague" },
  { value: "Europe/Budapest", label: "Budapest" },
  { value: "Europe/Athens", label: "Athens" },
  { value: "Europe/Istanbul", label: "Istanbul" },
  { value: "Europe/Moscow", label: "Moscow" },
  
  // Asia
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Karachi", label: "Karachi" },
  { value: "Asia/Kolkata", label: "Mumbai, New Delhi" },
  { value: "Asia/Dhaka", label: "Dhaka" },
  { value: "Asia/Bangkok", label: "Bangkok" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Asia/Shanghai", label: "Shanghai, Beijing" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Seoul", label: "Seoul" },
  { value: "Asia/Jakarta", label: "Jakarta" },
  { value: "Asia/Manila", label: "Manila" },
  { value: "Asia/Taipei", label: "Taipei" },
  
  // Australia & Pacific
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Australia/Melbourne", label: "Melbourne" },
  { value: "Australia/Brisbane", label: "Brisbane" },
  { value: "Australia/Perth", label: "Perth" },
  { value: "Pacific/Auckland", label: "Auckland" },
  
  // Africa
  { value: "Africa/Cairo", label: "Cairo" },
  { value: "Africa/Johannesburg", label: "Johannesburg" },
  { value: "Africa/Lagos", label: "Lagos" },
];

interface TimezoneSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TimezoneSelector({
  value,
  onChange,
  className,
}: TimezoneSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [filteredTimezones, setFilteredTimezones] = useState(timezones);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Filter timezones based on search query
    if (searchQuery.trim() === "") {
      setFilteredTimezones(timezones);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredTimezones(
        timezones.filter(
          (tz) =>
            tz.value.toLowerCase().includes(query) ||
            tz.label.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectedTimezone = timezones.find((tz) => tz.value === value);

  const handleSelect = (timezone: typeof timezones[0]) => {
    onChange(timezone.value);
    setSearchQuery("");
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    setIsOpen(true);
    
    // If the user types a valid timezone value directly, update it
    const matchingTimezone = timezones.find(
      (tz) => tz.value.toLowerCase() === newValue.toLowerCase()
    );
    if (matchingTimezone) {
      onChange(matchingTimezone.value);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputBlur = () => {
    // Delay to allow click on dropdown items
    setTimeout(() => setIsOpen(false), 200);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={isOpen ? searchQuery : selectedTimezone?.label || value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder="Search timezone..."
        className={cn("bg-card border-discord-hover text-white", className)}
      />
      {isOpen && filteredTimezones.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-discord-channel-sidebar border border-discord-hover rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredTimezones.map((timezone) => (
            <button
              key={timezone.value}
              type="button"
              onClick={() => handleSelect(timezone)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-card transition-colors",
                value === timezone.value && "bg-card"
              )}
            >
              <div className="text-white">{timezone.label}</div>
              <div className="text-xs text-discord-text-muted">{timezone.value}</div>
            </button>
          ))}
        </div>
      )}
      {isOpen && filteredTimezones.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-discord-channel-sidebar border border-discord-hover rounded-md shadow-lg p-3 text-sm text-discord-text-muted">
          No timezones found
        </div>
      )}
    </div>
  );
}

// Helper function to get user's timezone from OS
export function getUserTimezone(): string {
  try {
    if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  } catch (error) {
    console.warn("Failed to detect timezone:", error);
  }
  return "UTC";
}

