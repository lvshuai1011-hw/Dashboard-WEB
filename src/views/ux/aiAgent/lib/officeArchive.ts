import { MAX_OFFICE_EXPANDED_BYTES } from '../types';
import { officeFailure, officePath, parseOfficeXml } from './officeXml';

// ZIP 文件布局。偏移量以各自记录的起点为基准，整数按小端序读取。
const END_OF_CENTRAL_DIRECTORY = {
  SIGNATURE: 0x06054b50,
  FIXED_SIZE: 22,
  DISK_NUMBER: 4,
  DIRECTORY_DISK: 6,
  ENTRIES_ON_DISK: 8,
  ENTRY_COUNT: 10,
  DIRECTORY_SIZE: 12,
  DIRECTORY_OFFSET: 16,
  COMMENT_LENGTH: 20,
} as const;
const CENTRAL_DIRECTORY_ENTRY = {
  SIGNATURE: 0x02014b50,
  FIXED_SIZE: 46,
  FLAGS: 8,
  METHOD: 10,
  CRC: 16,
  PACKED_SIZE: 20,
  SIZE: 24,
  NAME_LENGTH: 28,
  EXTRA_LENGTH: 30,
  COMMENT_LENGTH: 32,
  LOCAL_HEADER_OFFSET: 42,
} as const;
const LOCAL_FILE_HEADER = {
  SIGNATURE: 0x04034b50,
  FIXED_SIZE: 30,
  FLAGS: 6,
  METHOD: 8,
  NAME_LENGTH: 26,
  EXTRA_LENGTH: 28,
} as const;
const MAX_ZIP_COMMENT_BYTES = 0xffff; // 注释长度占无符号 16 位。
const MAX_OFFICE_ZIP_ENTRIES = 4096; // 应用限制，用于约束解析工作量。
const ZIP64_SIZE_MARKER = 0xffffffff;
const ZIP_ENCRYPTED_FLAG = 1;
const ZIP_METHOD = { STORED: 0, DEFLATE: 8 } as const;
const CRC32_INITIAL = 0xffffffff;
const CRC32_REVERSED_POLYNOMIAL = 0xedb88320;
function officeCrc(data: Uint8Array): number {
  let crc = CRC32_INITIAL;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? CRC32_REVERSED_POLYNOMIAL : 0);
  }
  return (crc ^ CRC32_INITIAL) >>> 0;
}
export async function officeArchive(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer),
    view = new DataView(buffer);
  const entries = new Map<
    string,
    { offset: number; packed: number; size: number; method: number; crc: number }
  >();
  const uint16 = (p: number) => view.getUint16(p, true),
    uint32 = (p: number) => view.getUint32(p, true);
  const endRecord = END_OF_CENTRAL_DIRECTORY;
  const central = CENTRAL_DIRECTORY_ENTRY;
  const localHeader = LOCAL_FILE_HEADER;
  const lastPossibleEndRecord = bytes.length - endRecord.FIXED_SIZE;
  const firstPossibleEndRecord = Math.max(0, lastPossibleEndRecord - MAX_ZIP_COMMENT_BYTES);
  let end = -1;
  for (let position = lastPossibleEndRecord; position >= firstPossibleEndRecord; position--) {
    if (uint32(position) !== endRecord.SIGNATURE) continue;
    const commentLength = uint16(position + endRecord.COMMENT_LENGTH);
    if (position + endRecord.FIXED_SIZE + commentLength === bytes.length) {
      end = position;
      break;
    }
  }
  // Office 附件使用单卷 ZIP，两个磁盘编号都应为零。
  if (end < 0 || uint16(end + endRecord.DISK_NUMBER) || uint16(end + endRecord.DIRECTORY_DISK))
    throw officeFailure();
  const count = uint16(end + endRecord.ENTRY_COUNT);
  const directorySize = uint32(end + endRecord.DIRECTORY_SIZE);
  const directoryOffset = uint32(end + endRecord.DIRECTORY_OFFSET);
  const directoryEnd = directoryOffset + directorySize;
  if (
    count !== uint16(end + endRecord.ENTRIES_ON_DISK) ||
    count > MAX_OFFICE_ZIP_ENTRIES ||
    directoryEnd > end
  ) {
    throw officeFailure();
  }

  let offset = directoryOffset;
  let total = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let index = 0; index < count; index++) {
    const nameOffset = offset + central.FIXED_SIZE;
    if (nameOffset > end || uint32(offset) !== central.SIGNATURE) throw officeFailure();
    const flags = uint16(offset + central.FLAGS);
    const method = uint16(offset + central.METHOD);
    const crc = uint32(offset + central.CRC);
    const packed = uint32(offset + central.PACKED_SIZE);
    const size = uint32(offset + central.SIZE);
    const nameLength = uint16(offset + central.NAME_LENGTH);
    const next =
      nameOffset +
      nameLength +
      uint16(offset + central.EXTRA_LENGTH) +
      uint16(offset + central.COMMENT_LENGTH);
    const local = uint32(offset + central.LOCAL_HEADER_OFFSET);
    if (
      flags & ZIP_ENCRYPTED_FLAG ||
      next > directoryEnd ||
      size === ZIP64_SIZE_MARKER ||
      packed === ZIP64_SIZE_MARKER ||
      local + localHeader.FIXED_SIZE > directoryOffset
    )
      throw officeFailure();
    const name = officePath(
      '',
      decoder.decode(bytes.subarray(nameOffset, nameOffset + nameLength)),
    );
    if (entries.has(name)) throw officeFailure();
    total += size;
    if (total > MAX_OFFICE_EXPANDED_BYTES) throw new Error('ATTACHMENT_SIZE');
    if (
      uint32(local) !== localHeader.SIGNATURE ||
      uint16(local + localHeader.METHOD) !== method ||
      uint16(local + localHeader.FLAGS) & ZIP_ENCRYPTED_FLAG
    )
      throw officeFailure();
    const dataOffset =
      local +
      localHeader.FIXED_SIZE +
      uint16(local + localHeader.NAME_LENGTH) +
      uint16(local + localHeader.EXTRA_LENGTH);
    if (dataOffset + packed > directoryOffset) throw officeFailure();
    entries.set(name, { offset: dataOffset, packed, size, method, crc });
    offset = next;
  }
  if (offset !== directoryEnd) throw officeFailure();
  const cache = new Map<string, Document>();
  return async (path: string, optional = false): Promise<Document | undefined> => {
    if (cache.has(path)) return cache.get(path);
    const entry = entries.get(path);
    if (!entry) {
      if (optional) return undefined;
      throw officeFailure();
    }
    const packed = bytes.slice(entry.offset, entry.offset + entry.packed);
    let output: Uint8Array;
    if (entry.method === ZIP_METHOD.STORED) output = packed;
    else if (entry.method === ZIP_METHOD.DEFLATE && typeof DecompressionStream !== 'undefined') {
      const reader = new Blob([packed])
        .stream()
        .pipeThrough(new DecompressionStream('deflate-raw'))
        .getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > entry.size || length > MAX_OFFICE_EXPANDED_BYTES) {
            await reader.cancel();
            throw new Error('ATTACHMENT_SIZE');
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      output = new Uint8Array(length);
      let cursor = 0;
      for (const chunk of chunks) {
        output.set(chunk, cursor);
        cursor += chunk.byteLength;
      }
    } else throw officeFailure();
    if (output.length !== entry.size || officeCrc(output) !== entry.crc) throw officeFailure();
    const doc = parseOfficeXml(decoder.decode(output));
    cache.set(path, doc);
    return doc;
  };
}
