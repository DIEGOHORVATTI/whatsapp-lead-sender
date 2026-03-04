import { Component } from 'react'

interface PreviewBubbleProps {
  message: string
  attachmentName?: string
  buttons?: { id: string; text: string }[]
}

export default class PreviewBubble extends Component<PreviewBubbleProps> {
  override render() {
    const { message, attachmentName, buttons } = this.props

    return (
      <div className="flex justify-end">
        <div
          className="relative max-w-[85%] rounded-lg rounded-tr-none px-3 py-2 shadow-sm"
          style={{ backgroundColor: '#d9fdd3' }}
        >
          {/* Tail */}
          <div
            className="absolute -right-2 top-0 w-0 h-0"
            style={{
              borderLeft: '8px solid #d9fdd3',
              borderTop: '8px solid #d9fdd3',
              borderRight: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderTopRightRadius: '4px',
            }}
          />

          {/* Attachment preview */}
          {attachmentName && (
            <div
              className="mb-1.5 px-2 py-1.5 bg-white/50 rounded flex items-center gap-2 text-xs"
              style={{ color: '#637381' }}
            >
              <span>📎</span>
              <span className="truncate">{attachmentName}</span>
            </div>
          )}

          {/* Message text */}
          <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#1C252E' }}>
            {message || (
              <span className="italic" style={{ color: '#919EAB' }}>
                Digite uma mensagem...
              </span>
            )}
          </p>

          {/* Buttons */}
          {buttons && buttons.length > 0 && (
            <div className="mt-2 pt-2 border-t border-black/10 flex flex-col gap-1">
              {buttons.map((btn) => (
                <div
                  key={btn.id}
                  className="text-center text-xs py-1.5 bg-white/60 rounded"
                  style={{ color: '#8E33FF' }}
                >
                  {btn.text}
                </div>
              ))}
            </div>
          )}

          {/* Timestamp */}
          <div className="flex justify-end mt-0.5">
            <span className="text-[10px]" style={{ color: '#919EAB' }}>
              {new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      </div>
    )
  }
}
