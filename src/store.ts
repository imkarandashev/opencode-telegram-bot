import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { config } from './config.js'

export type ChatState = {
  sessionID?: string
  directory: string
  sentMessageIds: string[]
  notifiedToolIds: string[]
  notifiedPermissionIds: string[]
  notifiedFormIds: string[]
}

type State = {
  chats: Record<string, ChatState>
}

let state: State = { chats: {} }
let saveChain: Promise<void> = Promise.resolve()

function cap<T>(items: T[], max = 500): T[] {
  return items.length > max ? items.slice(items.length - max) : items
}

export async function loadState() {
  try {
    const raw = await readFile(config.stateFile, 'utf8')
    const parsed = JSON.parse(raw) as Partial<State>
    state = { chats: parsed.chats ?? {} }
  } catch {
    state = { chats: {} }
  }
}

export async function saveState() {
  saveChain = saveChain
    .then(async () => {
      await mkdir(dirname(config.stateFile), { recursive: true })
      await writeFile(config.stateFile, JSON.stringify(state, null, 2), 'utf8')
    })
    .catch((err) => console.error('[store] save failed', err))
  return saveChain
}

export function getChat(chatId: number): ChatState {
  const key = String(chatId)
  state.chats[key] ??= {
    directory: config.projectDir,
    sentMessageIds: [],
    notifiedToolIds: [],
    notifiedPermissionIds: [],
    notifiedFormIds: [],
  }
  return state.chats[key]
}

export function setChat(chatId: number, patch: Partial<ChatState>) {
  Object.assign(getChat(chatId), patch)
}

type IdField =
  | 'sentMessageIds'
  | 'notifiedToolIds'
  | 'notifiedPermissionIds'
  | 'notifiedFormIds'

export function has(chatId: number, field: IdField, id: string) {
  return getChat(chatId)[field].includes(id)
}

export function remember(chatId: number, field: IdField, id: string) {
  const chat = getChat(chatId)
  chat[field] = cap([...chat[field], id])
}

export function sessionToChat() {
  const map = new Map<string, number>()
  for (const [chatId, chat] of Object.entries(state.chats)) {
    if (chat.sessionID) map.set(chat.sessionID, Number(chatId))
  }
  return map
}
