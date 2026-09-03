import Image from "next/image";

/**
 * Pure presentational logo mark — safe to import from Client Components
 * (e.g. the sidebar). The actual "does a custom logo file exist" check
 * runs server-side only, in lib/custom-logo.server.ts, and its result is
 * threaded down as the `src` prop from a Server Component (see the
 * dashboard layout and the login page).
 */
export function LogoMark({ size = 32, src }: { size?: number; src?: string | null }) {
  if (src) {
    return <Image src={src} alt="" width={size} height={size} className="rounded-md" unoptimized />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#00923F" />
      <path d="M17 40 L17 30 L25 30 L25 40" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M27 40 L27 22 L35 22 L35 40" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M37 40 L37 16 L45 16 L45 40" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 44 H49" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function LogoWithName({ name, size = 32, src }: { name: string; size?: number; src?: string | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} src={src} />
      <span className="font-[family-name:var(--font-display)] font-bold text-lg leading-tight text-[var(--brand-900)]">
        {name}
      </span>
    </div>
  );
}
