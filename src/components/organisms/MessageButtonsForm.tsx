import { type ChangeEvent, Component, type DragEvent } from 'react'
import { t } from '../../utils/i18n'
import Button from '../atoms/Button'
import { ControlInput, ControlSelect } from '../atoms/ControlFactory'
import Box from '../molecules/Box'
import { type Message } from 'types/Message'

interface ButtonState {
  id: number
  type: string
  value: string
  text: string
}

interface MessageButtonsFormState {
  buttons: ButtonState[]
  draggedIndex: number | null
  dropIndex: number | null
}

export default class MessageButtonsForm extends Component<
  { className?: string },
  MessageButtonsFormState
> {
  constructor(props: { className?: string }) {
    super(props)
    this.state = {
      draggedIndex: null,
      dropIndex: null,
      buttons: [],
    }
  }

  override componentDidMount() {
    chrome.storage.local.get(({ buttons = [] }: Pick<Message, 'buttons'>) => {
      this.setState({
        buttons: buttons.map((button): ButtonState => {
          const [type = ''] = Object.keys(button).filter((key) => key !== 'text'),
            // @ts-expect-error Element implicitly has an 'any' type because expression of type 'string' can't be used to index type 'MessageButtonsTypes'. No index signature with a parameter of type 'string' was found on type 'MessageButtonsTypes'.
            value: string | number = button[type] // eslint-disable-line @typescript-eslint/no-unsafe-assignment

          return {
            id: type === 'id' ? Number(value) : Math.floor(Math.random() * 1000),
            type,
            value: value.toString(),
            text: button.text,
          }
        }),
      })
    })
  }

  compareArrays = (arr1: ButtonState[], arr2: ButtonState[]): boolean => {
    // Check if arrays have different lengths
    if (arr1.length !== arr2.length) {
      return false
    }
    // Check if each object in arr1 has a corresponding object in arr2
    for (let i = 0; i < arr1.length; i++) {
      const obj1 = arr1[i]
      const obj2 = arr2[i]
      if (!obj2) {
        // If obj2 is undefined, there is no matching object in arr2
        return false
      }
      // Check if properties of obj1 and obj2 are the same
      if (
        obj1?.id !== obj2.id ||
        obj1.type !== obj2.type ||
        obj1.value !== obj2.value ||
        obj1.text !== obj2.text
      ) {
        return false
      }
    }
    // If we reach this point, the arrays are equal
    return true
  }

  override componentDidUpdate(
    _prevProps: Readonly<{ className?: string }>,
    prevState: Readonly<MessageButtonsFormState>
  ) {
    const { buttons } = this.state
    if (!this.compareArrays(prevState.buttons, buttons)) {
      void chrome.storage.local.set({
        buttons: buttons.map((button) => ({
          [button.type]: button.value,
          text: button.text,
        })),
      })
    }
  }

  handleDrag = (event: DragEvent<HTMLTableRowElement>, index: number) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', index.toString())
    this.setState({ draggedIndex: index })
  }

  handleDragOver = (event: DragEvent<HTMLTableRowElement>, index: number) => {
    event.preventDefault()
    this.setState({ dropIndex: index })
  }

  handleDrop = (event: DragEvent<HTMLTableRowElement>, index: number) => {
    event.preventDefault()
    const sourceIndex = event.dataTransfer.getData('text')
    const buttons = [...this.state.buttons]
    const [draggedItem] = buttons.splice(Number(sourceIndex), 1)
    if (!draggedItem) return
    buttons.splice(index, 0, draggedItem)
    this.setState({ buttons, draggedIndex: null, dropIndex: null })
  }

  handleTypeChange = (event: ChangeEvent<HTMLSelectElement>, id: number) => {
    const buttons = [...this.state.buttons]
    this.setState({
      buttons: buttons.map((button) => {
        if (button.id !== id) return button
        const type = event.target.value
        let value = button.value || ''
        if (type === 'phoneNumber') {
          value = value.replace(/\D/g, '')
        } else if (type === 'id') {
          value = button.id.toString()
        }
        return {
          id: button.id || 0,
          type,
          value,
          text: button.text || '',
        }
      }),
    })
  }

  handleValueChange = (event: ChangeEvent<HTMLInputElement>, id: number) => {
    const buttons = [...this.state.buttons]
    this.setState({
      buttons: buttons.map((button) => {
        if (button.id !== id) return button
        let { value } = event.target
        if (button.type === 'phoneNumber') {
          value = value.replace(/\D/g, '')
        } else if (button.type === 'id') {
          value = button.id.toString()
        }
        return {
          id: button.id || 0,
          type: button.type || '',
          value,
          text: button.text || '',
        }
      }),
    })
  }

  handleTextChange = (event: ChangeEvent<HTMLInputElement>, id: number) => {
    const buttons = [...this.state.buttons]
    this.setState({
      buttons: buttons.map((button) => {
        if (button.id !== id) return button
        return {
          id: button.id || 0,
          type: button.type || '',
          value: button.value || '',
          text: event.target.value,
        }
      }),
    })
  }

  handleDeleteButton = (id: number) => {
    const buttons = [...this.state.buttons]
    this.setState({ buttons: buttons.filter((button) => button.id !== id) })
  }

  handleAddButton = () => {
    const buttons = [
      ...this.state.buttons,
      {
        id: Math.floor(Math.random() * 1000),
        type: 'url',
        value: '',
        text: '',
      },
    ]
    this.setState({ buttons })
  }

  override render() {
    const { buttons, draggedIndex, dropIndex } = this.state

    return (
      <Box
        className={this.props.className}
        title={t('buttons_title')}
        headerButtons={
          buttons.length < 3 && (
            <Button variant="light" onClick={this.handleAddButton}>
              {t('add')}
            </Button>
          )
        }
        footer={
          <>
            <p className="text-red-600 dark:text-red-400 font-bold mb-1">
              {t('important_note_buttons')}
            </p>
            <p>{t('button_types_title')}</p>
            <ul className="list-disc ml-8">
              <li
                dangerouslySetInnerHTML={{
                  __html: t('button_url_desc'),
                }}
              />
              <li
                dangerouslySetInnerHTML={{
                  __html: t('button_phone_desc'),
                }}
              />
              <li
                dangerouslySetInnerHTML={{
                  __html: t('button_id_desc'),
                }}
              />
            </ul>
          </>
        }
      >
        {buttons.length > 0 && (
          <table className="mx-4 table-auto">
            <thead>
              <tr className="text-left font-bold">
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2 text-center">{t('type')}</th>
                <th className="px-4 py-2 text-center">{t('content')}</th>
                <th className="px-4 py-2 text-center">{t('text')}</th>
                <th className="px-4 py-2 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {buttons.map((button, index) => (
                <tr
                  key={button.id}
                  draggable
                  onDragStart={(event) => {
                    this.handleDrag(event, index)
                  }}
                  onDragOver={(event) => {
                    this.handleDragOver(event, index)
                  }}
                  onDrop={(event) => {
                    this.handleDrop(event, index)
                  }}
                  className={`${index === draggedIndex ? 'bg-blue-100 dark:bg-blue-900' : ''} ${index === dropIndex ? 'border-dashed border-2' : 'border'}`}
                >
                  <td className="border px-4 py-2 cursor-move text-center">☰</td>
                  <td className="border px-4 py-2">
                    <ControlSelect
                      value={button.type}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                        this.handleTypeChange(event, button.id)
                      }}
                    >
                      <option value="url">{t('button_type_url')}</option>
                      <option value="phoneNumber">{t('button_type_phone')}</option>
                      <option value="id">{t('button_type_id')}</option>
                    </ControlSelect>
                  </td>
                  <td className="border px-4 py-2">
                    <ControlInput
                      className={button.type === 'id' ? 'bg-transparent border-0' : ''}
                      type={
                        button.type === 'phoneNumber'
                          ? 'tel'
                          : button.type === 'url'
                            ? 'url'
                            : 'text'
                      }
                      value={button.value}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        this.handleValueChange(event, button.id)
                      }}
                      disabled={button.type === 'id'}
                    />
                  </td>
                  <td className="border px-4 py-2">
                    <ControlInput
                      type="text"
                      value={button.text}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        this.handleTextChange(event, button.id)
                      }}
                    />
                  </td>
                  <td className="border text-center align-middle">
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center rounded-full text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => {
                        this.handleDeleteButton(button.id)
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Box>
    )
  }
}
