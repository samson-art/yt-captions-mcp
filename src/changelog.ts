import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const CHANGELOG_PATH = join(process.cwd(), 'CHANGELOG.md');

export async function readChangelog(): Promise<string> {
  return readFile(CHANGELOG_PATH, 'utf-8');
}
