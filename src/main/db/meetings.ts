import { getDb } from '.'
import type { Meeting, NewMeeting, UpdateMeeting } from '../../shared/types'

const UPDATABLE: (keyof UpdateMeeting)[] = [
  'title',
  'date',
  'recording_path',
  'calendar_event_id',
  'notes'
]

export function listMeetings(projectId: number): Meeting[] {
  return getDb()
    .prepare('SELECT * FROM meetings WHERE project_id = ? ORDER BY date DESC')
    .all(projectId) as Meeting[]
}

export function getMeeting(id: number): Meeting | undefined {
  return getDb()
    .prepare('SELECT * FROM meetings WHERE id = ?')
    .get(id) as Meeting | undefined
}

export function createMeeting(data: NewMeeting): Meeting {
  const { lastInsertRowid } = getDb()
    .prepare(
      'INSERT INTO meetings (project_id, title, date, recording_path, calendar_event_id) VALUES (?, ?, ?, ?, ?)'
    )
    .run(
      data.project_id,
      data.title,
      data.date,
      data.recording_path ?? null,
      data.calendar_event_id ?? null
    )
  return getMeeting(Number(lastInsertRowid))!
}

export function updateMeeting(id: number, data: UpdateMeeting): Meeting | undefined {
  const cols = UPDATABLE.filter((k) => k in data)
  if (cols.length === 0) return getMeeting(id)
  const sql = `UPDATE meetings SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`
  getDb()
    .prepare(sql)
    .run(...cols.map((c) => data[c] ?? null), id)
  return getMeeting(id)
}

export function deleteMeeting(id: number): boolean {
  const { changes } = getDb()
    .prepare('DELETE FROM meetings WHERE id = ?')
    .run(id)
  return changes > 0
}

export function listLinkedMeetings(): { meeting_id: number; calendar_event_id: string; project_name: string }[] {
  return getDb()
    .prepare(`
      SELECT m.id AS meeting_id, m.calendar_event_id, p.name AS project_name
      FROM meetings m
      JOIN projects p ON m.project_id = p.id
      WHERE m.calendar_event_id IS NOT NULL
    `)
    .all() as { meeting_id: number; calendar_event_id: string; project_name: string }[]
}
