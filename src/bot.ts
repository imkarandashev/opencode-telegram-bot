import { Bot } from 'grammy'
import { config } from './config.js'
import * as oc from './opencode.js'
import * as store from './store.js'
import * as sessions from './sessions.js'
import { sendLong } from './format.js'

export function createBot() {
  const bot = new Bot(config.telegramToken)

  // Доступ только для разрешённых пользователей
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id
    if (!userId || !config.allowedUserIds.has(userId)) return
    await next()
  })

  bot.command('start', async (ctx) => {
    await ctx.reply(
      [
        'OpenCode Telegram bot',
        '',
        'Отправьте текст — задача уйдёт в OpenCode.',
        '/new — новая сессия',
        '/sessions — последние сессии',
        '/use <sessionID> — переключиться',
        '/status — текущая сессия',
        '/stop — прервать выполнение',
        '/dir <Linux path> — сменить каталог (admin)',
        '/answer <formID> <json> — ответить на форму',
        '/model [provider/model] — список или смена модели',
      ].join('\n'),
    )
  })

  bot.command('new', async (ctx) => {
    const session = await sessions.createNewSession(ctx.chat.id)
    await ctx.reply(`Новая сессия: ${session.id}`)
  })

  bot.command('sessions', async (ctx) => {
    const list = await oc.listSessions()
    const lines = list.map(
      (session) => `${session.id}${session.title ? ` — ${session.title}` : ''}`,
    )
    await ctx.reply(lines.join('\n') || 'Сессий нет')
  })

  bot.command('use', async (ctx) => {
    const id = ctx.match?.trim()
    if (!id?.startsWith('ses')) {
      return ctx.reply('Укажите ID сессии: /use ses_...')
    }

    const session = await oc.getSession(id)
    store.setChat(ctx.chat.id, {
      sessionID: session.id,
      sentMessageIds: [],
      notifiedToolIds: [],
      notifiedPermissionIds: [],
      notifiedFormIds: [],
    })
    await store.saveState()
    await ctx.reply(`Переключился на ${session.id}`)
  })

  bot.command('status', async (ctx) => {
    const chat = store.getChat(ctx.chat.id)
    if (!chat.sessionID) {
      return ctx.reply('Сессия ещё не создана. Отправьте задачу или /new.')
    }

    const session = await oc.getSession(chat.sessionID)
    await ctx.reply(
      [
        `Сессия: ${session.id}`,
        `Каталог: ${session.location?.directory ?? chat.directory}`,
        `Агент: ${session.agent ?? '—'}`,
        `Модель: ${
          session.model
            ? `${session.model.providerID}/${session.model.id}`
            : '—'
        }`,
      ].join('\n'),
    )
  })

  bot.command('stop', async (ctx) => {
    const chat = store.getChat(ctx.chat.id)
    if (!chat.sessionID) return ctx.reply('Нет активной сессии')
    await oc.interrupt(chat.sessionID)
    await ctx.reply('Отправил запрос на прерывание')
  })

  bot.command('dir', async (ctx) => {
    const userId = ctx.from?.id
    if (!userId || !config.adminUserIds.has(userId)) {
      return ctx.reply('Недостаточно прав')
    }

    const path = ctx.match?.trim()
    if (!path) return ctx.reply('Формат: /dir /path/to/project')

    try {
      const directory = await sessions.validateDirectory(path)
      const chat = store.getChat(ctx.chat.id)
      if (chat.sessionID) {
        await oc.moveSession(chat.sessionID, directory)
      }

      store.setChat(ctx.chat.id, { directory })
      await store.saveState()
      await ctx.reply(`Каталог: ${directory}`)
    } catch (err) {
      await ctx.reply(`Не удалось сменить каталог: ${(err as Error).message}`)
    }
  })

  bot.command('model', async (ctx) => {
    try {
      const chat = await sessions.ensureSession(ctx.chat.id)
      const models = (await oc.listModels()).filter((m) => m.enabled !== false)
      const raw = ctx.match?.trim()

      if (!raw) {
        const session = await oc.getSession(chat.sessionID!)
        const current = session.model
          ? `${session.model.providerID}/${session.model.id}`
          : '—'
        await sendLong(
          bot,
          ctx.chat.id,
          [
            `Текущая модель: ${current}`,
            '',
            'Смена: /model provider/model (можно и без провайдера)',
            'Вариант: /model provider/model#variant',
            '',
            ...models.map(
              (m) =>
                `${m.providerID}/${m.modelID}${m.name ? ` — ${m.name}` : ''}`,
            ),
          ].join('\n'),
        )
        return
      }

      const hash = raw.indexOf('#')
      const ref = (hash >= 0 ? raw.slice(0, hash) : raw).toLowerCase()
      const variant = hash >= 0 ? raw.slice(hash + 1) : undefined
      const slash = ref.indexOf('/')

      const candidates =
        slash > 0
          ? models.filter(
              (m) => `${m.providerID}/${m.modelID}`.toLowerCase() === ref,
            )
          : models.filter((m) => m.modelID.toLowerCase() === ref)

      if (candidates.length === 0) {
        return ctx.reply(`Модель «${raw}» не найдена. Список: /model`)
      }
      if (candidates.length > 1) {
        return ctx.reply(
          [
            'Найдено несколько моделей, уточните провайдера:',
            ...candidates.map((m) => `/model ${m.providerID}/${m.modelID}`),
          ].join('\n'),
        )
      }

      const model = candidates[0]
      await oc.switchModel(
        chat.sessionID!,
        model.providerID,
        model.modelID,
        variant,
      )
      await ctx.reply(
        `Модель: ${model.providerID}/${model.modelID}${
          model.name ? ` (${model.name})` : ''
        }${variant ? ` [${variant}]` : ''}`,
      )
    } catch (err) {
      await ctx.reply(`Не удалось сменить модель: ${(err as Error).message}`)
    }
  })

  bot.command('answer', async (ctx) => {
    const raw = ctx.match?.trim()
    if (!raw) {
      return ctx.reply('Формат: /answer frm_xxx {"key":"value"}')
    }

    const space = raw.indexOf(' ')
    if (space < 0) {
      return ctx.reply('Формат: /answer frm_xxx {"key":"value"}')
    }

    const formID = raw.slice(0, space)
    const json = raw.slice(space + 1)
    const chat = store.getChat(ctx.chat.id)

    if (!chat.sessionID) return ctx.reply('Нет активной сессии')

    try {
      const answer = JSON.parse(json)
      await oc.replyForm(chat.sessionID, formID, answer)
      await ctx.reply('Ответ отправлен')
    } catch (err) {
      await ctx.reply(`Не удалось отправить ответ: ${(err as Error).message}`)
    }
  })

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text
    if (text.startsWith('/')) return

    try {
      const chat = await sessions.ensureSession(ctx.chat.id)
      await oc.prompt(chat.sessionID!, text)
      await ctx.reply('Принял задачу. Слежу за выполнением…')
    } catch (err) {
      await ctx.reply(`Ошибка: ${(err as Error).message}`)
    }
  })

  bot.on('callback_query:data', async (ctx) => {
    const [kind, decision, requestID] = ctx.callbackQuery.data.split(':')

    if (kind !== 'perm' || !decision || !requestID) {
      return ctx.answerCallbackQuery()
    }

    const chatId = ctx.chat?.id
    if (!chatId) return ctx.answerCallbackQuery()

    const chat = store.getChat(chatId)
    if (!chat.sessionID) {
      return ctx.answerCallbackQuery({ text: 'Нет активной сессии' })
    }

    await oc.replyPermission(
      chat.sessionID,
      requestID,
      decision as 'once' | 'always' | 'reject',
    )

    await ctx.editMessageReplyMarkup({
      reply_markup: { inline_keyboard: [] },
    })
    await ctx.answerCallbackQuery({ text: 'Готово' })
  })

  return bot
}
