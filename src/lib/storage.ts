import { mkdir, writeFile, readFile } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');

export async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveFile(filename: string, buffer: Buffer): Promise<string> {
  await ensureUploadDir();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filepath = path.join(UPLOAD_DIR, safe);
  await writeFile(filepath, buffer);
  return `/api/v1/files/${safe}`;
}

export async function readStoredFile(filename: string): Promise<Buffer> {
  const safe = path.basename(filename);
  const filepath = path.join(UPLOAD_DIR, safe);
  return readFile(filepath);
}

export function storedFilePath(filename: string): string {
  return path.join(UPLOAD_DIR, path.basename(filename));
}
