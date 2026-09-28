import './preload.js'
import { initOpenCode } from './opencode.js'
import { loadState } from './store.js'
import { createBot } from './bot.js'
import { startEventLoop } from './events.js'
import * as sessions from './sessions.js'

async function main() {
  await loadState()
  await initOpenCode()
  await sessions.repairStoredSessions()

  const bot = createBot()
  startEventLoop(bot)

  await bot.api.setMyCommands([
    { command: 'start', description: 'Справка' },
    { command: 'new', description: 'Новая сессия' },
    { command: 'sessions', description: 'Последние сессии' },
    { command: 'use', description: 'Переключить сессию' },
    { command: 'status', description: 'Текущая сессия' },
    { command: 'stop', description: 'Прервать выполнение' },
    { command: 'dir', description: 'Сменить каталог' },
    { command: 'answer', description: 'Ответить на форму' },
    { command: 'model', description: 'Список и смена модели' },
  ])

  console.log('OpenCode Telegram bot started')
  await bot.start()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
