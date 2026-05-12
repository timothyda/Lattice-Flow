import { useState, useEffect, useRef } from 'react'
import type { TaskComment, User, Todo } from '../../../shared/types'

interface Props {
  todo: Todo
  currentUser: User | null
  orgUsers: User[]
  onClose: () => void
}

function fmtDateTime(dtStr: string): string {
  return new Date(dtStr.replace(' ', 'T') + 'Z').toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function renderWithMentions(content: string, users: User[]): JSX.Element {
  if (users.length === 0) return <>{content}</>
  const escaped = users.map((u) => u.display_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`@(${escaped.join('|')})`, 'g')
  const parts: (string | JSX.Element)[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > last) parts.push(content.slice(last, match.index))
    parts.push(
      <span key={match.index} style={{ color: '#0073ea', fontWeight: 600, background: '#e6f2ff', borderRadius: 4, padding: '0 3px' }}>
        @{match[1]}
      </span>
    )
    last = match.index + match[0].length
  }
  if (last < content.length) parts.push(content.slice(last))
  return <>{parts}</>
}

function getMentionQuery(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos)
  const match = before.match(/@([^@\n]*)$/)
  if (!match) return null
  return match[1]
}

export default function TaskCommentModal({ todo, currentUser, orgUsers, onClose }: Props): JSX.Element {
  const [comments,      setComments]      = useState<TaskComment[]>([])
  const [text,          setText]          = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [mentionQuery,  setMentionQuery]  = useState<string | null>(null)
  const [mentionIndex,  setMentionIndex]  = useState(0)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.api.comments.list(todo.id).then((cs) => {
      setComments(cs as TaskComment[])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })
    if (currentUser) window.api.comments.markRead(todo.id, currentUser.id)
  }, [todo.id, currentUser])

  const filteredUsers = mentionQuery !== null
    ? orgUsers.filter((u) => u.display_name.toLowerCase().startsWith(mentionQuery.toLowerCase()) && u.id !== currentUser?.id)
    : []

  const selectMention = (user: User) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart ?? text.length
    const before = text.slice(0, cursor)
    const after  = text.slice(cursor)
    const replaced = before.replace(/@([^@\n]*)$/, `@${user.display_name} `)
    setText(replaced + after)
    setMentionQuery(null)
    setTimeout(() => {
      textarea.focus()
      const pos = replaced.length
      textarea.setSelectionRange(pos, pos)
    }, 0)
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setText(val)
    const query = getMentionQuery(val, cursor)
    setMentionQuery(query)
    setMentionIndex(0)
  }

  const handleSubmit = async () => {
    if (!text.trim() || !currentUser || submitting) return
    setSubmitting(true)
    const comment = await window.api.comments.add(todo.id, currentUser.id, currentUser.display_name, text.trim())
    setComments((prev) => [...prev, comment as TaskComment])
    setText('')
    setMentionQuery(null)
    setSubmitting(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const handleDelete = async (id: number) => {
    if (!currentUser) return
    const ok = await window.api.comments.delete(id, currentUser.id)
    if (ok) setComments((prev) => prev.filter((c) => c.id !== id))
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown')              { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, filteredUsers.length - 1)) }
      else if (e.key === 'ArrowUp')           { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(filteredUsers[mentionIndex]) }
      else if (e.key === 'Escape')            { setMentionQuery(null) }
      return
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-comments" onClick={(e) => e.stopPropagation()}>
        <div className="comment-modal-header">
          <div className="comment-modal-task-title">{todo.title}</div>
          <button className="modal-close-btn" onClick={onClose} title="Close">×</button>
        </div>

        <div className="comment-list">
          {comments.length === 0 && (
            <p className="comment-empty">No comments yet. Start the conversation!</p>
          )}
          {comments.map((c) => {
            const isOwn = c.user_id === currentUser?.id
            return (
              <div key={c.id} className={`comment-item${isOwn ? ' own' : ''}`}>
                <div className="comment-meta">
                  <span className="comment-author">{c.user_name}</span>
                  <span className="comment-time">{fmtDateTime(c.created_at)}</span>
                  {isOwn && (
                    <button className="comment-delete-btn" onClick={() => handleDelete(c.id)} title="Delete">×</button>
                  )}
                </div>
                <div className="comment-body">{renderWithMentions(c.content, orgUsers)}</div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {currentUser ? (
          <div className="comment-input-area" style={{ position: 'relative' }}>
            {/* @mention dropdown */}
            {mentionQuery !== null && filteredUsers.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4,
                background: '#fff', border: '1px solid #e6e9f0', borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden',
              }}>
                {filteredUsers.map((u, i) => (
                  <button
                    key={u.id}
                    onMouseDown={(e) => { e.preventDefault(); selectMention(u) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '7px 12px', background: i === mentionIndex ? '#f0f2f8' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#323338',
                    }}
                  >
                    {u.avatar_url
                      ? <img src={u.avatar_url} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                      : <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0073ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{u.display_name.charAt(0).toUpperCase()}</span>
                    }
                    {u.display_name}
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              className="comment-textarea"
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKey}
              placeholder="Write a comment… type @ to mention someone (Ctrl+Enter to send)"
              rows={3}
            />
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
            >
              {submitting ? 'Sending…' : 'Send'}
            </button>
          </div>
        ) : (
          <p className="comment-empty" style={{ marginTop: 12 }}>Sign in to comment.</p>
        )}
      </div>
    </div>
  )
}
