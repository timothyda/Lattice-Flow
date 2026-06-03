import { app, desktopCapturer, dialog, shell } from 'electron'
import { copyFile, mkdir, writeFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'

export interface ScreenSource {
  id: string
  name: string
  thumbnail: string // base64 data URL
}

export async function getScreenSources(): Promise<ScreenSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 }
  })
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL()
  }))
}

export async function saveRecording(buffer: ArrayBuffer, destPath: string): Promise<void> {
  await writeFile(destPath, Buffer.from(buffer))
}

// Whisper CLI: bundled in resources in production, from settings in dev
export function getWhisperCliPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'whisper', 'main.exe')
  }
  // Dev: look next to the binary the user already set up
  return join(app.getPath('userData'), 'whisper', 'main.exe')
}

// Model always lives in userData so users can copy it without admin rights
export function getModelPath(): string {
  return join(app.getPath('userData'), 'whisper', 'ggml-medium.en.bin')
}

export function modelExists(): boolean {
  return existsSync(getModelPath())
}

export function whisperCliExists(): boolean {
  return existsSync(getWhisperCliPath())
}

export function whisperDllExists(): boolean {
  return existsSync(join(app.getPath('userData'), 'whisper', 'Whisper.dll'))
}

export async function importModelFile(): Promise<boolean> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select ggml-medium.en.bin model file',
    filters: [{ name: 'Whisper model', extensions: ['bin'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths[0]) return false
  const destDir = join(app.getPath('userData'), 'whisper')
  await mkdir(destDir, { recursive: true })
  await copyFile(filePaths[0], join(destDir, 'ggml-medium.en.bin'))
  return true
}

export async function importWhisperCli(): Promise<boolean> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select whisper.cpp CLI executable (main.exe or whisper-cli.exe — not Whisper Desktop)',
    filters: [{ name: 'Executable', extensions: ['exe'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths[0]) return false
  const srcDir = dirname(filePaths[0])
  const destDir = join(app.getPath('userData'), 'whisper')
  await mkdir(destDir, { recursive: true })
  await copyFile(filePaths[0], join(destDir, 'main.exe'))

  // Copy all DLLs from the same folder (Whisper.dll, etc.)
  const siblings = await readdir(srcDir).catch(() => [] as string[])
  for (const f of siblings.filter((f) => f.toLowerCase().endsWith('.dll'))) {
    await copyFile(join(srcDir, f), join(destDir, f))
  }
  return true
}

export function openWhisperFolder(): void {
  const folder = join(app.getPath('userData'), 'whisper')
  mkdir(folder, { recursive: true }).then(() => shell.openPath(folder))
}

export function getWhisperFolderPath(): string {
  return join(app.getPath('userData'), 'whisper')
}
