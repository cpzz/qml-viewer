import { readFile as fsReadFile, writeFile as fsWriteFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'

export async function readFile(filePath: string): Promise<string> {
  return await fsReadFile(filePath, 'utf-8')
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fsWriteFile(filePath, content, 'utf-8')
}

export async function readFileByPath(filePath: string): Promise<{ content: string; filePath: string } | null> {
  try {
    const content = await fsReadFile(filePath, 'utf-8')
    return { content, filePath }
  } catch {
    return null
  }
}

export interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
}

export async function readDirectory(dirPath: string): Promise<FileItem[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  return entries
    .filter(entry => entry.isDirectory() || (entry.isFile() && /\.qml$/i.test(entry.name)))
    .map(entry => ({
      name: entry.name,
      path: join(dirPath, entry.name),
      type: entry.isDirectory() ? 'directory' as const : 'file' as const,
    }))
}

export async function listQmlFilesInDirectory(dirPath: string): Promise<FileItem[]> {
  const result: FileItem[] = []

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (entry.isFile() && extname(entry.name).toLowerCase() === '.qml') {
        result.push({
          name: entry.name,
          path: fullPath,
          type: 'file',
        })
      }
    }
  }

  await walk(dirPath)
  return result
}
