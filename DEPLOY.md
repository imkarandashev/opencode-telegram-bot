# Деплой бота на удалённый сервер (Vast.ai)

Если на локальном компьютере сеть не даёт достучаться до Telegram API, проще
всего перенести бота на Vast.ai: там есть выход в интернет, а бот
подключается к Telegram самостоятельно.

## 1. Что арендовать на Vast.ai

- **OS:** Ubuntu 22.04 или 24.04.
- **Архитектура:** x86_64 (обычный Intel/AMD).
- **GPU:** не нужен для Telegram-бота, можно взять самый дешёвый CPU-инстанс.
- **Диск:** 20–40 GB достаточно.
- **Сеть:** нужен SSH и исходящий интернет. SSH-порт (22) обычно открыт.
- **Регион:** лучше US/EU — там Telegram API обычно не блокируется.

После создания Vast.ai даст команду для подключения по SSH.

## 2. Подготовка сервера

Подключитесь по SSH:

```bash
ssh user@<vast-ip>
```

Обновите пакеты и поставьте необходимое:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip build-essential
```

### Node.js 22 LTS

Рекомендуется именно 22-я версия — тогда не понадобятся полифиллы.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
node --version   # должно быть v22.x.x
```

### OpenCode CLI

```bash
curl -fsSL https://opencode.ai/v2/install | bash
```

Перелогиньтесь или выполните:

```bash
source ~/.bashrc
```

Проверьте:

```bash
opencode service status
opencode api get /api/info
```

## 3. Перенос проекта

Вариант A — через архив с локального компьютера.

На локальной машине (PowerShell, из папки бота):

```powershell
Compress-Archive -Path src, package.json, tsconfig.json, .env.example, .gitignore, README.md, DEPLOY.md -DestinationPath ../opencode-telegram-bot.zip -Force
```

Затем загрузите на сервер:

```bash
scp opencode-telegram-bot.zip user@<vast-ip>:~/
```

На сервере:

```bash
unzip -q ~/opencode-telegram-bot.zip -d ~/opencode-telegram-bot
cd ~/opencode-telegram-bot
npm install
npm run build
```

Вариант B — через Git:

```bash
git clone https://github.com/ВАШ_РЕПОЗИТОРИЙ/opencode-telegram-bot.git
cd opencode-telegram-bot
npm install
npm run build
```

## 4. Настройка окружения

```bash
cp .env.example .env
nano .env
```

Заполните реальными значениями:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHI...
TELEGRAM_ALLOWED_USER_IDS=ваш_telegram_user_id
TELEGRAM_ADMIN_USER_IDS=ваш_telegram_user_id
OPENCODE_PROJECT_DIR=/home/user/папка_с_проектом_для_opencode
STATE_FILE=./data/state.json
```

`TELEGRAM_BOT_TOKEN` получите у `@BotFather`.

## 5. Запуск через tmux (быстрый вариант)

```bash
cd ~/opencode-telegram-bot
tmux new -s bot
npm run dev
```

Отключитесь от сессии: `Ctrl+B`, затем `D`.

Подключиться снова:

```bash
tmux attach -t bot
```

## 6. Запуск через systemd (надёжный вариант)

Создайте сервис:

```bash
sudo nano /etc/systemd/system/opencode-bot.service
```

Пример (замените `user` и пути):

```ini
[Unit]
Description=OpenCode Telegram Bot
After=network.target

[Service]
Type=simple
User=user
WorkingDirectory=/home/user/opencode-telegram-bot
ExecStart=/usr/bin/npm start
Restart=on-failure
EnvironmentFile=/home/user/opencode-telegram-bot/.env

[Install]
WantedBy=multi-user.target
```

Активируйте и запустите:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now opencode-bot
sudo journalctl -u opencode-bot -f
```

Перезапуск:

```bash
sudo systemctl restart opencode-bot
```

## 7. Безопасность

- Открывайте наружу только SSH (порт 22).
- Не выставляйте HTTP API OpenCode (`localhost:4096`) в интернет.
- Используйте `TELEGRAM_ALLOWED_USER_IDS`, чтобы бот отвечал только вам.
- Храните `.env` с токеном в секрете.
- Не сохраняйте токен в репозиторий (`.env` уже в `.gitignore`).

## 8. Персистентность

Vast.ai-инстанс можно остановить — данные обычно остаются на диске.
Но если инстанс уничтожить (`Destroy`), файлы пропадут.

Перед уничтожением сохраните:

```bash
scp user@<vast-ip>:~/opencode-telegram-bot/data/state.json .
```

При пересоздании сервера верните `state.json` обратно.

## 9. Если Telegram всё равно недоступен

Если Vast.ai в выбранном регионе блокирует `api.telegram.org`, попробуйте:

- другой регион;
- поднять локальный Telegram Bot API;
- настроить HTTP-прокси в `grammy` (см. документацию grammY).

## 10. Управление OpenCode на сервере

Если хотите зайти в TUI OpenCode прямо на сервере:

```bash
opencode
```

Если хотите управлять с локальной машины, пробросьте порт через SSH:

```bash
ssh -L 4096:localhost:4096 user@<vast-ip>
```

А затем:

```bash
opencode --server http://localhost:4096
```
