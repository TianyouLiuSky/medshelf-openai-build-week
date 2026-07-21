export type OcrLanguageCode = "eng" | "chi_sim" | "eng+chi_sim";

export interface OcrProgressUpdate {
  status: string;
  progress: number;
  previewFile?: File;
}

export interface BrowserOcrResult {
  sourceText: string;
  confidence: number;
  previewFile: File;
  convertedFromHeic: boolean;
}

const OCR_IMAGE_EXTENSIONS = new Set([
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
  ".jpeg",
  ".jpg",
  ".png",
  ".tif",
  ".tiff",
  ".webp"
]);

const BROWSER_PREVIEW_EXTENSIONS = new Set([
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp"
]);

const TESSERACT_DIRECT_CONTENT_TYPES = new Set([
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const MAX_OCR_IMAGE_DIMENSION = 1800;

function fileExtension(file: File): string {
  const match = file.name.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

export function isBrowserOcrCandidate(file: File): boolean {
  return (
    file.type.startsWith("image/") || OCR_IMAGE_EXTENSIONS.has(fileExtension(file))
  );
}

export function isHeicLikeImage(file: File): boolean {
  const extension = fileExtension(file);
  return (
    extension === ".heic" ||
    extension === ".heif" ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  );
}

export function canPreviewInBrowser(file: File): boolean {
  return (
    TESSERACT_DIRECT_CONTENT_TYPES.has(file.type) ||
    BROWSER_PREVIEW_EXTENSIONS.has(fileExtension(file))
  );
}

function replaceExtension(filename: string, extension: string): string {
  const withoutExtension = filename.replace(/\.[^/.]+$/, "");
  return `${withoutExtension || "leaflet-image"}${extension}`;
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92
  });
  const convertedBlob = Array.isArray(converted) ? converted[0] : converted;

  return new File([convertedBlob], replaceExtension(file.name, ".jpg"), {
    type: "image/jpeg"
  });
}

export async function prepareImageForBrowserPreview(file: File): Promise<File> {
  if (!isHeicLikeImage(file)) {
    return file;
  }

  return convertHeicToJpeg(file);
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  contentType: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not prepare image for OCR."));
          return;
        }
        resolve(blob);
      },
      contentType,
      0.92
    );
  });
}

async function resizeLargeImage(file: File): Promise<File> {
  if (!TESSERACT_DIRECT_CONTENT_TYPES.has(file.type)) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const maxDimension = Math.max(bitmap.width, bitmap.height);
  if (maxDimension <= MAX_OCR_IMAGE_DIMENSION) {
    bitmap.close();
    return file;
  }

  const scale = MAX_OCR_IMAGE_DIMENSION / maxDimension;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const resizedBlob = await canvasToBlob(canvas, outputType);
  const resizedName = replaceExtension(
    file.name,
    outputType === "image/png" ? ".png" : ".jpg"
  );
  return new File([resizedBlob], resizedName, { type: outputType });
}

function languageList(language: OcrLanguageCode): string[] {
  return language.split("+");
}

export async function runBrowserOcr(
  file: File,
  language: OcrLanguageCode,
  onProgress: (update: OcrProgressUpdate) => void
): Promise<BrowserOcrResult> {
  if (!isBrowserOcrCandidate(file)) {
    throw new Error("Choose an image file before running OCR.");
  }

  let workingFile = file;
  let convertedFromHeic = false;

  if (isHeicLikeImage(file)) {
    onProgress({ status: "Converting HEIC/HEIF image", progress: 0.08 });
    workingFile = await convertHeicToJpeg(file);
    convertedFromHeic = true;
    onProgress({
      status: "Prepared browser-readable image",
      progress: 0.16,
      previewFile: workingFile
    });
  }

  onProgress({ status: "Preparing image for OCR", progress: 0.2 });
  workingFile = await resizeLargeImage(workingFile);
  onProgress({
    status: "Loading OCR worker",
    progress: 0.28,
    previewFile: canPreviewInBrowser(workingFile) ? workingFile : undefined
  });

  const Tesseract = await import("tesseract.js");
  const worker = await Tesseract.createWorker(languageList(language), 1, {
    logger: (message) => {
      if (typeof message.progress !== "number") {
        return;
      }
      onProgress({
        status: message.status || "Reading image text",
        progress: Math.min(0.95, Math.max(0.3, message.progress))
      });
    }
  });

  try {
    onProgress({ status: "Reading image text", progress: 0.35 });
    const result = await worker.recognize(workingFile);
    const sourceText = result.data.text.trim();
    onProgress({ status: "OCR complete", progress: 1 });

    return {
      sourceText,
      confidence: result.data.confidence,
      previewFile: workingFile,
      convertedFromHeic
    };
  } finally {
    await worker.terminate();
  }
}
