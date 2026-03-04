import { Component, createRef, type RefObject } from 'react'

interface TabItem {
  key: string
  label: string
  badge?: boolean
}

interface ScrollableTabBarProps {
  tabs: TabItem[]
  activeTab: string
  onTabChange: (key: string) => void
}

interface ScrollableTabBarState {
  showLeft: boolean
  showRight: boolean
}

export default class ScrollableTabBar extends Component<ScrollableTabBarProps, ScrollableTabBarState> {
  private containerRef: RefObject<HTMLDivElement> = createRef<HTMLDivElement>()

  constructor(props: ScrollableTabBarProps) {
    super(props)
    this.state = { showLeft: false, showRight: false }
  }

  override componentDidMount() {
    this.checkOverflow()
    window.addEventListener('resize', this.checkOverflow)
  }

  override componentDidUpdate(prevProps: ScrollableTabBarProps) {
    if (prevProps.tabs.length !== this.props.tabs.length) {
      this.checkOverflow()
    }
  }

  override componentWillUnmount() {
    window.removeEventListener('resize', this.checkOverflow)
  }

  private checkOverflow = () => {
    const el = this.containerRef.current
    if (!el) return
    this.setState({
      showLeft: el.scrollLeft > 2,
      showRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    })
  }

  private scroll = (direction: number) => {
    const el = this.containerRef.current
    if (!el) return
    el.scrollBy({ left: direction * 120, behavior: 'smooth' })
    setTimeout(this.checkOverflow, 200)
  }

  override render() {
    const { tabs, activeTab, onTabChange } = this.props
    const { showLeft, showRight } = this.state

    return (
      <div className="relative border-b border-border bg-card shrink-0">
        {showLeft && (
          <button
            type="button"
            onClick={() => {
              this.scroll(-1)
            }}
            className="absolute left-0 top-0 bottom-0 z-10 w-6 flex items-center justify-center bg-gradient-to-r from-card to-transparent text-muted-foreground hover:text-foreground"
          >
            ‹
          </button>
        )}
        <div
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          ref={this.containerRef as React.LegacyRef<HTMLDivElement>}
          className="flex overflow-x-auto scrollbar-hide"
          onScroll={this.checkOverflow}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tabs.map(({ key, label, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onTabChange(key)
              }}
              className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors relative whitespace-nowrap ${
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {badge && (
                <span className="ml-1 w-1.5 h-1.5 bg-success rounded-full inline-block animate-pulse" />
              )}
            </button>
          ))}
        </div>
        {showRight && (
          <button
            type="button"
            onClick={() => {
              this.scroll(1)
            }}
            className="absolute right-0 top-0 bottom-0 z-10 w-6 flex items-center justify-center bg-gradient-to-l from-card to-transparent text-muted-foreground hover:text-foreground"
          >
            ›
          </button>
        )}
      </div>
    )
  }
}
