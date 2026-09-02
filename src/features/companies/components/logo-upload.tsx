"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CompanyLogo } from "@/features/jobs/components/company-logo";
import { FormError } from "@/features/auth/components/auth-ui";
import { createClient } from "@/lib/supabase/client";
import { removeCompanyLogo, setCompanyLogo } from "@/features/companies/actions";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export function LogoUpload({
  uid,
  logoPath,
  companyName,
  logoColor,
  disabled,
}: {
  uid: string;
  logoPath: string | null;
  companyName: string;
  logoColor: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<null | "upload" | "remove">(null);
  const [error, setError] = React.useState<string | null>(null);

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    if (!EXT_BY_TYPE[file.type]) {
      setError("Upload a PNG, JPG, WebP or SVG.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError("That image is over 2 MB.");
      return;
    }

    setBusy("upload");
    const path = `${uid}/${crypto.randomUUID()}.${EXT_BY_TYPE[file.type]}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) {
      setBusy(null);
      setError(uploadError.message);
      return;
    }

    const result = await setCompanyLogo(path);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  const onRemove = async () => {
    setError(null);
    setBusy("remove");
    const result = await removeCompanyLogo();
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold">Logo</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {disabled
          ? "Create your company below first, then add a logo."
          : "Square works best. PNG, JPG, WebP or SVG, up to 2 MB."}
      </p>

      {error && (
        <div className="mt-3">
          <FormError message={error} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <CompanyLogo
          company={companyName}
          color={logoColor}
          logoPath={logoPath}
          size="lg"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={onPick}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy !== null}
          onClick={() => inputRef.current?.click()}
        >
          {busy === "upload" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {logoPath ? "Replace" : "Upload logo"}
        </Button>
        {logoPath && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null}
            onClick={onRemove}
          >
            {busy === "remove" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Remove
          </Button>
        )}
      </div>
    </section>
  );
}
