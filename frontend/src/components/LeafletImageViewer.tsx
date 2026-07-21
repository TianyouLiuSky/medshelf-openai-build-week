import { PointerEvent, useEffect, useRef, useState } from "react";

import { leafletFileUrl } from "../api/medications";
import { useI18n } from "../i18n";
import {
  canPreviewInBrowser,
  prepareImageForBrowserPreview
} from "../services/browserOcr";
import {
  extractUncompressedZipImagePages,
  isLeafletImageUpload,
  isLeafletZipUpload
} from "../services/leafletArchive";
import type { LeafletUpload, Medication } from "../types/medicine";

interface LeafletImageViewerProps {
  medication: Medication;
  upload: LeafletUpload | null;
  onClose: () => void;
}

interface ViewerPage {
  name: string;
  objectUrl: string;
}

interface PanState {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
}

function fileFromUpload(upload: LeafletUpload, blob: Blob): File {
  return new File([blob], upload.original_filename, {
    type: blob.type || upload.content_type || "application/octet-stream"
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function imagePagesFromUpload(upload: LeafletUpload): Promise<File[]> {
  const response = await fetch(leafletFileUrl(upload.id));
  if (!response.ok) {
    throw new Error("Could not load leaflet image.");
  }

  const blob = await response.blob();
  if (isLeafletZipUpload(upload)) {
    const archivePages = extractUncompressedZipImagePages(
      await blob.arrayBuffer()
    );
    return archivePages.map((page) => page.file);
  }

  if (isLeafletImageUpload(upload)) {
    return [fileFromUpload(upload, blob)];
  }

  throw new Error("This leaflet upload is not an image bundle.");
}

function LeafletImageViewer({
  medication,
  upload,
  onClose
}: LeafletImageViewerProps) {
  const { t } = useI18n();
  const viewportRef = useRef<HTMLDivElement>(null);
  const panState = useRef<PanState | null>(null);
  const [pages, setPages] = useState<ViewerPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);

  useEffect(() => {
    if (!upload) {
      return;
    }

    const activeUpload = upload;
    let isCancelled = false;
    const objectUrls: string[] = [];
    setPages([]);
    setActivePageIndex(0);
    setError("");
    setIsLoading(true);
    setZoom(1);
    setRotation(0);
    setBrightness(1);
    setContrast(1);

    async function loadPages() {
      try {
        const imageFiles = await imagePagesFromUpload(activeUpload);
        if (imageFiles.length === 0) {
          throw new Error("No previewable image pages were found.");
        }

        const viewerPages: ViewerPage[] = [];
        for (const file of imageFiles) {
          const previewFile = await prepareImageForBrowserPreview(file);
          if (isCancelled) {
            return;
          }

          if (!canPreviewInBrowser(previewFile)) {
            continue;
          }

          const objectUrl = URL.createObjectURL(previewFile);
          objectUrls.push(objectUrl);
          viewerPages.push({
            name: file.name,
            objectUrl
          });
        }

        if (viewerPages.length === 0) {
          throw new Error("This image format cannot be previewed in this browser.");
        }

        if (!isCancelled) {
          setPages(viewerPages);
        }
      } catch (caughtError) {
        if (!isCancelled) {
          setError(
            caughtError instanceof Error
              ? t(caughtError.message)
              : t("Could not load leaflet image.")
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPages();

    return () => {
      isCancelled = true;
      for (const objectUrl of objectUrls) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [upload, t]);

  useEffect(() => {
    if (!upload) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, upload]);

  if (!upload) {
    return null;
  }

  const activePage = pages[activePageIndex] ?? null;

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!viewportRef.current) {
      return;
    }

    panState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!viewportRef.current || !panState.current) {
      return;
    }

    viewportRef.current.scrollLeft =
      panState.current.scrollLeft - (event.clientX - panState.current.startX);
    viewportRef.current.scrollTop =
      panState.current.scrollTop - (event.clientY - panState.current.startY);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (panState.current?.pointerId === event.pointerId) {
      panState.current = null;
    }
  }

  function resetView() {
    setZoom(1);
    setRotation(0);
    setBrightness(1);
    setContrast(1);
  }

  return (
    <div className="leaflet-viewer-backdrop" role="presentation">
      <section
        aria-label={t("Leaflet image viewer")}
        aria-modal="true"
        className="leaflet-viewer-dialog"
        role="dialog"
      >
        <header className="leaflet-viewer-header">
          <div>
            <p className="eyebrow">{t("Original leaflet")}</p>
            <h2>{medication.name}</h2>
            <span>
              {upload.original_filename} · {pages.length || 0} {t("pages")}
            </span>
          </div>
          <button className="secondary-button" type="button" onClick={onClose}>
            {t("Close")}
          </button>
        </header>

        <div className="leaflet-viewer-safety" role="note">
          <strong>{t("Image is the source of truth.")}</strong>
          <span>
            {t(
              "Use this viewer to enlarge the original leaflet. OCR and online results can be incomplete, so keep user-entered schedules and clinician or pharmacist directions as the medication plan."
            )}
          </span>
        </div>

        <div className="leaflet-viewer-toolbar" aria-label={t("Viewer controls")}>
          <div className="viewer-button-group">
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={() => setZoom((value) => clamp(value - 0.25, 0.5, 4))}
            >
              {t("Zoom out")}
            </button>
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={() => setZoom((value) => clamp(value + 0.25, 0.5, 4))}
            >
              {t("Zoom in")}
            </button>
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={() => setRotation((value) => value - 90)}
            >
              {t("Rotate left")}
            </button>
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={() => setRotation((value) => value + 90)}
            >
              {t("Rotate right")}
            </button>
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={resetView}
            >
              {t("Reset view")}
            </button>
          </div>

          <label>
            <span>{t("Zoom")}</span>
            <input
              max="4"
              min="0.5"
              step="0.1"
              type="range"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <label>
            <span>{t("Brightness")}</span>
            <input
              max="1.8"
              min="0.6"
              step="0.05"
              type="range"
              value={brightness}
              onChange={(event) => setBrightness(Number(event.target.value))}
            />
          </label>
          <label>
            <span>{t("Contrast")}</span>
            <input
              max="1.8"
              min="0.6"
              step="0.05"
              type="range"
              value={contrast}
              onChange={(event) => setContrast(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="leaflet-viewer-body">
          <aside className="leaflet-viewer-thumbnails">
            {pages.map((page, index) => (
              <button
                className={index === activePageIndex ? "is-active" : ""}
                key={page.objectUrl}
                type="button"
                onClick={() => setActivePageIndex(index)}
              >
                <img alt={`${t("Page")} ${index + 1}`} src={page.objectUrl} />
                <span>
                  {t("Page")} {index + 1}
                </span>
              </button>
            ))}
          </aside>

          <div
            className="leaflet-viewer-viewport"
            ref={viewportRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {isLoading && (
              <div className="viewer-state">
                <h3>{t("Loading leaflet image")}</h3>
              </div>
            )}
            {error && !isLoading && (
              <div className="viewer-state">
                <h3>{t("Preview unavailable")}</h3>
                <p>{error}</p>
              </div>
            )}
            {activePage && !isLoading && !error && (
              <img
                alt={activePage.name}
                className="leaflet-viewer-image"
                draggable={false}
                src={activePage.objectUrl}
                style={{
                  filter: `brightness(${brightness}) contrast(${contrast})`,
                  transform: `rotate(${rotation}deg)`,
                  width: `${zoom * 100}%`
                }}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default LeafletImageViewer;
