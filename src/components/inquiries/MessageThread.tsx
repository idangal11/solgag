import { fmtDate } from '@/lib/labels';
import type { InquiryMessage } from '@/lib/types';

/** Follow-up messages of an inquiry, oldest first. */
export function MessageThread({ messages, otherParty }: { messages: InquiryMessage[]; otherParty: string }) {
  if (!messages.length) {
    return (
      <div className="empty">
        <p>עדיין אין הודעות המשך בשיחה הזו.</p>
      </div>
    );
  }
  return (
    <ol className="dash-msgs">
      {messages.map((m) => (
        <li key={m.id} className={`dash-msg ${m.mine ? 'mine' : 'theirs'}`}>
          <div className="dash-msg-meta">
            <b>{m.mine ? 'את/ה' : otherParty}</b>
            <time dateTime={m.createdAt}>{fmtDate(m.createdAt)}</time>
          </div>
          <p className="dash-msg-body">{m.body}</p>
        </li>
      ))}
    </ol>
  );
}
