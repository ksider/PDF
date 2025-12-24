# PDF & Docs Merger (server version)

Объединяет изображения (PNG/JPG), PDF и DOCX в один PDF с сохранением порядка.

## Быстрый старт
- `cd server-version`
- `npm install` (скачает зависимости; puppeteer подтянет Chromium)
- (опционально) LibreOffice: если стоит, укажи путь `SOFFICE_PATH="C:\Program Files\LibreOffice\program\soffice.exe"` или добавь `soffice` в PATH. Если нет — будет fallback через puppeteer.
- `npm start`
- Открой в браузере `http://localhost:3000/index.html`

## Поддерживаемые файлы
- Изображения: PNG, JPG/JPEG
- PDF: незапароленные; защищённые вернут ошибку
- DOCX: конвертация в PDF (LibreOffice или fallback через mammoth+puppeteer), затем склейка

## Проверка
- Загрузить набор PNG/JPEG + PDF + DOCX, отсортировать карточки, нажать скачать — получишь единый PDF.
- Попробовать защищённый PDF — сервер вернёт 400 с текстом ошибки.
- Большие картинки автоматически впишутся в A4 с полями.

## Переменные окружения
- `PORT` — порт сервера (по умолчанию 3000)
- `SOFFICE_PATH` или `LIBREOFFICE_PATH` — путь к `soffice` для DOCX→PDF; если отсутствует, используется puppeteer.

## Структура
- `index.html`, `styles.css`, `config.js`, `app.js` — UI, отправка файлов на `/api/merge`
- `server.js` — Express, сборка PDF (pdf-lib), конвертация DOCX
- `package.json` — зависимости и скрипт `npm start`
