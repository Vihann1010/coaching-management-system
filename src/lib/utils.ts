import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeAssistantText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*\n?/gi, "").replace(/```/g, ""))
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/^\s*(?:[-*_]\s*){3,}$/gm, "")
    .replace(/\|/g, " ")
    .replace(/(?:\*\*|__|\*|_)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatCurrency(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

/** Basic Indian phone number check: 10 digits, optionally prefixed with +91 / 0. */
export function isValidIndianPhone(phone: string) {
  const cleaned = phone.replace(/[\s-]/g, "");
  return /^(?:\+91|0)?[6-9]\d{9}$/.test(cleaned);
}

export function telHref(phone: string | null | undefined) {
  if (!phone) return undefined;
  const cleaned = phone.replace(/[\s-]/g, "");
  return `tel:${cleaned.startsWith("+") ? cleaned : cleaned.startsWith("0") ? `+91${cleaned.slice(1)}` : `+91${cleaned}`}`;
}

/**
 * Normalizes a Supabase embedded to-one relation. Without generated
 * Database types (see README -> "Generating full Supabase types"),
 * supabase-js can't always infer that e.g. `batch:batches(name)` is a
 * single row rather than a to-many join, and returns `T | T[] | null`
 * depending on the query. This makes call sites correct either way
 * without scattering `as any` through the app.
 */
export function unwrapEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
