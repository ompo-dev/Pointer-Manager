import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatMinutes(value?: number | null) {
  if (!value || value <= 0) {
    return "0h 00m";
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}
