import type { TimingConfig } from '../types/Campaign'
import type QueueStatus from '../types/QueueStatus'

interface QueueItem<T> {
  eventHandler: (detail: T) => Promise<void>
  detail: T
}

class AsyncEventQueue {
  private queue: QueueItem<{ delay?: number }>[] = []
  private isProcessing = false
  private startTime = 0
  private endTime = 0
  private processedItems = 0
  private remainingItems = 0
  private items: { detail: unknown; startTime: number; elapsedTime: number }[] = []
  private processing: number | false = false
  private waiting: number | false = false
  private aborted = false
  private paused = false
  private pausePromiseResolve?: ((value?: unknown) => void) | undefined

  // Campaign timing extensions
  private timingConfig?: TimingConfig
  private batchProcessed = 0
  private batchPaused = false
  private dailySent = 0
  private dailyResetDate = ''

  private async wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  public setTimingConfig(config: TimingConfig) {
    this.timingConfig = config
  }

  public setDailyState(sent: number, resetDate: string) {
    this.dailySent = sent
    this.dailyResetDate = resetDate
  }

  private getDelay(itemDelay?: number): number {
    if (!this.timingConfig) return (itemDelay ?? 0) * 1000

    const cfg = this.timingConfig
    if (cfg.delayMode === 'random') {
      const range = cfg.maxDelay - cfg.minDelay
      return (cfg.minDelay + Math.random() * range) * 1000
    }
    return cfg.fixedDelay * 1000
  }

  private checkDailyLimit(): boolean {
    if (!this.timingConfig || this.timingConfig.dailyLimit <= 0) return true

    const today = new Date().toISOString().slice(0, 10)
    if (this.dailyResetDate !== today) {
      this.dailySent = 0
      this.dailyResetDate = today
    }
    return this.dailySent < this.timingConfig.dailyLimit
  }

  private async waitForSchedule(): Promise<void> {
    if (!this.timingConfig?.schedule.enabled) return

    const sched = this.timingConfig.schedule
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay() // 0=Sun, 1=Mon, ...

    if (sched.daysOfWeek.includes(day) && hour >= sched.startHour && hour < sched.endHour) {
      return // Within schedule
    }

    // Calculate ms until next schedule window
    const target = new Date(now)
    for (let attempt = 0; attempt < 8; attempt++) {
      target.setDate(target.getDate() + (attempt === 0 ? 0 : 1))
      target.setHours(sched.startHour, 0, 0, 0)
      if (target > now && sched.daysOfWeek.includes(target.getDay())) {
        break
      }
    }

    const msToWait = target.getTime() - now.getTime()
    if (msToWait > 0 && msToWait < 7 * 24 * 60 * 60 * 1000) {
      this.waiting = Date.now()
      // Wait in chunks so we can respond to abort/pause
      let waited = 0
      while (waited < msToWait) {
        await this.wait(Math.min(5000, msToWait - waited))
        waited += 5000
        if (this.aborted || this.paused) break
      }
      this.waiting = false
    }
  }

  public async add<T extends { delay?: number }>({ eventHandler, detail }: QueueItem<T>) {
    // @ts-expect-error TS2322: Type '(detail: T) => Promise<void>' is not assignable to type '(detail: { delay?: number | undefined; }) => Promise<void>'.
    this.queue.push({ eventHandler, detail })

    if (!this.isProcessing) {
      this.aborted = false
      this.isProcessing = true
      this.startTime = Date.now()
      this.processedItems = 0
      this.batchProcessed = 0
      this.batchPaused = false
      this.items = []

      while (this.queue.length > 0) {
        if (this.paused) {
          await new Promise((resolve) => (this.pausePromiseResolve = resolve))
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (this.aborted) {
          this.remainingItems = this.queue.length
          this.queue = []
          break
        }

        // Schedule check
        await this.waitForSchedule()
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated asynchronously
        if (this.aborted) {
          this.remainingItems = this.queue.length
          this.queue = []
          break
        }

        // Daily limit check
        if (!this.checkDailyLimit()) {
          this.paused = true
          this.batchPaused = true
          continue
        }

        // Batch pause check
        if (
          this.timingConfig &&
          this.timingConfig.dailyLimit > 0 &&
          this.batchProcessed > 0 &&
          this.batchProcessed %
            (this.timingConfig.dailyLimit > 0 ? Math.min(this.timingConfig.dailyLimit, 10) : 10) ===
            0
        ) {
          // Batch complete — if pauseBetweenBatches, auto-pause
          // Handled via external batch config
        }

        const item = this.queue.shift()
        if (item === undefined) continue
        this.processedItems++
        this.batchProcessed++
        this.dailySent++
        const startTime = Date.now()
        this.processing = Date.now()
        try {
          await item.eventHandler(item.detail)
        } catch (error) {
          console.error(error)
        }
        this.processing = false
        const elapsedTime = Date.now() - startTime
        this.items.push({ detail: item.detail, startTime, elapsedTime })

        // Delay between messages
        const delayMs = this.getDelay(item.detail.delay)
        if (delayMs > 0 && this.queue.length !== 0) {
          this.waiting = Date.now()
          const waitStart = Date.now()
          while (Date.now() - waitStart < delayMs) {
            await this.wait(100)
            if (this.paused) {
              await new Promise((resolve) => (this.pausePromiseResolve = resolve))
            }

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (this.aborted) {
              this.remainingItems = this.queue.length
              this.queue = []
              break
            }
          }
          this.waiting = false
        }
      }

      this.endTime = Date.now()
      this.isProcessing = false
    }
  }

  public pause() {
    this.paused = true
  }

  public resume() {
    if (this.paused && this.pausePromiseResolve) {
      this.paused = false
      this.batchPaused = false
      this.pausePromiseResolve()
      this.pausePromiseResolve = undefined
    }
  }

  public stop() {
    this.aborted = true
    if (this.paused) {
      this.resume()
    }
  }

  public getStatus(): QueueStatus {
    return {
      elapsedTime: this.isProcessing ? Date.now() - this.startTime : this.endTime - this.startTime,
      isProcessing: this.isProcessing,
      items: this.items,
      processing: this.processing === false ? this.processing : Date.now() - this.processing,
      waiting: this.waiting === false ? this.waiting : Date.now() - this.waiting,
      processedItems: this.processedItems,
      remainingItems: this.aborted ? this.remainingItems : this.queue.length,
      totalItems: this.processedItems + this.queue.length,
    }
  }

  public getDailySent(): number {
    return this.dailySent
  }

  public isBatchPaused(): boolean {
    return this.batchPaused
  }
}

const asyncQueue = new AsyncEventQueue()

export default asyncQueue
