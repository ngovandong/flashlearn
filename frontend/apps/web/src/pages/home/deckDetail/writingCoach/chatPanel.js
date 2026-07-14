import React, { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import Avatar from "@mui/material/Avatar";
import SendIcon from "@mui/icons-material/Send";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { selectUser } from "@app/store/authSlice";
import DragonAvatar from "@components/dragonAvatar";
import FeedbackPanel from "./feedbackPanel";

// Chat mode: a two-pane layout — the conversation thread on the left and the
// feedback for the selected learner message on the right. The parent owns the
// session + AI calls; this is presentation + input handling.
export default function ChatPanel({
  session,
  activeMessageId,
  onSelectMessage,
  input,
  onInputChange,
  onSend,
  sending,
  onRestart,
  onSpeak,
  renderText,
  onSelectText,
}) {
  const threadRef = useRef(null);
  const user = useSelector(selectUser);
  const messages = session?.messages || [];

  const userAvatar = (
    <Avatar
      alt={user?.name || "You"}
      src={user?.image_url}
      sx={{ width: 32, height: 32, fontSize: "0.8rem" }}
    >
      {(user?.name || "Y").charAt(0).toUpperCase()}
    </Avatar>
  );
  const activeMessage = messages.find(
    (m) => m.id === activeMessageId && m.role === "user"
  );

  // Auto-scroll to the newest message as the conversation grows.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!sending && input.trim()) onSend();
  };

  return (
    <div className="wc-chat">
      <div className="wc-chat__head">
        <div>
          <span className="wc-chat__eyebrow">Chatting about</span>
          <h2>{session?.topic || "Free conversation"}</h2>
        </div>
        <button className="wc-btn wc-btn--ghost wc-btn--sm" onClick={onRestart}>
          <RestartAltIcon fontSize="small" /> Restart
        </button>
      </div>

      <div className="wc-chat__panes">
        <div className="wc-chat__convo">
          <div className="wc-chat__thread" ref={threadRef}>
            {messages.map((m) => {
              const isMe = m.role === "user";
              const isActive = isMe && m.id === activeMessageId;
              const hasIssues = isMe && (m.feedback?.hasIssues || (m.feedback?.mistakes || []).length > 0);
              return (
                <div
                  key={m.id}
                  className={`wc-msg ${isMe ? "wc-msg--me" : "wc-msg--dragon"} ${
                    isActive ? "wc-msg--active" : ""
                  }`}
                >
                  <div className="wc-msg__row">
                    <span className="wc-msg__avatar" aria-hidden={isMe ? undefined : true}>
                      {isMe ? userAvatar : <DragonAvatar size={32} />}
                    </span>
                    <div className="wc-msg__col">
                      <span className="wc-msg__speaker">{isMe ? "You" : "Dragon"}</span>
                      <div
                        className="wc-msg__bubble"
                        onClick={isMe ? () => onSelectMessage(m.id) : undefined}
                        role={isMe ? "button" : undefined}
                      >
                        <p
                          className="wc-msg__text"
                          onMouseUp={() => onSelectText?.(m.text)}
                        >
                          {renderText ? renderText(m.text) : m.text}
                        </p>
                        {!isMe && (
                          <button
                            className="wc-icon-btn wc-icon-btn--sm"
                            title="Listen"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSpeak?.(m.text);
                            }}
                          >
                            <VolumeUpIcon fontSize="small" />
                          </button>
                        )}
                      </div>
                      {isMe && (
                        <span className="wc-msg__hint">
                          {hasIssues ? "Has feedback — tap to view" : "Looks good — tap to view"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {sending && (
              <div className="wc-msg wc-msg--dragon">
                <div className="wc-msg__row">
                  <span className="wc-msg__avatar" aria-hidden>
                    <DragonAvatar size={32} />
                  </span>
                  <div className="wc-msg__col">
                    <span className="wc-msg__speaker">Dragon</span>
                    <div className="wc-msg__bubble wc-msg__bubble--typing">
                      <span className="wc-typing">
                        <i /> <i /> <i />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form className="wc-chat__compose" onSubmit={handleSend}>
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Write your reply in English…"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) handleSend(e);
              }}
            />
            <button
              type="submit"
              className="wc-btn wc-btn--primary"
              disabled={sending || !input.trim()}
            >
              <SendIcon fontSize="small" /> Send
            </button>
          </form>
        </div>

        <div className="wc-chat__feedback">
          <FeedbackPanel
            message={activeMessage}
            renderText={renderText}
            onSelect={onSelectText}
          />
        </div>
      </div>
    </div>
  );
}
