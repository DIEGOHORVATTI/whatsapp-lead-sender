import WPP from '@wppconnect/wa-js'
import { ChromeMessageTypes } from 'types/ChromeMessageTypes'
import type { Message } from 'types/Message'
import AsyncChromeMessageManager from 'utils/AsyncChromeMessageManager'
import asyncQueue from 'utils/AsyncEventQueue'
import storageManager, { AsyncStorageManager } from 'utils/AsyncStorageManager'

declare global {
  interface Window {
    WPP: typeof WPP
  }
}

const RELOAD_KEY = 'WTF_INJECT_RELOAD_COUNT'
const MAX_RETRIES = 3
const SEND_TIMEOUT_MS = 45_000
const reloadCount = Number(sessionStorage.getItem(RELOAD_KEY) ?? '0')

// --- Diagnostic state ---
let wppInjected = false
let wppReady = false
let wppError: string | undefined

function dbg(...args: unknown[]) {
  console.log('%c[WTF]', 'color:#00e676;font-weight:bold', ...args)
}

function dbgErr(...args: unknown[]) {
  console.error('%c[WTF]', 'color:#ff1744;font-weight:bold', ...args)
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        reject(new Error(`Timeout: ${label} (${String(ms / 1000)}s)`))
      }, ms)
    ),
  ])
}

