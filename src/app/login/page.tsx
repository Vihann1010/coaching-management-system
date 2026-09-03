import { LogoMark } from "@/components/shared/logo";
import { getCustomLogoPath } from "@/lib/custom-logo.server";
import { LoginForm } from "./login-form";
import { getAppSettings } from "@/lib/settings";
import { AlertTriangle } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const settings = await getAppSettings();
  const params = await searchParams;
  const logoSrc = getCustomLogoPath();

  const errorMessages: Record<string, string> = {
    profile_missing: "Your account isn't fully set up yet. Contact your admin.",
    account_disabled: "This account has been disabled. Contact your admin.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,var(--brand-50),var(--background)_60%)] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <LogoMark size={52} src={logoSrc} />
          <div className="text-center">
            <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--brand-900)]">
              {settings.coaching_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Coaching Management System</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card shadow-sm p-6">
          {params.error && errorMessages[params.error] && (
            <div className="flex items-start gap-2 rounded-md bg-[var(--warning-bg)] text-[var(--warning)] text-sm px-3 py-2.5 mb-4">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMessages[params.error]}</span>
            </div>
          )}
          <LoginForm next={params.next && params.next.startsWith("/") ? params.next : "/dashboard"} />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Don&apos;t have an account? Ask your admin to add you from Settings → Users.
        </p>
      </div>
    </div>
  );
}
