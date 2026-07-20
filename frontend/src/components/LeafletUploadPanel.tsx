import { FormEvent, useRef, useState } from "react";

import StatusBadge from "./StatusBadge";
import { useI18n } from "../i18n";
import type {
  LeafletExtractionStatus,
  LeafletUpload
} from "../types/medicine";

interface LeafletUploadPanelProps {
  uploads: LeafletUpload[];
  activeExtractionId: number | null;
  activeReviewId: number | null;
  isLoading: boolean;
  isUploading: boolean;
  onExtract: (upload: LeafletUpload) => Promise<void>;
  onReview: (upload: LeafletUpload) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
}

const statusTones: Record<
  LeafletExtractionStatus,
  "neutral" | "good" | "warning" | "danger"
> = {
  uploaded: "neutral",
  queued: "warning",
  extracting: "warning",
  needs_review: "warning",
  failed: "danger",
  approved: "good"
};

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function LeafletUploadPanel({
  uploads,
  activeExtractionId,
  activeReviewId,
  isLoading,
  isUploading,
  onExtract,
  onReview,
  onUpload
}: LeafletUploadPanelProps) {
  const { locale, t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!selectedFile) {
      setFormError(t("Choose a leaflet file first."));
      return;
    }

    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch {
      return;
    }
  }

  return (
    <div className="leaflet-panel">
      <div className="section-heading">
        <h3>{t("Leaflets")}</h3>
        {isLoading && <span className="muted-label">{t("Loading")}</span>}
      </div>

      <div className="leaflet-safety">
        <strong>{t("Review before saving guidance.")}</strong>
        <span>
          {t(
            "Uploaded leaflet content stays separate from dose plans. In the default local demo, mock extraction avoids paid AI calls."
          )}
        </span>
      </div>

      <form className="leaflet-upload-form" onSubmit={handleSubmit}>
        <label>
          <span>{t("Upload leaflet")}</span>
          <input
            accept=".gif,.jpeg,.jpg,.pdf,.png,.txt,.webp,image/*,application/pdf,text/plain"
            ref={inputRef}
            type="file"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setFormError("");
            }}
          />
        </label>
        <button
          className="primary-button"
          type="submit"
          disabled={isUploading}
        >
          {isUploading ? t("Uploading") : t("Upload")}
        </button>
      </form>

      {formError && <p className="form-error">{formError}</p>}

      {uploads.length === 0 ? (
        <div className="empty-state compact-empty">
          <h3>{t("No leaflet uploaded")}</h3>
          <p>{t("Uploaded leaflets will appear here.")}</p>
        </div>
      ) : (
        <div className="leaflet-list">
          {uploads.map((upload) => (
            <article className="leaflet-row" key={upload.id}>
              <div>
                <strong>{upload.original_filename}</strong>
                <span>
                  {formatBytes(upload.size_bytes)} - {upload.content_type} -{" "}
                  {formatDateTime(upload.created_at, locale)}
                </span>
              </div>
              <div className="leaflet-row-actions">
                <StatusBadge tone={statusTones[upload.status]}>
                  {t(upload.status)}
                </StatusBadge>
                {(upload.status === "uploaded" || upload.status === "failed") && (
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    disabled={activeExtractionId !== null}
                    onClick={() => void onExtract(upload)}
                  >
                    {activeExtractionId === upload.id
                      ? t("Extracting")
                      : upload.status === "failed"
                        ? t("Retry")
                        : t("Extract")}
                  </button>
                )}
                {upload.status === "needs_review" && (
                  <button
                    className="primary-button compact-button"
                    type="button"
                    disabled={activeReviewId !== null}
                    onClick={() => void onReview(upload)}
                  >
                    {activeReviewId === upload.id ? t("Opening") : t("Review")}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default LeafletUploadPanel;
