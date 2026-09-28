import type { Bot } from 'grammy'

export function splitMessage(text: string, limit = 4000): string[] {
  const chunks: string[] = []
  let rest = text

  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit)
    if (cut < limit * 0.5) cut = limit
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut).replace(/^\n/, '')
  }

  if (rest) chunks.push(rest)
  return chunks
}

export async function sendLong(bot: Bot, chatId: number, text: string) {
  for (const chunk of splitMessage(text)) {
    await bot.api.sendMessage(chatId, chunk)
  }
}
