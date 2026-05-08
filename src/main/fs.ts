import { createReadStream, createWriteStream, constants } from 'fs'
import { access, readdir, stat, mkdir, rename } from 'fs/promises'
import { extname, join, basename } from 'path'
import type { FileEntry } from '../shared/types'

export async function checkPath(dirPath: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await access(dirPath, constants.R_OK)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function listDirectory(dirPath: string): Promise<FileEntry[]> {
  let dirents: { name: string; isDirectory(): boolean }[]
  try {
    dirents = await readdir(dirPath, { withFileTypes: true })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') throw new Error('Folder not found — it may have been moved or deleted.')
    if (code === 'EACCES' || code === 'EPERM') throw new Error('Permission denied.')
    throw err
  }

  const entries = await Promise.all(
    dirents.map(async (d): Promise<FileEntry | null> => {
      try {
        const s = await stat(join(dirPath, d.name))
        return {
          name: d.name,
          type: d.isDirectory() ? 'directory' : 'file',
          size: s.size,
          modifiedAt: s.mtime.toISOString(),
          ext: extname(d.name).toLowerCase()
        }
      } catch {
        return null
      }
    })
  )

  return (entries.filter(Boolean) as FileEntry[]).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

export async function makeDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

export async function moveFile(srcPath: string, destDir: string): Promise<void> {
  const dest = join(destDir, basename(srcPath))
  await rename(srcPath, dest)
}

export async function copyFileWithProgress(
  srcPath: string,
  destPath: string,
  onProgress: (loaded: number, total: number) => void
): Promise<void> {
  const { size: total } = await stat(srcPath)
  let loaded = 0

  await new Promise<void>((resolve, reject) => {
    const src = createReadStream(srcPath)
    const dest = createWriteStream(destPath)

    src.on('data', (chunk: Buffer) => {
      loaded += chunk.length
      onProgress(loaded, total)
    })
    src.on('error', (err) => { dest.destroy(); reject(err) })
    dest.on('error', reject)
    dest.on('finish', resolve)
    src.pipe(dest)
  })
}
