import { Component, createRef, type RefObject } from 'react'

interface SelectMultiAutoCompleteProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  className?: string
}

interface SelectMultiAutoCompleteState {
  open: boolean
  search: string
}

export default class SelectMultiAutoComplete extends Component<
  SelectMultiAutoCompleteProps,
  SelectMultiAutoCompleteState
> {
  private containerRef: RefObject<HTMLDivElement> = createRef()

  constructor(props: SelectMultiAutoCompleteProps) {
    super(props)
    this.state = { open: false, search: '' }
  }

  override componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside)
  }

  override componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside)
  }

  private handleClickOutside = (e: MouseEvent) => {
    if (
      this.containerRef.current &&
      e.target instanceof Node &&
      !this.containerRef.current.contains(e.target)
    ) {
      this.setState({ open: false, search: '' })
    }
  }

  private toggle = (value: string) => {
    const { selected, onChange } = this.props
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value))
    } else {
      onChange([...selected, value])
    }
  }

  private removeChip = (value: string, e: React.MouseEvent) => {
    e.stopPropagation()
    this.props.onChange(this.props.selected.filter((s) => s !== value))
  }

  override render() {
    const { label, options, selected, className = '' } = this.props
    const { open, search } = this.state

    const searchLower = search.toLowerCase()
    const filtered = search ? options.filter((o) => o.toLowerCase().includes(searchLower)) : options

    return (
      <div ref={this.containerRef} className={`relative ${className}`}>
        {/* Trigger */}
        <div
          onClick={() => {
            this.setState({ open: !open })
          }}
          className="w-full flex-auto bg-muted text-foreground border border-input p-1 rounded-lg cursor-pointer min-h-[28px] flex items-center gap-1 flex-wrap transition-shadow ease-in-out duration-150 focus-within:shadow-equal focus-within:shadow-ring"
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground text-xs px-0.5">{label}</span>
          ) : (
            <>
              {selected.slice(0, 2).map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-primary/15 text-primary rounded-full max-w-[80px] truncate"
                >
                  <span className="truncate">{v}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      this.removeChip(v, e)
                    }}
                    className="w-3 h-3 flex items-center justify-center rounded-full text-[8px] hover:bg-primary/20 shrink-0"
                  >
                    x
                  </button>
                </span>
              ))}
              {selected.length > 2 && (
                <span className="text-[10px] text-muted-foreground px-0.5">
                  +{selected.length - 2}
                </span>
              )}
            </>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
            {open ? '\u25B2' : '\u25BC'}
          </span>
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-lg max-h-48 flex flex-col">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                this.setState({ search: e.target.value })
              }}
              placeholder={`${label}...`}
              className="px-2 py-1.5 text-xs border-b border-border bg-muted text-foreground placeholder:text-muted-foreground outline-none rounded-t-lg"
              autoFocus
            />
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground text-center">--</div>
              ) : (
                filtered.map((opt) => {
                  const isSelected = selected.includes(opt)
                  return (
                    <div
                      key={opt}
                      onClick={() => {
                        this.toggle(opt)
                      }}
                      className={`px-2 py-1 text-xs cursor-pointer flex items-center gap-1.5 hover:bg-muted/60 transition-colors ${
                        isSelected ? 'bg-primary/8 font-medium' : ''
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-primary border-primary text-white' : 'border-input'
                        }`}
                      >
                        {isSelected && <span className="text-[9px] leading-none">{'\u2713'}</span>}
                      </span>
                      <span className="truncate">{opt}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
}
