import * as oc from './opencode.js'
import * as store from './store.js'
import { realpath, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { config } from './config.js'

export async function validateDirectory(directory: string): Promise<string> {
  const candidate = resolve(directory)

  try {
    const canonical = await realpath(candidate)
    if (!(await stat(canonical)).isDirectory()) {
      throw new Error('not a directory')
    }
    return canonical
  } catch {
    throw new Error(
      `Каталог «${directory}» не существует или недоступен в окружении бота. Укажите существующий путь Linux.`,
    )
  }
}

async function availableDirectory(directory: string): Promise<string | undefined> {
  try {
    return await validateDirectory(directory)
  } catch {
    return undefined
  }
}

async function defaultDirectory(): Promise<string> {
  const configured = await availableDirectory(config.projectDir)
  if (configured) return configured

  const fallback = await validateDirectory(process.cwd())
  console.warn(
    `[sessions] configured project directory is unavailable; using ${fallback}`,
  )
  return fallback
}

async function chatDirectory(chatId: number): Promise<string> {
  const chat = store.getChat(chatId)
  const current = await availableDirectory(chat.directory)
  if (current) {
    if (current !== chat.directory) {
      store.setChat(chatId, { directory: current })
      await store.saveState()
    }
    return current
  }

  const fallback = await defaultDirectory()
  store.setChat(chatId, { directory: fallback })
  await store.saveState()
  return fallback
}

/** Repair saved sessions whose project directory belongs to another machine. */
export async function repairStoredSessions() {
  const fallbackDirectory = await defaultDirectory()

  for (const [sessionID, chatId] of store.sessionToChat()) {
    const chat = store.getChat(chatId)

    try {
      const session = await oc.getSession(sessionID)
      const sessionDirectory = await availableDirectory(
        session.location?.directory ?? '',
      )

      if (sessionDirectory) {
        if (chat.directory !== sessionDirectory) {
          store.setChat(chatId, { directory: sessionDirectory })
        }
        continue
      }

      const targetDirectory =
        (await availableDirectory(chat.directory)) ?? fallbackDirectory
      await oc.moveSession(sessionID, targetDirectory)
      store.setChat(chatId, { directory: targetDirectory })
      console.warn(
        `[sessions] moved ${sessionID} from an unavailable directory to ${targetDirectory}`,
      )
    } catch (err) {
      console.error(`[sessions] could not repair ${sessionID}`, err)
    }
  }

  await store.saveState()
}

export async function ensureSession(chatId: number) {
  const chat = store.getChat(chatId)
  const directory = await chatDirectory(chatId)

  if (chat.sessionID) {
    let session
    try {
      session = await oc.getSession(chat.sessionID)
    } catch {
      store.setChat(chatId, { sessionID: undefined })
    }

    if (session) {
      if (await availableDirectory(session.location?.directory ?? '')) {
        return chat
      }

      await oc.moveSession(chat.sessionID, directory)
      store.setChat(chatId, { directory })
      await store.saveState()
      return store.getChat(chatId)
    }
  }

  const session = await oc.createSession(directory, `Telegram ${chatId}`)
  store.setChat(chatId, { sessionID: session.id })
  await store.saveState()
  return store.getChat(chatId)
}

export async function createNewSession(chatId: number) {
  const directory = await chatDirectory(chatId)
  const session = await oc.createSession(directory, `Telegram ${chatId}`)

  store.setChat(chatId, {
    sessionID: session.id,
    directory,
    sentMessageIds: [],
    notifiedToolIds: [],
    notifiedPermissionIds: [],
    notifiedFormIds: [],
  })
  await store.saveState()
  return session
}
