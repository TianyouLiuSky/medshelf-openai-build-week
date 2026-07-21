const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

interface ZipEntry {
  bytes: Uint8Array;
  localHeader: Uint8Array;
  centralDirectoryHeader: Uint8Array;
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let current = index;
  for (let bit = 0; bit < 8; bit += 1) {
    current =
      current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  }
  crcTable[index] = current >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function dosDateTime(date = new Date()): { date: number; time: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2)
  };
}

function sanitizeZipFilename(filename: string, index: number): string {
  const fallback = `page-${String(index + 1).padStart(2, "0")}.jpg`;
  const normalized = filename
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function buildLocalHeader(
  filenameBytes: Uint8Array,
  fileBytes: Uint8Array,
  checksum: number
): Uint8Array {
  const header = new Uint8Array(30 + filenameBytes.length);
  const view = new DataView(header.buffer);
  const { date, time } = dosDateTime();

  writeUint32(view, 0, ZIP_LOCAL_FILE_HEADER_SIGNATURE);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 0);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, time);
  writeUint16(view, 12, date);
  writeUint32(view, 14, checksum);
  writeUint32(view, 18, fileBytes.length);
  writeUint32(view, 22, fileBytes.length);
  writeUint16(view, 26, filenameBytes.length);
  writeUint16(view, 28, 0);
  header.set(filenameBytes, 30);

  return header;
}

function buildCentralDirectoryHeader(
  filenameBytes: Uint8Array,
  fileBytes: Uint8Array,
  checksum: number,
  localHeaderOffset: number
): Uint8Array {
  const header = new Uint8Array(46 + filenameBytes.length);
  const view = new DataView(header.buffer);
  const { date, time } = dosDateTime();

  writeUint32(view, 0, ZIP_CENTRAL_DIRECTORY_SIGNATURE);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 20);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, 0);
  writeUint16(view, 12, time);
  writeUint16(view, 14, date);
  writeUint32(view, 16, checksum);
  writeUint32(view, 20, fileBytes.length);
  writeUint32(view, 24, fileBytes.length);
  writeUint16(view, 28, filenameBytes.length);
  writeUint16(view, 30, 0);
  writeUint16(view, 32, 0);
  writeUint16(view, 34, 0);
  writeUint16(view, 36, 0);
  writeUint32(view, 38, 0);
  writeUint32(view, 42, localHeaderOffset);
  header.set(filenameBytes, 46);

  return header;
}

function buildEndOfCentralDirectory(
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number
): Uint8Array {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);

  writeUint32(view, 0, ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE);
  writeUint16(view, 4, 0);
  writeUint16(view, 6, 0);
  writeUint16(view, 8, entryCount);
  writeUint16(view, 10, entryCount);
  writeUint32(view, 12, centralDirectorySize);
  writeUint32(view, 16, centralDirectoryOffset);
  writeUint16(view, 20, 0);

  return header;
}

function zipPart(bytes: Uint8Array): BlobPart {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export async function createLeafletImageBundle(files: File[]): Promise<File> {
  if (files.length === 0) {
    throw new Error("Choose at least one leaflet page.");
  }

  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];
  let offset = 0;

  for (const [index, file] of files.entries()) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const filename = `${String(index + 1).padStart(2, "0")}-${sanitizeZipFilename(
      file.name,
      index
    )}`;
    const filenameBytes = encoder.encode(filename);
    const checksum = crc32(bytes);
    const localHeader = buildLocalHeader(filenameBytes, bytes, checksum);
    const centralDirectoryHeader = buildCentralDirectoryHeader(
      filenameBytes,
      bytes,
      checksum,
      offset
    );

    entries.push({
      bytes,
      localHeader,
      centralDirectoryHeader
    });
    offset += localHeader.length + bytes.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = entries.reduce(
    (total, entry) => total + entry.centralDirectoryHeader.length,
    0
  );
  const endOfCentralDirectory = buildEndOfCentralDirectory(
    entries.length,
    centralDirectorySize,
    centralDirectoryOffset
  );

  const bundleParts = entries.flatMap((entry) => [
    zipPart(entry.localHeader),
    zipPart(entry.bytes)
  ]);
  bundleParts.push(
    ...entries.map((entry) => zipPart(entry.centralDirectoryHeader)),
    zipPart(endOfCentralDirectory)
  );

  return new File(bundleParts, `leaflet-pages-${files.length}.zip`, {
    type: "application/zip"
  });
}
