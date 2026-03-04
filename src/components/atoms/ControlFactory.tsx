import {
  Component,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

const classNames = [
  'w-full',
  'flex-auto',
  'bg-muted',
  'text-foreground',
  'border',
  'border-input',
  'p-1',
  'rounded-lg',
  'transition-shadow',
  'ease-in-out',
  'duration-150',
  'focus:shadow-equal',
  'focus:shadow-ring',
  'focus:outline-none',
  'placeholder:text-muted-foreground',
]

export class ControlInput extends Component<InputHTMLAttributes<HTMLInputElement>> {
  override render() {
    const { className = '' } = this.props

    return <input {...this.props} className={[...classNames, ...className.split(' ')].join(' ')} />
  }
}

export class ControlTextArea extends Component<TextareaHTMLAttributes<HTMLTextAreaElement>> {
  override render() {
    const { className = '' } = this.props
    return (
      <textarea {...this.props} className={[...classNames, ...className.split(' ')].join(' ')} />
    )
  }
}

export class ControlSelect extends Component<SelectHTMLAttributes<HTMLSelectElement>> {
  override render() {
    const { className = '', children } = this.props
    return (
      <select {...this.props} className={[...classNames, ...className.split(' ')].join(' ')}>
        {children}
      </select>
    )
  }
}
