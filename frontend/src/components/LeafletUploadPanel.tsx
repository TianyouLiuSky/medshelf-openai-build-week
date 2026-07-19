import { FormEvent, useRef, useState } from "react";

import StatusBadge from "./StatusBadge";
import type {
  LeafletExtractionStatus,
  LeafletUpload
} from "../types/medicine";

interface LeafletUploadPanelProps {
  uploads: LeafletUpload[];
  isLoading: boolean;
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
}

const statusLabels: Record<LeafletExtractionStatus, string> = {
  uploaded: "Uploaded",
  queued: "Queued",
  extracting: "Extracting",
  needs_review: "Needs review",
  failed: "Failed",
  approved: "Approved"
};

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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function LeafletUploadPanel({
  uploads,
  isLoading,
  isUploading,
  onUpload
}: LeafletUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!selectedFile) {
      setFormError("Choose a leaflet file first.");
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
        <h3>Leaflets</h3>
        {isLoading && <span className="muted-label">Loading</span>}
      </div>

      <div className="leaflet-safety">
        <strong>Review before saving guidance.</strong>
        <span>Uploaded leaflet content stays separate from dose plans.</span>
      </div>

      <form className="leaflet-upload-form" onSubmit={handleSubmit}>
        <label>
          <span>Upload leaflet</span>
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
          {isUploading ? "Uploading" : "Upload"}
        </button>
      </form>

      {formError && <p className="form-error">{formError}</p>}

      {uploads.length === 0 ? (
        <div className="empty-state compact-empty">
          <h3>No leaflet uploaded</h3>
          <p>Uploaded leaflets will appear here.</p>
        </div>
      ) : (
        <div className="leaflet-list">
          {uploads.map((upload) => (
            <article className="leaflet-row" key={upload.id}>
              <div>
                <strong>{upload.original_filename}</strong>
                <span>
                  {formatBytes(upload.size_bytes)} - {upload.content_type} -{" "}
                  {formatDateTime(upload.created_at)}
                </span>
              </div>
              <StatusBadge tone={statusTones[upload.status]}>
                {statusLabels[upload.status]}
              </StatusBadge>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default LeafletUploadPanel;
