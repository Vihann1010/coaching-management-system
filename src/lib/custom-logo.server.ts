import "server-only";
import fs from "fs";
import path from "path";

/**
 * Looks for a custom logo the coaching has dropped into /public (see
 * README -> "Adding your real logo"). Uses Node's fs, so this must only
 * ever be called from a Server Component — never imported into a
 * "use client" file.
 */
export function getCustomLogoPath(): string | null {
  for (const file of ["logo.svg", "logo.png"]) {
    if (fs.existsSync(path.join(process.cwd(), "public", file))) {
      return `/${file}`;
    }
  }
  return null;
}
