"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/components/auth-ui";
import { createClient } from "@/lib/supabase/client";
import { removeCv, setCv } from "@/features/profiles/actions";
import { CV_ACCEPT, CV_MAX_BYTES } from "@/features/profiles/schema";

const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export function CvUpload({
  uid,
  currentFilename,
  hasCv,
}: {
  uid: string;
  currentFilename: string | null;
  hasCv: boolean;
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
    if (!CV_ACCEPT.includes(file.type)) {
      setError("Upload a PDF or Word document.");
      return;
    }
    if (file.size > CV_MAX_BYTES) {
      setError("That file is over 5 MB.");
      return;
    }

    setBusy("upload");
    const ext = EXT_BY_TYPE[file.type] ?? "pdf";
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("cvs")
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      setBusy(null);
      setError(uploadError.message);
      return;
    }

    const result = await setCv({ path, filename: file.name });
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
    const result = await removeCv();
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold">CV / résumé</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        PDF or Word, up to 5 MB. Attached automatically when you apply.
      </p>

      {error && (
        <div className="mt-3">
          <FormError message={error} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {hasCv ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <FileText className="size-4 text-primary" />
            {currentFilename ?? "Your CV"}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">No CV uploaded yet.</span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={onPick}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null}
          onClick={() => inputRef.current?.click()}
        >
          {busy === "upload" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {hasCv ? "Replace" : "Upload CV"}
        </Button>

        {hasCv && (
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
