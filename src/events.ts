import type { Bot } from 'grammy'
import {
  getClient,
  listForms,
  listMessages,
  listPendingPermissions,
  listPermissions,
} from './opencode.js'
import * as store from './store.js'
import { notifyForm, notifyPermission } from './notify.js'
import { sendLong } from './format.js'

const refreshTimers = new Map<string, NodeJS.Timeout>()
const refreshing = new Set<string>()

export function startEventLoop(bot: Bot) {
  void (async () => {
    for (;;) {
      try {
        for await (const event of getClient().event.subscribe()) {
          const sessionID = findSessionID(event)
          if (sessionID) scheduleRefresh(bot, sessionID)
        }
      } catch (err) {
        console.error('[events] stream failed, reconnect in 2s', err)
        for (const sessionID of store.sessionToChat().keys()) {
          scheduleRefresh(bot, sessionID)
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
  })()

  // Страховка: события могут теряться при разрыве соединения.
  setInterval(() => {
    for (const sessionID of store.sessionToChat().keys()) {
      scheduleRefresh(bot, sessionID)
    }
  }, 5000)
}

function scheduleRefresh(bot: Bot, sessionID: string) {
  if (refreshTimers.has(sessionID)) return

  refreshTimers.set(
    sessionID,
    setTimeout(() => {
      refreshTimers.delete(sessionID)
      void refreshSession(bot, sessionID)
    }, 500),
  )
}

async function refreshSession(bot: Bot, sessionID: string) {
  if (refreshing.has(sessionID)) return
  refreshing.add(sessionID)

  try {
    const chatId = store.sessionToChat().get(sessionID)
    if (!chatId) return

    await processMessages(bot, chatId, sessionID)

    // Если один из маршрутов вернёт 500, остальные всё равно должны работать.
    await processPermissions(bot, chatId, sessionID).catch((err) =>
      console.error('[events] permissions refresh failed', err),
    )
    await processForms(bot, chatId, sessionID).catch((err) =>
      console.error('[events] forms refresh failed', err),
    )

    await store.saveState()
  } catch (err) {
    console.error('[events] refresh failed', err)
  } finally {
    refreshing.delete(sessionID)
  }
}

async function processMessages(bot: Bot, chatId: number, sessionID: string) {
  const messages = await listMessages(sessionID)

  for (const message of messages) {
    if (message.type !== 'assistant') continue

    const text = extractText(message)
    if (
      text &&
      !store.has(chatId, 'sentMessageIds', message.id) &&
      isComplete(message)
    ) {
      store.remember(chatId, 'sentMessageIds', message.id)
      await sendLong(bot, chatId, text)
    }

    for (const item of message.content ?? []) {
      if (item.type !== 'tool') continue

      const tool = item as {
        id: string
        name?: string
        state?: { status?: string }
      }
      const key = `${message.id}:${tool.id}`
      if (store.has(chatId, 'notifiedToolIds', key)) continue

      if (tool.state?.status === 'running') {
        store.remember(chatId, 'notifiedToolIds', key)
        await sendLong(bot, chatId, `🔧 ${tool.name ?? 'tool'}`)
      }
    }
  }
}

async function processPermissions(
  bot: Bot,
  chatId: number,
  sessionID: string,
) {
  let permissions = await fetchPermissions(sessionID)
  if (!permissions) return

  for (const permission of permissions) {
    if (store.has(chatId, 'notifiedPermissionIds', permission.id)) continue
    store.remember(chatId, 'notifiedPermissionIds', permission.id)
    await notifyPermission(bot, chatId, permission)
  }
}

async function fetchPermissions(sessionID: string) {
  try {
    return await listPermissions(sessionID)
  } catch (err) {
    console.warn(
      '[events] session permission list failed, trying global',
      err,
    )
  }

  try {
    const all = await listPendingPermissions()
    return all.filter((p) => p.sessionID === sessionID)
  } catch (err) {
    console.error('[events] global permission list also failed', err)
    return undefined
  }
}

async function processForms(bot: Bot, chatId: number, sessionID: string) {
  const forms = await listForms(sessionID)

  for (const form of forms) {
    if (store.has(chatId, 'notifiedFormIds', form.id)) continue
    store.remember(chatId, 'notifiedFormIds', form.id)
    await notifyForm(bot, chatId, form)
  }
}

function extractText(message: {
  content?: Array<Record<string, unknown>>
}): string {
  return (message.content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('\n\n')
    .trim()
}

function isComplete(message: {
  finish?: string
  time?: { completed?: number }
}): boolean {
  return Boolean(message.finish || message.time?.completed)
}

function findSessionID(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const match = value.match(/"sessionID"\s*:\s*"(ses[^"]+)"/)
    return match?.[1]
  }

  if (!value || typeof value !== 'object') return undefined

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (
      key === 'sessionID' &&
      typeof child === 'string' &&
      child.startsWith('ses')
    ) {
      return child
    }
    const nested = findSessionID(child)
    if (nested) return nested
  }

  return undefined
}
