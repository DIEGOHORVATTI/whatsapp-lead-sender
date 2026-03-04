import { Component, type HTMLAttributes, type ReactNode } from 'react'

interface BoxProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  headerButtons?: ReactNode
  bodyClassName?: string
  footer?: ReactNode
}

export default class Box extends Component<BoxProps, unknown> {
  override render() {
    const {
      className = '',
      bodyClassName = '',
      children,
      title,
      headerButtons,
      footer,
      ...boxProps
    } = this.props
    return (
      <div
        {...boxProps}
        className={[
          'max-w-xl',
          'mx-auto',
          'flex',
          'flex-col',
          'bg-card',
          'text-card-foreground',
          'shadow-lg',
          'rounded-lg',
          ...className.split(' '),
        ].join(' ')}
      >
        {(Boolean(title) || headerButtons) && (
          <div
            className={[
              'p-4',
              'border-b',
              'border-border',
              'flex',
              'justify-between',
              'items-center',
            ].join(' ')}
          >
            {title && <h1 className={['text-lg', 'font-semibold'].join(' ')}>{title}</h1>}
            {headerButtons}
          </div>
        )}
        <div
          className={['flex-auto', 'flex', 'flex-col', 'gap-4', ...bodyClassName.split(' ')].join(
            ' '
          )}
        >
          {children}
        </div>
        {footer && (
          <div className={['px-4', 'py-2', 'border-t', 'border-border'].join(' ')}>{footer}</div>
        )}
      </div>
    )
  }
}
