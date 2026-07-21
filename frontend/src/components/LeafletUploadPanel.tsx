import { FormEvent, useEffect, useRef, useState } from "react";

import StatusBadge from "./StatusBadge";
import { useI18n } from "../i18n";
import {
  canPreviewInBrowser,
  isBrowserOcrCandidate,
  isHeicLikeImage,
  runBrowserOcr,
  type OcrLanguageCode
} from "../services/browserOcr";
import {
  isLeafletImageUpload,
  isLeafletZipUpload
} from "../services/leafletArchive";
import { createLeafletImageBundle } from "../services/leafletBundle";
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
  onUploadWithOcrText: (file: File, sourceText: string) => Promise<void>;
  onView: (upload: LeafletUpload) => void;
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

function formatPageOcrStatus(
  pageNumber: number,
  pageCount: number,
  status: string,
  t: (key: string) => string
): string {
  if (pageCount <= 1) {
    return t(status);
  }

  return `${t("Page")} ${pageNumber} ${t("of")} ${pageCount}: ${t(status)}`;
}

function LeafletUploadPanel({
  uploads,
  activeExtractionId,
  activeReviewId,
  isLoading,
  isUploading,
  onExtract,
  onReview,
  onUpload,
  onUploadWithOcrText,
  onView
}: LeafletUploadPanelProps) {
  const { language, locale, t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrError, setOcrError] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguageCode>("eng");
  const [previewFiles, setPreviewFiles] = useState<Array<File | null>>([]);
  const [previewUrls, setPreviewUrls] = useState<Array<string | null>>([]);
  const [isOcrRunning, setIsOcrRunning] = useState(false);

  const selectedFile = selectedFiles[0] ?? null;
  const selectedFilesUseOcr =
    selectedFiles.length > 0 && selectedFiles.every(isBrowserOcrCandidate);
  const selectedHasMultipleFiles = selectedFiles.length > 1;
  const hasOcrText = ocrText.trim().length > 0;

  useEffect(() => {
    setOcrLanguage(language === "zh" ? "chi_sim" : "eng");
  }, [language]);

  useEffect(() => {
    if (previewFiles.length === 0) {
      setPreviewUrls([]);
      return;
    }

    const urls = previewFiles.map((file) =>
      file ? URL.createObjectURL(file) : null
    );
    setPreviewUrls(urls);

    return () => {
      for (const url of urls) {
        if (url) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, [previewFiles]);

  function resetSelection() {
    setSelectedFiles([]);
    setPreviewFiles([]);
    setOcrText("");
    setOcrError("");
    setOcrStatus("");
    setOcrProgress(0);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function updatePreviewFile(index: number, file: File) {
    setPreviewFiles((currentPreviewFiles) => {
      const nextPreviewFiles = [...currentPreviewFiles];
      nextPreviewFiles[index] = file;
      return nextPreviewFiles;
    });
  }

  function handleFileSelection(files: File[]) {
    setSelectedFiles(files);
    setFormError("");
    setOcrText("");
    setOcrError("");
    setOcrStatus("");
    setOcrProgress(0);

    if (
      files.length > 1 &&
      files.some((file) => !isBrowserOcrCandidate(file))
    ) {
      setPreviewFiles([]);
      setFormError(t("Choose one file, or choose multiple image pages."));
      return;
    }

    setPreviewFiles(
      files.map((file) =>
        isBrowserOcrCandidate(file) && canPreviewInBrowser(file) ? file : null
      )
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (selectedFiles.length === 0) {
      setFormError(t("Choose a leaflet file first."));
      return;
    }

    if (
      selectedHasMultipleFiles &&
      selectedFiles.some((file) => !isBrowserOcrCandidate(file))
    ) {
      setFormError(t("Choose one file, or choose multiple image pages."));
      return;
    }

    try {
      const uploadFile = selectedHasMultipleFiles
        ? await createLeafletImageBundle(selectedFiles)
        : selectedFiles[0];

      if (selectedFilesUseOcr && hasOcrText) {
        await onUploadWithOcrText(uploadFile, ocrText.trim());
      } else {
        await onUpload(uploadFile);
      }
      resetSelection();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not upload leaflet.")
      );
    }
  }

  async function handleRunOcr() {
    if (selectedFiles.length === 0) {
      setFormError(t("Choose a leaflet image first."));
      return;
    }

    if (!selectedFilesUseOcr) {
      setFormError(t("Choose one file, or choose multiple image pages."));
      return;
    }

    setFormError("");
    setOcrError("");
    setOcrStatus(t("Preparing image for OCR"));
    setOcrProgress(0);
    setIsOcrRunning(true);

    try {
      const pageTexts: string[] = [];
      let hasReadableText = false;
      for (const [index, file] of selectedFiles.entries()) {
        const pageNumber = index + 1;
        const pageCount = selectedFiles.length;
        const result = await runBrowserOcr(
          file,
          ocrLanguage,
          (progress) => {
            setOcrStatus(
              formatPageOcrStatus(pageNumber, pageCount, progress.status, t)
            );
            setOcrProgress((index + progress.progress) / pageCount);
            if (progress.previewFile) {
              updatePreviewFile(index, progress.previewFile);
            }
          }
        );

        updatePreviewFile(index, result.previewFile);
        hasReadableText = hasReadableText || result.sourceText.trim().length > 0;
        pageTexts.push(
          [
            `--- ${t("Page")} ${pageNumber}: ${file.name} ---`,
            result.sourceText || t("No readable text found on this page.")
          ].join("\n")
        );
      }

      const combinedText = pageTexts.join("\n\n");
      setOcrText(combinedText);
      if (!hasReadableText) {
        setOcrError(
          t(
            "OCR did not find readable text. You can paste leaflet text manually before uploading."
          )
        );
      } else {
        const convertedHeic = selectedFiles.some(isHeicLikeImage);
        setOcrStatus(
          convertedHeic
            ? t("OCR complete. HEIC/HEIF was converted locally.")
            : t("OCR complete. Review the text before extraction.")
        );
      }
    } catch (caughtError) {
      setOcrError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Browser OCR failed. Paste text manually or upload the file only.")
      );
    } finally {
      setIsOcrRunning(false);
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
            "Images are read in your browser first. OCR text stays editable and review-only until you approve guidance."
          )}
        </span>
      </div>

      <form className="leaflet-upload-form" onSubmit={handleSubmit}>
        <label>
          <span>{t("Upload leaflet")}</span>
          <input
            accept=".bmp,.gif,.heic,.heif,.jpeg,.jpg,.pdf,.png,.tif,.tiff,.txt,.webp,.zip,image/*,application/pdf,application/zip,text/plain"
            multiple
            ref={inputRef}
            type="file"
            onChange={(event) => {
              handleFileSelection(Array.from(event.target.files ?? []));
            }}
          />
        </label>
        <button
          className="primary-button"
          type="submit"
          disabled={isUploading || isOcrRunning}
        >
          {isUploading
            ? t("Uploading")
            : selectedFilesUseOcr && hasOcrText
              ? t("Upload and create review draft")
              : t("Upload")}
        </button>
      </form>

      {formError && <p className="form-error">{formError}</p>}

      {selectedFile && selectedFilesUseOcr && (
        <div className="ocr-workspace">
          <div className="ocr-preview-grid">
            <div className="ocr-preview">
              <div className="ocr-preview-list">
                {selectedFiles.map((file, index) => {
                  const previewUrl = previewUrls[index];
                  return (
                    <figure key={`${file.name}-${file.size}-${index}`}>
                      {previewUrl ? (
                        <img
                          alt={`${t("Selected leaflet preview")} ${index + 1}`}
                          src={previewUrl}
                        />
                      ) : (
                        <div className="preview-placeholder">
                          <strong>
                            {isHeicLikeImage(file)
                              ? t("HEIC/HEIF preview pending")
                              : t("Preview unavailable")}
                          </strong>
                          <span>{file.name}</span>
                        </div>
                      )}
                      <figcaption>
                        {t("Page")} {index + 1}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>

            <div className="ocr-controls">
              <div className="selected-file-list">
                <strong>
                  {selectedFiles.length === 1
                    ? t("1 page selected")
                    : `${selectedFiles.length} ${t("pages selected")}`}
                </strong>
                <ol>
                  {selectedFiles.map((file, index) => (
                    <li key={`${file.name}-${file.size}-${index}`}>
                      {file.name}
                    </li>
                  ))}
                </ol>
              </div>
              <label>
                <span>{t("OCR language")}</span>
                <select
                  value={ocrLanguage}
                  onChange={(event) =>
                    setOcrLanguage(event.target.value as OcrLanguageCode)
                  }
                  disabled={isOcrRunning}
                >
                  <option value="eng">{t("English")}</option>
                  <option value="chi_sim">{t("Chinese")}</option>
                  <option value="eng+chi_sim">{t("English + Chinese")}</option>
                </select>
              </label>
              <button
                className="secondary-button"
                type="button"
                disabled={isUploading || isOcrRunning}
                onClick={() => void handleRunOcr()}
              >
                {isOcrRunning ? t("Reading image") : t("Read image text")}
              </button>
              <p>
                {t(
                  "OCR runs locally in this browser. Review and edit the text before creating a draft."
                )}
              </p>
            </div>
          </div>

          {(ocrStatus || isOcrRunning) && (
            <div className="ocr-progress" aria-live="polite">
              <div>
                <span>{ocrStatus || t("Reading image text")}</span>
                <span>{Math.round(ocrProgress * 100)}%</span>
              </div>
              <progress max="1" value={ocrProgress} />
            </div>
          )}

          {ocrError && <p className="form-error">{ocrError}</p>}

          <label className="ocr-text-field">
            <span>{t("OCR text")}</span>
            <textarea
              rows={9}
              value={ocrText}
              placeholder={t(
                "Run OCR, then correct the text here. If OCR fails, paste leaflet text manually."
              )}
              onChange={(event) => {
                setOcrText(event.target.value);
                setOcrError("");
              }}
            />
          </label>
          <p className="ocr-help">
            {t(
              "Submitting with OCR text stores the original file plus this reviewed text, then opens the AI review draft. Submitting without text stores the file only."
            )}
          </p>
        </div>
      )}

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
                {(isLeafletImageUpload(upload) || isLeafletZipUpload(upload)) && (
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    onClick={() => onView(upload)}
                  >
                    {t("View image")}
                  </button>
                )}
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
