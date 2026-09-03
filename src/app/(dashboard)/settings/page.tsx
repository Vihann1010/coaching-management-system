import Link from "next/link";
import { Layers, UserCog, Download } from "lucide-react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { getAppSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SettingsForm } from "@/components/shared/settings-form";
import { LogoMark } from "@/components/shared/logo";
import { getCustomLogoPath } from "@/lib/custom-logo.server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "settings", "view"); // admin-only

  const settings = await getAppSettings();
  const logoSrc = getCustomLogoPath();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Coaching profile, branding and system-wide configuration." />

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Link href="/batches">
          <Card className="hover:border-[var(--brand-500)] transition-colors">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-[var(--brand-50)] text-[var(--brand-600)]"><Layers className="size-5" /></div>
              <div>
                <p className="font-medium">Batches</p>
                <p className="text-xs text-muted-foreground">Create and manage batches</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/users">
          <Card className="hover:border-[var(--brand-500)] transition-colors">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-[var(--brand-50)] text-[var(--brand-600)]"><UserCog className="size-5" /></div>
              <div>
                <p className="font-medium">Users &amp; permissions</p>
                <p className="text-xs text-muted-foreground">Add teachers, accountants, staff</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>
            Drop a logo file at <code className="text-xs bg-muted px-1 py-0.5 rounded">public/logo.svg</code> (or{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">public/logo.png</code>) in the project and redeploy, or
            paste a hosted image URL below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="rounded-md border border-border p-3"><LogoMark size={40} src={logoSrc} /></div>
          <p className="text-sm text-muted-foreground">Current logo, as it will appear in the sidebar and on the login page.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coaching profile</CardTitle>
          <CardDescription>Shown on the login screen, sidebar, and Excel report headers.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm settings={settings} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-6 flex items-center gap-1.5">
        <Download className="size-3.5" /> Excel exports are available throughout the app — look for the &quot;Export Excel&quot; button on Students, Fees, Attendance, Tests and Reports.
      </p>
    </div>
  );
}
