import { fmtDate } from '@/lib/labels';
import type { InquiryMessage } from '@/lib/types';

interface Props {
  /** Oldest first — the most recent part of the conversation. */
  messages: InquiryMessage[];
  otherParty: string;
  /** true when older messages exist beyond the ones shown. */
  olderHidden?: boolean;
}

/** Follow-up messages of an inquiry, oldest first. */
export function MessageThread({ messages, otherParty, olderHidden = false }: Props) {
  if (!messages.length) {
    return (
      <div className="empty">
        <p>עדיין אין הודעות המשך בשיחה הזו.</p>
      </div>
    );
  }
  return (
    <>
      {olderHidden && (
        <p className="note dash-older-note">
          מוצגות {messages.length} ההודעות האחרונות בשיחה. הודעות ישנות יותר אינן מוצגות כאן.
        </p>
      )}
      <ol className="dash-msgs">
        {messages.map((m) => (
          <li key={m.id} className={`dash-msg ${m.mine ? 'mine' : 'theirs'}`}>
            <div className="dash-msg-meta">
              <b>{m.mine ? 'את/ה' : <bdi>{otherParty}</bdi>}</b>
              <time dateTime={m.createdAt}>{fmtDate(m.createdAt)}</time>
            </div>
            {/* dir="auto": a message typed in English keeps its own direction (punctuation, numbers). */}
            <p className="dash-msg-body" dir="auto">
              {m.body}
            </p>
          </li>
        ))}
      </ol>
    </>
  );
}
