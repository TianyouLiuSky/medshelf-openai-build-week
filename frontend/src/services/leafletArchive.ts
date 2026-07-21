import type { LeafletUpload } from "../types/medicine";

const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

const IMAGE_CONTENT_TYPES = new Set([
  "image/bmp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp"
]);

const IMAGE_EXTENSIONS = new Set([
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

export interface LeafletArchivePage {
  file: File;
  name: string;
}

function fileExtension(filename: string): string {
  const match = filename.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

function inferImageContentType(filename: string): string {
  switch (fileExtension(filename)) {
    case ".bmp":
      return "image/bmp";
    case ".gif":
      return "image/gif";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    case ".jpeg":
    case ".jpg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export function isLeafletImageUpload(upload: LeafletUpload): boolean {
  return (
    IMAGE_CONTENT_TYPES.has(upload.content_type) ||
    IMAGE_EXTENSIONS.has(fileExtension(upload.original_filename))
  );
}

export function isLeafletZipUpload(upload: LeafletUpload): boolean {
  return (
    upload.content_type === "application/zip" ||
    upload.content_type === "application/x-zip-compressed" ||
    fileExtension(upload.original_filename) === ".zip"
  );
}

function isZipImageEntry(filename: string): boolean {
  const normalized = filename.toLowerCase();
  return (
    !normalized.endsWith("/") &&
    !normalized.startsWith("__macosx/") &&
    IMAGE_EXTENSIONS.has(fileExtension(filename))
  );
}

function cleanEntryName(filename: string): string {
  return filename.replace(/^\/+/, "").split("/").pop() || "leaflet-page";
}

export function extractUncompressedZipImagePages(
  archiveBuffer: ArrayBuffer
): LeafletArchivePage[] {
  const view = new DataView(archiveBuffer);
  const decoder = new TextDecoder();
  const pages: LeafletArchivePage[] = [];
  let offset = 0;

  while (offset + 30 <= archiveBuffer.byteLength) {
    const signature = view.getUint32(offset, true);
    if (
      signature === ZIP_CENTRAL_DIRECTORY_SIGNATURE ||
      signature === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      break;
    }

    if (signature !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error("Leaflet bundle is not a readable image archive.");
    }

    const flags = view.getUint16(offset + 6, true);
    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const filenameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const filenameStart = offset + 30;
    const filenameEnd = filenameStart + filenameLength;
    const dataStart = filenameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > archiveBuffer.byteLength) {
      throw new Error("Leaflet bundle ended before all pages could be read.");
    }

    const filename = decoder.decode(
      new Uint8Array(archiveBuffer, filenameStart, filenameLength)
    );

    if (
      compressionMethod === 0 &&
      (flags & 0x08) === 0 &&
      compressedSize > 0 &&
      isZipImageEntry(filename)
    ) {
      const pageBytes = archiveBuffer.slice(dataStart, dataEnd);
      const pageName = cleanEntryName(filename);
      pages.push({
        file: new File([pageBytes], pageName, {
          type: inferImageContentType(pageName)
        }),
        name: pageName
      });
    }

    offset = dataEnd;
  }

  return pages;
}