if (reloadCount >= MAX_RETRIES) {
  wppError = `Parou após ${String(MAX_RETRIES)} tentativas de reload. Recarregue a página manualmente.`
  dbgErr(wppError)
} else {
  sessionStorage.setItem(RELOAD_KEY, String(reloadCount + 1))
  dbg('Inicializando... tentativa', reloadCount + 1, 'de', MAX_RETRIES)

  const WebpageMessageManager = new AsyncChromeMessageManager('webpage')

  const log = (level: number, message: string, contact: string, attachment: boolean) => {
    void WebpageMessageManager.sendMessage(ChromeMessageTypes.ADD_LOG, {
      level,
      message,
      attachment,
      contact,
    })
  }

  const sendWPPMessage = async ({ contact, message, attachment, buttons = [] }: Message) => {
    dbg('sendWPPMessage →', contact, '| buttons:', buttons.length, '| attachment:', !!attachment)

    if (attachment?.url && buttons.length > 0) {
      const response = await fetch(attachment.url)
      const data = await response.blob()
      return window.WPP.chat.sendFileMessage(
        contact,
        new File([data], attachment.name, {
          type: attachment.type,
          lastModified: attachment.lastModified,
        }),
        { type: 'image', caption: message, waitForAck: false, buttons }
      )
    } else if (buttons.length > 0) {
      return window.WPP.chat.sendTextMessage(contact, message, {
        waitForAck: false,
        buttons,
      })
    } else if (attachment?.url) {
      const response = await fetch(attachment.url)
      const data = await response.blob()
      return window.WPP.chat.sendFileMessage(
        contact,
        new File([data], attachment.name, {
          type: attachment.type,
          lastModified: attachment.lastModified,
        }),
        { type: 'auto-detect', caption: message, waitForAck: false }
      )
    }
    return window.WPP.chat.sendTextMessage(contact, message, {
      waitForAck: false,
    })
  }

  const sendMessage = async ({ contact, hash }: { contact: string; hash: number }) => {
    dbg('sendMessage → contact:', contact, '| hash:', hash)

    if (!window.WPP.conn.isAuthenticated()) {
      const errorMsg = 'Conecte-se primeiro!'
      alert(errorMsg)
      throw new Error(errorMsg)
    }
    dbg('Autenticado ✓')

    const { message } = await storageManager.retrieveMessage(hash)
    const hasAttachment = Boolean(message.attachment)
    dbg('Mensagem recuperada do storage ✓')

    let findContact = await withTimeout(
      window.WPP.contact.queryExists(contact),
      15_000,
      'queryExists'
    )
    dbg('queryExists resultado:', findContact ? 'encontrado' : 'não encontrado')

    if (!findContact) {
      let truncatedNumber = contact
      if (truncatedNumber.startsWith('55') && truncatedNumber.length === 12) {
        truncatedNumber = `${truncatedNumber.substring(0, 4)}9${truncatedNumber.substring(4)}`
      } else if (truncatedNumber.startsWith('55') && truncatedNumber.length === 13) {
        truncatedNumber = `${truncatedNumber.substring(0, 4)}${truncatedNumber.substring(5)}`
      }
      dbg('Tentando formato alternativo:', truncatedNumber)
      findContact = await withTimeout(
        window.WPP.contact.queryExists(truncatedNumber),
        15_000,
        'queryExists (retry)'
      )
      if (!findContact) {
        log(1, 'Número não encontrado!', contact, hasAttachment)
        throw new Error('Number not found!')
      }
    }

    const wid = findContact.wid._serialized || `${findContact.wid.user}@${findContact.wid.server}`
    dbg('WID resolvido:', wid)

    const result = await withTimeout(
      sendWPPMessage({ contact: wid, ...message }),
      SEND_TIMEOUT_MS,
      'sendMessage'
    )
    dbg('sendWPPMessage retornou ✓')

    // Check send result with timeout
    try {
      const value = await withTimeout(result.sendMsgResult, 10_000, 'sendMsgResult')
      dbg('sendMsgResult:', value)
      const resultStr: string | undefined =
        typeof value === 'string'
          ? value
          : 'messageSendResult' in value
            ? value.messageSendResult
            : undefined

      if (resultStr !== window.WPP.whatsapp.enums.SendMsgResult.OK) {
        log(1, `Falha no envio: ${JSON.stringify(value)}`, wid, hasAttachment)
        throw new Error(`Failed to send: ${JSON.stringify(value)}`)
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Timeout:')) {
        dbg('sendMsgResult timeout — mensagem provavelmente enviada:', wid)
      } else {
        throw e
      }
    }

    log(3, 'Mensagem enviada!', wid, hasAttachment)
  }

  const addToQueue = async (message: Message) => {
    dbg('addToQueue → contact:', message.contact)
    try {
      const messageHash = AsyncStorageManager.calculateMessageHash(message)
      await storageManager.storeMessage(message, messageHash)
      dbg('Mensagem armazenada, hash:', messageHash)
      await asyncQueue.add({
        eventHandler: sendMessage,
        detail: {
          delay: message.delay,
          contact: message.contact,
          hash: messageHash,
        },
      })
      dbg('Queue processou ✓')
      return true
    } catch (error) {
      dbgErr('addToQueue erro:', error)
      if (error instanceof Error) {
        void WebpageMessageManager.sendMessage(ChromeMessageTypes.ADD_LOG, {
          level: 1,
          message: error.message,
          attachment: Boolean(message.attachment),
          contact: message.contact,
        })
      }
      throw error
    }
  }

  WebpageMessageManager.addHandler(ChromeMessageTypes.PAUSE_QUEUE, () => {
    try {
      asyncQueue.pause()
      return true
    } catch {
      return false
    }
  })

  WebpageMessageManager.addHandler(ChromeMessageTypes.RESUME_QUEUE, () => {
    try {
      asyncQueue.resume()
      return true
    } catch {
      return false
    }
  })

  WebpageMessageManager.addHandler(ChromeMessageTypes.STOP_QUEUE, () => {
    try {
      asyncQueue.stop()
      return true
    } catch {
      return false
    }
  })

  WebpageMessageManager.addHandler(ChromeMessageTypes.SEND_MESSAGE, async (message) => {
    dbg('SEND_MESSAGE recebido | WPP.isReady:', window.WPP.isReady, '| contact:', message.contact)
    if (window.WPP.isReady) {
      return addToQueue(message)
    }
    dbg('WPP não está pronto, aguardando onReady...')
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        dbgErr('onReady nunca disparou após 30s')
        reject(new Error('WPP não inicializou. Recarregue o WhatsApp Web.'))
      }, 30_000)

      window.WPP.webpack.onReady(() => {
        clearTimeout(timeout)
        dbg('onReady disparou! Processando mensagem...')
        // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
        void addToQueue(message).then(resolve).catch(reject)
      })
    })
  })

  // --- WPP Status handler ---
  WebpageMessageManager.addHandler(ChromeMessageTypes.WPP_STATUS, () => {
    let authenticated = false
    try {
      authenticated = window.WPP.conn.isAuthenticated()
    } catch {
      /* ignore */
    }
    return {
      ready: wppReady,
      authenticated,
      injected: wppInjected,
      error: wppError,
    }
  })

  WebpageMessageManager.addHandler(ChromeMessageTypes.QUEUE_STATUS, () => asyncQueue.getStatus())

  void storageManager.clearDatabase()

  // --- Injection ---
  dbg('Chamando WPP.webpack.injectLoader()...')
  try {
    WPP.webpack.injectLoader()
    wppInjected = true
    dbg('injectLoader() OK ✓')
  } catch (e) {
    wppError = `injectLoader falhou: ${e instanceof Error ? e.message : String(e)}`
    dbgErr(wppError)
    window.location.reload()
  }

  WPP.webpack.onReady(() => {
    wppReady = true
    sessionStorage.removeItem(RELOAD_KEY)
    dbg('WPP PRONTO ✓ | isAuthenticated:', window.WPP.conn.isAuthenticated())
  })

  // Diagnóstico: se não ficar pronto em 15s, logar warning
  setTimeout(() => {
    if (!wppReady) {
      dbgErr(
        'WPP não ficou pronto após 15s! injected:',
        wppInjected,
        '| isReady:',
        window.WPP.isReady
      )
      wppError = 'WPP não inicializou após 15s. O WhatsApp Web pode ter atualizado.'
    }
  }, 15_000)
}
