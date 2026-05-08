import { safeStorage } from 'electron'

export function encryptSecret(value: string): string {
  if (!value) return ''
  try {
    return safeStorage.encryptString(value).toString('base64')
  } catch {
    return value
  }
}

export function decryptSecret(encoded: string): string {
  if (!encoded) return ''
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  } catch {
    return encoded
  }
}
