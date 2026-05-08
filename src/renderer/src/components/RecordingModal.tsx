import { useState, useEffect, useRef, useCallback } from 'react'

// Encode raw PCM samples to WAV (16kHz, mono, 16-bit) — Whisper's preferred format
function encodeWAV(chunks: Float32Array[], sampleRate: number): ArrayBuffer {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const buf = new ArrayBuffer(44 + total * 2)
  const v = new DataView(buf)
  const w = (off: number, s: string) => [...s].forEach((c, i) => v.setUint8(off + i, c.charCodeAt(0)))
  w(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); w(8, 'WAVE')
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, total * 2, true)
  let off = 44
  for (const chunk of chunks) {
    for (const s of chunk) {
      const c = Math.max(-1, Math.min(1, s))
      v.setInt16(off, c < 0 ? c * 0x8000 : c * 0x7FFF, true); off += 2
    }
  }
  return buf
}

interface ScreenSource {
  id: string
  name: string
  thumbnail: string
}

interface Props {
  meetingTitle: string
  meetingDate: string
  nasPath: string
  onDone: (recordingFolder: string) => void
  onClose: () => void
}

type RecordState = 'selecting' | 'recording' | 'paused' | 'saving'

function formatTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function sanitize(s: string): string {
  return s.replace(/[<>:"/\\|?*]/g, '_').slice(0, 60)
}

export default function RecordingModal({ meetingTitle, meetingDate, nasPath, onDone, onClose }: Props): JSX.Element {
  const [sources, setSources] = useState<ScreenSource[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [useMic, setUseMic] = useState(true)
  const [useCamera, setUseCamera] = useState(false)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState('')
  const [recordState, setRecordState] = useState<RecordState>('selecting')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')

  // Preview video elements
  const screenPreviewRef = useRef<HTMLVideoElement>(null)
  const cameraPreviewRef = useRef<HTMLVideoElement>(null)

  // Streams
  const previewScreenStreamRef = useRef<MediaStream | null>(null)
  const previewCameraStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)

  // Recording internals
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animFrameRef = useRef<number>(0)

  // WAV audio capture for Whisper
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioSamplesRef = useRef<Float32Array[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scriptProcessorRef = useRef<any>(null)

  useEffect(() => {
    window.api.recorder.getSources().then(setSources)
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const cams = devices.filter((d) => d.kind === 'videoinput')
      setCameras(cams)
      if (cams.length) setSelectedCamera(cams[0].deviceId)
    })
  }, [])

  // Start screen preview when source selected
  useEffect(() => {
    previewScreenStreamRef.current?.getTracks().forEach((t) => t.stop())
    previewScreenStreamRef.current = null
    if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null
    if (!selectedId) return

    navigator.mediaDevices.getUserMedia({
      audio: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: selectedId } } as any
    }).then((stream) => {
      previewScreenStreamRef.current = stream
      if (screenPreviewRef.current) screenPreviewRef.current.srcObject = stream
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Could not preview screen')
    })
  }, [selectedId])

  // Start/stop camera preview
  useEffect(() => {
    previewCameraStreamRef.current?.getTracks().forEach((t) => t.stop())
    previewCameraStreamRef.current = null
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null
    if (!useCamera || !selectedCamera) return

    navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: selectedCamera } },
      audio: false
    }).then((stream) => {
      previewCameraStreamRef.current = stream
      if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = stream
    }).catch(() => {})
  }, [useCamera, selectedCamera])

  const stopAll = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    scriptProcessorRef.current?.disconnect()
    scriptProcessorRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    previewScreenStreamRef.current?.getTracks().forEach((t) => t.stop())
    previewScreenStreamRef.current = null
    previewCameraStreamRef.current?.getTracks().forEach((t) => t.stop())
    previewCameraStreamRef.current = null
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null
  }, [])

  const handleStart = useCallback(async () => {
    if (!selectedId || !previewScreenStreamRef.current) return
    setError('')
    try {
      const screenStream = previewScreenStreamRef.current

      if (useMic) {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })

        // Capture raw PCM at 16kHz for WAV export (Whisper's preferred format)
        const audioCtx = new AudioContext({ sampleRate: 16000 })
        audioCtxRef.current = audioCtx
        audioSamplesRef.current = []
        const source = audioCtx.createMediaStreamSource(micStreamRef.current)
        // ScriptProcessor is deprecated but universally supported; AudioWorklet adds more complexity
        const processor = audioCtx.createScriptProcessor(4096, 1, 1)
        processor.onaudioprocess = (e) => {
          audioSamplesRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)))
        }
        source.connect(processor)
        processor.connect(audioCtx.destination)
        scriptProcessorRef.current = processor
      }

      // Build canvas from preview video elements
      const canvas = document.createElement('canvas')
      const track = screenStream.getVideoTracks()[0]
      const { width = 1280, height = 720 } = track.getSettings()
      canvas.width = Math.min(width, 1920)
      canvas.height = Math.min(height, 1080)
      const ctx = canvas.getContext('2d')!

      const draw = () => {
        if (screenPreviewRef.current && screenPreviewRef.current.readyState >= 2) {
          ctx.drawImage(screenPreviewRef.current, 0, 0, canvas.width, canvas.height)
        }
        if (cameraPreviewRef.current && cameraPreviewRef.current.readyState >= 2 && useCamera) {
          const pw = Math.round(canvas.width * 0.22)
          const ph = Math.round(pw * (9 / 16))
          ctx.drawImage(cameraPreviewRef.current, canvas.width - pw - 16, canvas.height - ph - 16, pw, ph)
        }
        animFrameRef.current = requestAnimationFrame(draw)
      }
      draw()

      const canvasStream = canvas.captureStream(24)
      micStreamRef.current?.getAudioTracks().forEach((t) => canvasStream.addTrack(t))

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus' : 'video/webm'

      const recorder = new MediaRecorder(canvasStream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start(1000)
      recorderRef.current = recorder

      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
      setRecordState('recording')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start recording')
    }
  }, [selectedId, useMic, useCamera])

  const handlePause = () => {
    recorderRef.current?.pause()
    cancelAnimationFrame(animFrameRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    setRecordState('paused')
  }

  const handleResume = () => {
    recorderRef.current?.resume()
    const draw = () => {
      // canvas draw continues
      animFrameRef.current = requestAnimationFrame(draw)
    }
    draw()
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    setRecordState('recording')
  }

  const handleStop = useCallback(async () => {
    if (!recorderRef.current) return
    cancelAnimationFrame(animFrameRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    setRecordState('saving')

    await new Promise<void>((resolve) => {
      recorderRef.current!.onstop = () => resolve()
      recorderRef.current!.stop()
    })

    // Disconnect audio capture before closing streams
    scriptProcessorRef.current?.disconnect()
    scriptProcessorRef.current = null
    await audioCtxRef.current?.close()
    audioCtxRef.current = null

    stopAll()

    const dateStr = meetingDate.slice(0, 10)
    const folder = window.api.path.join(nasPath, 'Meeting Recordings', `${dateStr}_${sanitize(meetingTitle)}`)
    await window.api.fs.mkdir(folder)

    // Save video recording
    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    const videoBuffer = await blob.arrayBuffer()
    await window.api.recorder.save(videoBuffer, window.api.path.join(folder, 'recording.webm'))

    // Save WAV audio for Whisper (Windows MF handles WAV reliably)
    if (audioSamplesRef.current.length > 0) {
      const wavBuffer = encodeWAV(audioSamplesRef.current, 16000)
      await window.api.recorder.save(wavBuffer, window.api.path.join(folder, 'recording.wav'))
    }

    onDone(folder)
  }, [meetingDate, meetingTitle, nasPath, onDone, stopAll])

  const handleClose = () => {
    if (recordState === 'recording' || recordState === 'paused') {
      if (!confirm('Stop recording and discard?')) return
      recorderRef.current?.stop()
    }
    stopAll()
    onClose()
  }

  const screens = sources.filter((s) => s.id.startsWith('screen:'))
  const windows = sources.filter((s) => s.id.startsWith('window:'))
  const isActive = recordState === 'recording' || recordState === 'paused'

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal modal-recorder" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <h3 className="modal-title">Record Meeting</h3>
          <button className="modal-close-x" onClick={handleClose}>×</button>
        </div>

        {/* Preview area — always visible once a source is selected */}
        <div className="rec-preview-wrap">
          {!selectedId && (
            <div className="rec-preview-placeholder">
              Select a screen or window below to preview
            </div>
          )}
          <video
            ref={screenPreviewRef}
            className="rec-preview-video"
            autoPlay
            muted
            style={{ display: selectedId ? 'block' : 'none' }}
          />
          {useCamera && (
            <video
              ref={cameraPreviewRef}
              className="rec-camera-pip"
              autoPlay
              muted
            />
          )}
          {isActive && (
            <div className={`rec-timer-overlay${recordState === 'paused' ? ' paused' : ''}`}>
              {recordState === 'paused' ? '⏸' : '●'} {formatTime(elapsed)}
            </div>
          )}
          {recordState === 'saving' && (
            <div className="rec-saving-overlay">Saving…</div>
          )}
        </div>

        {/* Controls shown during recording */}
        {isActive && (
          <div className="rec-active-controls">
            {recordState === 'recording'
              ? <button className="btn-rec-pause" onClick={handlePause}>⏸ Pause</button>
              : <button className="btn-rec-resume" onClick={handleResume}>▶ Resume</button>
            }
            <button className="btn-rec-stop" onClick={handleStop}>⏹ Stop & Save</button>
          </div>
        )}

        {/* Source selection — shown only before recording */}
        {recordState === 'selecting' && (
          <>
            <div className="rec-section">
              <p className="rec-section-label">Select screen or window</p>
              <div className="rec-source-row">
                {screens.map((s) => (
                  <button
                    key={s.id}
                    className={`rec-source-tile${selectedId === s.id ? ' selected' : ''}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <img src={s.thumbnail} alt={s.name} className="rec-thumbnail" />
                    <span className="rec-source-name">{s.name}</span>
                  </button>
                ))}
                {windows.map((s) => (
                  <button
                    key={s.id}
                    className={`rec-source-tile${selectedId === s.id ? ' selected' : ''}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <img src={s.thumbnail} alt={s.name} className="rec-thumbnail" />
                    <span className="rec-source-name">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rec-section rec-toggles-row">
              <label className="rec-toggle">
                <input type="checkbox" checked={useMic} onChange={(e) => setUseMic(e.target.checked)} />
                🎤 Microphone
              </label>
              {cameras.length > 0 && (
                <label className="rec-toggle">
                  <input type="checkbox" checked={useCamera} onChange={(e) => setUseCamera(e.target.checked)} />
                  📷 Camera PIP
                  {useCamera && cameras.length > 1 && (
                    <select
                      className="rec-cam-select"
                      value={selectedCamera}
                      onChange={(e) => setSelectedCamera(e.target.value)}
                    >
                      {cameras.map((c) => (
                        <option key={c.deviceId} value={c.deviceId}>
                          {c.label || `Camera ${c.deviceId.slice(0, 6)}`}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              )}
            </div>

            {error && <p className="recorder-error">⚠ {error}</p>}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn-record-start" disabled={!selectedId} onClick={handleStart}>
                ● Start Recording
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
