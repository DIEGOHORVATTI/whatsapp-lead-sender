import { type ButtonHTMLAttributes, Component } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'
}

export default class Button extends Component<ButtonProps, unknown> {
  override render() {
    const { variant, children, ...buttonProps } = this.props
    const classNames = [
      'px-4',
      'py-2',
      'rounded-lg',
      'font-medium',
      'transition-all',
      'duration-200',
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-offset-1',
      'ring-transparent',
      'border',
      'border-transparent',
      'disabled:opacity-50',
      'disabled:cursor-not-allowed',
    ]

    switch (variant) {
      case 'primary':
        classNames.push(
          'bg-primary',
          'text-primary-foreground',
          'hover:shadow-md',
          'hover:opacity-90',
          'focus:ring-primary/40'
        )
        break
      case 'secondary':
        classNames.push(
          'bg-secondary',
          'text-secondary-foreground',
          'border-border',
          'hover:bg-accent',
          'focus:ring-primary/40'
        )
        break
      case 'success':
        classNames.push(
          'bg-success/12',
          'text-success',
          'hover:bg-success/20',
          'focus:ring-success/40'
        )
        break
      case 'danger':
        classNames.push(
          'bg-destructive/12',
          'text-destructive',
          'hover:bg-destructive/20',
          'focus:ring-destructive/40'
        )
        break
      case 'warning':
        classNames.push(
          'bg-warning/12',
          'text-warning',
          'hover:bg-warning/20',
          'focus:ring-warning/40'
        )
        break
      case 'info':
        classNames.push(
          'bg-primary/12',
          'text-primary',
          'hover:bg-primary/20',
          'focus:ring-primary/40'
        )
        break
      case 'light':
        classNames.push('bg-muted', 'text-foreground', 'hover:bg-accent', 'focus:ring-ring/40')
        break
      case 'dark':
        classNames.push('bg-foreground', 'text-background', 'hover:opacity-90', 'focus:ring-ring/40')
        break
    }

    return (
      <button
        {...buttonProps}
        className={[...classNames, ...(buttonProps.className ?? '').split(' ')].join(' ')}
      >
        {children}
      </button>
    )
  }
}
