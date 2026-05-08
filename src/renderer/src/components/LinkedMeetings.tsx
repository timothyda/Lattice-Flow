import { useState, useEffect } from 'react'
import type { Meeting } from '../../../shared/types'
import MeetingRecorder from './MeetingRecorder'

interface Props {
  projectId: number
  nasPath: string
  refreshKey?: number
}

export default function LinkedMeetings({ projectId, nasPath, refreshKey }: Props): JSX.Element | null {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    window.api.meetings.list(projectId).then(setMeetings)
  }, [projectId, refreshKey])

  const handleRecordingPathSaved = async (meetingId: number, folder: string) => {
    await window.api.meetings.update(meetingId, { recording_path: folder })
    setMeetings((prev) => prev.map((m) => m.id === meetingId ? { ...m, recording_path: folder } : m))
  }

  if (!meetings.length) return null

  return (
    <div className="linked-meetings">
      <h3 className="linked-meetings-title">Meetings</h3>
      <ul className="linked-meetings-list">
        {meetings.map((m) => (
          <li key={m.id} className="lm-item">
            <div className="lm-header" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
              <span className="lm-icon">{m.recording_path ? '🎙' : m.calendar_event_id ? '🔗' : '📅'}</span>
              <div className="lm-body">
                <span className="lm-title">{m.title}</span>
                <span className="lm-date">
                  {new Date(m.date).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </span>
              </div>
              <span className="lm-chevron">{expanded === m.id ? '▲' : '▼'}</span>
            </div>

            {expanded === m.id && (
              <div className="lm-recorder-wrap">
                <MeetingRecorder
                  meeting={m}
                  nasPath={nasPath}
                  onRecordingPathSaved={(folder) => handleRecordingPathSaved(m.id, folder)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
