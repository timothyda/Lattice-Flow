import type { FileEntry } from '../../../shared/types'

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'])

interface Props {
  entry: FileEntry
  currentPath: string
}

function assetUrl(filePath: string): string {
  return `asset://preview?path=${encodeURIComponent(filePath)}`
}

export default function FilePreview({ entry, currentPath }: Props): JSX.Element {
  const filePath = window.api.path.join(currentPath, entry.name)
  const url = assetUrl(filePath)
  const ext = entry.ext.toLowerCase()
  const isImage = IMAGE_EXTS.has(ext)
  const isPDF = ext === '.pdf'

  return (
    <div className="fb-preview">
      <div className="fb-preview-label">{entry.name}</div>
      {isImage && (
        <img src={url} alt={entry.name} className="fb-preview-image" />
      )}
      {isPDF && (
        <iframe
          src={url}
          title={entry.name}
          className="fb-preview-pdf"
        />
      )}
      {!isImage && !isPDF && (
        <p className="fb-preview-none">No preview available for this file type.</p>
      )}
    </div>
  )
}
