import { Component } from 'react'
import { t } from '../../utils/i18n'

interface CountdownBarProps {
  totalMs: number
  startedAt: number
}

interface CountdownBarState {
  remainingMs: number
}

export default class CountdownBar extends Component<CountdownBarProps, CountdownBarState> {
  private interval: ReturnType<typeof setInterval> | null = null

  constructor(props: CountdownBarProps) {
    super(props)
    this.state = {
      remainingMs: props.totalMs - (Date.now() - props.startedAt),
    }
  }

  override componentDidMount() {
    this.interval = setInterval(() => {
      const remaining = this.props.totalMs - (Date.now() - this.props.startedAt)
      this.setState({ remainingMs: Math.max(0, remaining) })
    }, 100)
  }

  override componentWillUnmount() {
    if (this.interval) clearInterval(this.interval)
  }

  override render() {
    const { totalMs } = this.props
    const { remainingMs } = this.state
    const progress = totalMs > 0 ? remainingMs / totalMs : 0
    const seconds = Math.ceil(remainingMs / 1000)

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{t('next_send_in', { seconds })}</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${String(progress * 100)}%` }}
          />
        </div>
      </div>
    )
  }
}
