import { readFile as fsReadFile, writeFile as fsWriteFile } from 'node:fs/promises'

export async function readFile(filePath: string): Promise<string> {
  return await fsReadFile(filePath, 'utf-8')
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fsWriteFile(filePath, content, 'utf-8')
}
