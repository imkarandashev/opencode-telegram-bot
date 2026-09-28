import { OpenCode } from '@opencode/client'
import { Service } from '@opencode/client/service'

export type SessionInfo = {
  id: string
  title?: string
  agent?: string
  model?: { id: string; providerID: string }
  location: { directory: string }
}

export type MessageInfo = {
  id: string
  type: string
  time?: { created?: number; completed?: number }
  finish?: string
  content?: Array<
    | { type: 'text'; text: string }
    | { type: 'tool'; id: string; name: string; state?: { status: string } }
    | Record<string, unknown>
  >
}

export type PermissionRequest = {
  id: string
  sessionID: string
  action: string
  resources: string[]
  message?: string
}

export type ModelInfo = {
  providerID: string
  modelID: string
  name?: string
  enabled?: boolean
}

export type FormInfo = {
  id: string
  sessionID: string
  title: string
  fields: Array<{
    key: string
    title?: string
    type: string
    required?: boolean
    options?: Array<{ value: string; label: string }>
    [key: string]: unknown
  }>
}

let endpoint: Awaited<ReturnType<typeof Service.ensure>>
let client: ReturnType<typeof OpenCode.make>
let headers: Record<string, string> | undefined

export async function initOpenCode() {
  endpoint = await Service.ensure()
  headers = Service.headers(endpoint)
  client = OpenCode.make({
    baseUrl: endpoint.url,
    headers,
  })
  return client
}

export function getClient() {
  if (!client) throw new Error('OpenCode client не инициализирован')
  return client
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(new URL(path, endpoint.url), {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(headers ?? {}),
      ...(init.headers ?? {}),
    },
  })

  const text = await res.text()
  let body: unknown = undefined
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!res.ok) {
    const data = body as
      | { error?: { message?: string }; message?: string }
      | undefined
    const message = data?.error?.message ?? data?.message ?? res.statusText
    throw new Error(`OpenCode API ${res.status} ${path}: ${message}`)
  }

  return body as T
}

export async function createSession(directory: string, title: string) {
  const res = await api<{ data: SessionInfo }>('/api/session', {
    method: 'POST',
    body: JSON.stringify({ title, location: { directory } }),
  })
  return res.data
}

export async function getSession(sessionID: string) {
  const res = await api<{ data: SessionInfo }>(`/api/session/${sessionID}`)
  return res.data
}

export async function listSessions() {
  const res = await api<{ data: SessionInfo[] }>(
    '/api/session?order=desc&limit=20',
  )
  return res.data
}

export async function moveSession(sessionID: string, directory: string) {
  await api(`/api/session/${sessionID}/move`, {
    method: 'POST',
    body: JSON.stringify({ directory }),
  })
}

export async function prompt(sessionID: string, text: string) {
  await api(`/api/session/${sessionID}/prompt`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function interrupt(sessionID: string) {
  await api(`/api/session/${sessionID}/interrupt`, {
    method: 'POST',
  })
}

export async function listMessages(sessionID: string) {
  const res = await api<{ data: MessageInfo[] }>(
    `/api/session/${sessionID}/message?order=desc&limit=50`,
  )
  return [...res.data].reverse()
}

export async function listModels() {
  const res = await api<{ data: ModelInfo[] }>('/api/model')
  return res.data
}

export async function switchModel(
  sessionID: string,
  providerID: string,
  id: string,
  variant?: string,
) {
  await api(`/api/session/${sessionID}/model`, {
    method: 'POST',
    body: JSON.stringify({
      model: { providerID, id, ...(variant ? { variant } : {}) },
    }),
  })
}

export async function listPermissions(sessionID: string) {
  const res = await api<{ data: PermissionRequest[] }>(
    `/api/session/${sessionID}/permission`,
  )
  return res.data
}

export async function listPendingPermissions() {
  const res = await api<{ data: PermissionRequest[] }>(
    '/api/permission/request',
  )
  return res.data
}

export async function replyPermission(
  sessionID: string,
  requestID: string,
  decision: 'once' | 'always' | 'reject',
) {
  await api(`/api/session/${sessionID}/permission/${requestID}/reply`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  })
}

export async function listForms(sessionID: string) {
  const res = await api<{ data: FormInfo[] }>(`/api/session/${sessionID}/form`)
  return res.data
}

export async function replyForm(
  sessionID: string,
  formID: string,
  answer: Record<string, unknown>,
) {
  await api(`/api/session/${sessionID}/form/${formID}/reply`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  })
}
