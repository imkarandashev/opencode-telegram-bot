import { InlineKeyboard } from 'grammy'
import type { Bot } from 'grammy'
import type { FormInfo, PermissionRequest } from './opencode.js'

export async function notifyPermission(
  bot: Bot,
  chatId: number,
  request: PermissionRequest,
) {
  const keyboard = new InlineKeyboard()
    .text('✅ Разрешить', `perm:once:${request.id}`)
    .text('🔁 Всегда', `perm:always:${request.id}`)
    .row()
    .text('⛔ Отклонить', `perm:reject:${request.id}`)

  const lines = [
    '⚠️ Требуется подтверждение',
    `Действие: ${request.action}`,
    request.resources?.length
      ? `Ресурсы: ${request.resources.join(', ')}`
      : undefined,
    request.message,
  ].filter(Boolean)

  await bot.api.sendMessage(chatId, lines.join('\n'), {
    reply_markup: keyboard,
  })
}

export async function notifyForm(bot: Bot, chatId: number, form: FormInfo) {
  const fields = (form.fields ?? []).map((field) => {
    const required = field.required ? ' *' : ''
    const title = field.title ? `: ${field.title}` : ''
    return `- ${field.key} (${field.type}${required})${title}`
  })

  const lines = [
    `📋 Форма: ${form.title}`,
    `ID: ${form.id}`,
    '',
    ...fields,
    '',
    'Ответьте командой:',
    `/answer ${form.id} {"ключ":"значение"}`,
  ]

  await bot.api.sendMessage(chatId, lines.join('\n'))
}
