import { useState, useEffect } from 'react'
import type { Meeting } from '../../../shared/types'
import RecordingModal from './RecordingModal'

interface Props {
  meeting: Meeting
  nasPath: string
  onRecordingPathSaved: (path: string) => void
}

type State = 'checking' | 'setup-needed' | 'ready' | 'recording' | 'transcribing' | 'done' | 'error'

export default function MeetingRecorder({ meeting, nasPath, onRecordingPathSaved }: Props): JSX.Element {
  const [state, setState] = useState<State>('checking')
  const [showRecorder, setShowRecorder] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [transcript, setTranscript] = useState<string | null>(null)
  const [recordingFolder, setRecordingFolder] = useState(meeting.recording_path ?? '')
  const [error, setError] = useState('')
  const [notes, setNotes] = useState(meeting.notes ?? '')
  const [notesSaved, setNotesSaved] = useState(false)
  const [setupInfo, setSetupInfo] = useState<{ folderPath: string; modelExists: boolean; cliExists: boolean } | null>(null)

  // Check if Whisper is set up
  useEffect(() => {
    window.api.recorder.check().then((info) => {
      setSetupInfo(info)
      if (!info.modelExists || !info.cliExists) {
        setState('setup-needed')
      } else {
        setState('ready')
      }
    })
  }, [])

  // Load existing transcript
  useEffect(() => {
    if (meeting.recording_path) {
      const txtPath = window.api.path.join(meeting.recording_path, 'recording.txt')
      window.api.fs.readFile(txtPath)
        .then((text) => { setTranscript(text); setState('done') })
        .catch(async () => {
          await window.api.meetings.update(meeting.id, { recording_path: null })
          setRecordingFolder('')
        })
    }
  }, [meeting.recording_path, meeting.id])

  // Whisper progress stream
  useEffect(() => {
    return window.api.whisper.onProgress((line) => {
      if (line.trim()) setProgress((p) => [...p.slice(-50), line])
    })
  }, [])

  const handleRecordingDone = async (folder: string) => {
    setShowRecorder(false)
    setRecordingFolder(folder)
    onRecordingPathSaved(folder)
    await window.api.meetings.update(meeting.id, { recording_path: folder })

    // Start transcription (uses WAV — Windows Media Foundation handles it reliably)
    setState('transcribing')
    setProgress([])
    try {
      const recordingPath = window.api.path.join(folder, 'recording.wav')
      const txtPath = await window.api.whisper.transcribe(recordingPath)
      const text = await window.api.fs.readFile(txtPath)
      setTranscript(text)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed')
      setState('error')
    }
  }

  const handleImportModel = async () => {
    const ok = await window.api.recorder.importModel()
    if (ok) {
      const info = await window.api.recorder.check()
      setSetupInfo(info)
      if (info.modelExists && info.cliExists) setState('ready')
    }
  }

  const handleImportCli = async () => {
    const ok = await window.api.recorder.importCli()
    if (ok) {
      const info = await window.api.recorder.check()
      setSetupInfo(info)
      if (info.modelExists && info.cliExists) setState('ready')
    }
  }

  if (state === 'checking') return <p className="recorder-checking">Checking setup…</p>

  if (state === 'setup-needed' && setupInfo) {
    return (
      <div className="recorder-setup">
        <p className="recorder-setup-title">One-time setup required</p>
        <p className="recorder-setup-hint">
          Place files in: <code>{setupInfo.folderPath}</code>
          <button className="recorder-setup-open" onClick={() => window.api.recorder.openFolder()}>Open folder</button>
        </p>
        <div className="recorder-setup-items">
          <div className={`recorder-setup-item${setupInfo.cliExists ? ' ok' : ''}`}>
            <span>{setupInfo.cliExists ? '✓' : '○'} Whisper CLI (main.exe or whisper-cli.exe)</span>
            {!setupInfo.cliExists && (
              <button className="recorder-setup-btn" onClick={handleImportCli}>Import…</button>
            )}
          </div>
          <div className={`recorder-setup-item${setupInfo.modelExists ? ' ok' : ''}`}>
            <span>{setupInfo.modelExists ? '✓' : '○'} Model file (ggml-medium.en.bin)</span>
            {!setupInfo.modelExists && (
              <button className="recorder-setup-btn" onClick={handleImportModel}>Import…</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="meeting-recorder">
      {showRecorder && (
        <RecordingModal
          meetingTitle={meeting.title}
          meetingDate={meeting.date}
          nasPath={nasPath}
          onDone={handleRecordingDone}
          onClose={() => setShowRecorder(false)}
        />
      )}

      <div className="recorder-controls">
        {(state === 'ready' || state === 'error') && !meeting.recording_path && (
          <button className="recorder-btn recorder-btn-start" onClick={() => setShowRecorder(true)}>
            ● Start Recording
          </button>
        )}
        {state === 'transcribing' && (
          <div className="recorder-transcribing">
            <span className="recorder-spinner">⟳</span> Transcribing…
          </div>
        )}
        {(state === 'done' || meeting.recording_path) && (
          <span className="recorder-done">✓ Recording saved</span>
        )}
        {recordingFolder && (
          <span className="recorder-folder" title={recordingFolder}>
            📁 {window.api.path.basename(recordingFolder)}
          </span>
        )}
      </div>

      {error && <p className="recorder-error">⚠ {error}</p>}

      {state === 'transcribing' && progress.length > 0 && (
        <div className="recorder-progress">
          {progress.slice(-5).map((line, i) => (
            <div key={i} className="recorder-progress-line">{line}</div>
          ))}
        </div>
      )}

      {/* Notes */}
      <div className="recorder-notes">
        <div className="recorder-notes-header">
          <span className="recorder-transcript-label">Meeting Notes</span>
          {notesSaved && <span className="recorder-notes-saved">✓ Saved</span>}
        </div>
        <textarea
          className="recorder-notes-area"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesSaved(false) }}
          placeholder="Add notes, key decisions, action items…"
          rows={4}
        />
        <button
          className="recorder-notes-save"
          onClick={async () => {
            await window.api.meetings.update(meeting.id, { notes })
            setNotesSaved(true)
            setTimeout(() => setNotesSaved(false), 2000)
          }}
        >
          Save notes
        </button>
      </div>

      {transcript && (
        <div className="recorder-transcript">
          <div className="recorder-transcript-header">
            <span className="recorder-transcript-label">Transcript</span>
            <button className="recorder-transcript-copy" onClick={() => navigator.clipboard.writeText(transcript)}>
              Copy
            </button>
          </div>
          <pre className="recorder-transcript-text">{transcript}</pre>
        </div>
      )}
    </div>
  )
}
