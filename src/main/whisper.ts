import { spawn } from 'child_process'
import { rename } from 'fs/promises'
import { join, basename, extname, dirname } from 'path'
import { BrowserWindow } from 'electron'

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

function sendProgress(line: string): void {
  getMainWindow()?.webContents.send('whisper:progress', line)
}

export async function moveRecording(srcPath: string, destDir: string): Promise<string> {
  const destPath = join(destDir, 'recording' + extname(srcPath))
  // OBS may still hold a lock on the file briefly after stopping — retry up to 10x
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await rename(srcPath, destPath)
      return destPath
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code
      if ((code === 'EBUSY' || code === 'EPERM') && attempt < 9) {
        await new Promise((r) => setTimeout(r, 1000))
      } else {
        throw err
      }
    }
  }
  return destPath
}

export function transcribeRecording(
  cliPath: string,
  modelPath: string,
  recordingPath: string
  // cliPath and modelPath are resolved by recorder.ts — callers pass them in
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Wrap paths in quotes — shell: true passes args through cmd.exe which splits on spaces
    const args = [
      '-m', `"${modelPath}"`,
      '-f', `"${recordingPath}"`,
      '-otxt'
    ]

    sendProgress('Starting transcription…')

    // shell:true ensures Windows resolves the full DLL chain from the exe's directory
    const proc = spawn(cliPath, args, {
      cwd: dirname(cliPath),
      shell: true,
      windowsHide: true
    })
    const stderrLines: string[] = []

    proc.stdout.on('data', (chunk: Buffer) => sendProgress(chunk.toString().trim()))
    proc.stderr.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim()
      stderrLines.push(line)
      sendProgress(line)
    })

    proc.on('close', (code) => {
      if (code === 0) {
        // Whisper writes {filename}.txt alongside the input file
        const base = basename(recordingPath, extname(recordingPath))
        resolve(join(dirname(recordingPath), base + '.txt'))
      } else {
        const detail = stderrLines.slice(-5).join(' ').trim()
        reject(new Error(`Whisper exited with code ${code}${detail ? ': ' + detail : ''}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Could not start Whisper: ${err.message} — check the CLI path in Settings`))
    })
  })
}
