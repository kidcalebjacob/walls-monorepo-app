export type TimezoneGroup =
  | "Americas"
  | "Europe"
  | "Asia"
  | "Pacific"
  | "Africa";

export interface TimezoneOption {
  id: string;
  label: string;
  group: TimezoneGroup;
}

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { id: "America/New_York", label: "Eastern Time (US & Canada)", group: "Americas" },
  { id: "America/Chicago", label: "Central Time (US & Canada)", group: "Americas" },
  { id: "America/Denver", label: "Mountain Time (US & Canada)", group: "Americas" },
  { id: "America/Los_Angeles", label: "Pacific Time (US & Canada)", group: "Americas" },
  { id: "America/Toronto", label: "Toronto", group: "Americas" },
  { id: "America/Vancouver", label: "Vancouver", group: "Americas" },
  { id: "America/Mexico_City", label: "Mexico City", group: "Americas" },
  { id: "America/Sao_Paulo", label: "São Paulo", group: "Americas" },
  { id: "Europe/London", label: "London", group: "Europe" },
  { id: "Europe/Paris", label: "Paris", group: "Europe" },
  { id: "Europe/Berlin", label: "Berlin", group: "Europe" },
  { id: "Europe/Madrid", label: "Madrid", group: "Europe" },
  { id: "Europe/Rome", label: "Rome", group: "Europe" },
  { id: "Europe/Amsterdam", label: "Amsterdam", group: "Europe" },
  { id: "Europe/Dublin", label: "Dublin", group: "Europe" },
  { id: "Asia/Tokyo", label: "Tokyo", group: "Asia" },
  { id: "Asia/Shanghai", label: "Shanghai", group: "Asia" },
  { id: "Asia/Hong_Kong", label: "Hong Kong", group: "Asia" },
  { id: "Asia/Singapore", label: "Singapore", group: "Asia" },
  { id: "Asia/Dubai", label: "Dubai", group: "Asia" },
  { id: "Asia/Kolkata", label: "India Standard Time", group: "Asia" },
  { id: "Australia/Sydney", label: "Sydney", group: "Pacific" },
  { id: "Australia/Melbourne", label: "Melbourne", group: "Pacific" },
  { id: "Pacific/Auckland", label: "Auckland", group: "Pacific" },
  { id: "Africa/Johannesburg", label: "Johannesburg", group: "Africa" },
  { id: "Africa/Lagos", label: "Lagos", group: "Africa" },
  { id: "UTC", label: "UTC", group: "Europe" },
];
