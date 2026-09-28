import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Не задана переменная ${name}`)
  return value
}

function parseIds(name: string): Set<number> {
  return new Set(
    (process.env[name] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite),
  )
}

export const config = {
  telegramToken: required('TELEGRAM_BOT_TOKEN'),
  allowedUserIds: parseIds('TELEGRAM_ALLOWED_USER_IDS'),
  adminUserIds: parseIds('TELEGRAM_ADMIN_USER_IDS'),
  projectDir: process.env.OPENCODE_PROJECT_DIR ?? process.cwd(),
  stateFile: process.env.STATE_FILE ?? './data/state.json',
}
