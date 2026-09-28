# OpenCode Telegram Bot

Telegram-бот на Node.js + TypeScript, который позволяет ставить задачи OpenCode
и следить за их выполнением прямо из Telegram.

## Возможности

- создание и хранение сессий OpenCode;
- отправка текстовых задач как `prompt`;
- поток событий OpenCode → сообщения в Telegram;
- уведомления о запущенных инструментах;
- подтверждение permission-запросов кнопками;
- ответы на формы через `/answer`;
- смена рабочего каталога для администраторов.

## Требования

- Node.js 18+ (рекомендуется Node 22+; для Node 18–21 в проект добавлен
  полифилл `Promise.withResolvers`)
- установленный и работающий OpenCode V2;
- Telegram-бот, созданный через `@BotFather`.

Проверка OpenCode:

```bash
opencode service status
opencode api get /api/info
```

## Установка

```bash
npm install
```

Создайте `.env` на основе `.env.example`:

```env
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_ALLOWED_USER_IDS=11111111,22222222
TELEGRAM_ADMIN_USER_IDS=11111111

OPENCODE_PROJECT_DIR=C:/Users/Iakov/Documents/opencode
STATE_FILE=./data/state.json
```

`TELEGRAM_ALLOWED_USER_IDS` — обязательный список Telegram user ID, которым
разрешено пользоваться ботом. Узнать свой ID можно у ботов вроде `@userinfobot`.

## Запуск

Режим разработки:

```bash
npm run dev
```

Сборка и запуск:

```bash
npm run build
npm start
```

## Команды бота

| Команда | Назначение |
|---|---|
| `/start` | справка |
| `/new` | создать новую сессию OpenCode |
| `/sessions` | показать последние сессии |
| `/use <sessionID>` | переключиться на сессию |
| `/status` | показать текущую сессию |
| `/stop` | прервать выполнение |
| `/dir <path>` | сменить рабочий каталог (только admin) |
| `/answer <formID> <json>` | ответить на форму |

Обычный текст без команды отправляется в текущую сессию OpenCode.

## Как это устроено

```text
Telegram
   │
   ▼
grammY bot
   │
   ├── текст → POST /api/session/{id}/prompt
   ├── callback → POST /api/session/{id}/permission/{requestID}/reply
   └── event stream → refresh messages → Telegram
           │
           ▼
   @opencode/client + HTTP API
```

## Деплой

Для установки бота на удалённый сервер, например Vast.ai, смотрите
[DEPLOY.md](./DEPLOY.md).

## Ограничения

- Поток событий OpenCode не воспроизводит пропущенные события, поэтому бот
  периодически обновляет состояние сессий.
- Формы в текущей версии принимаются в виде JSON через `/answer`.
- Для нескольких пользователей JSON-файла состояния может хватить, но лучше
  перейти на SQLite или Redis.
- Бот и OpenCode должны работать на одной машине. Не выставляйте HTTP API
  OpenCode напрямую в интернет.

## Если ошибка `Promise.withResolvers is not a function`

`@opencode/client` использует возможности Node.js 20/22:
`Promise.withResolvers`, `Array.prototype.toSorted`, `toReversed`, `toSpliced`
и `with`. Для Node.js 18–21 в проекте есть файл `src/preload.ts` с
полифиллами, и он подключается первым в `src/index.ts`.

Рекомендуется всё же обновить Node.js до 22 LTS. Полифиллы нужны как временное
решение для уже установленной версии Node.

