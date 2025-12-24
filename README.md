# PDF Merger — server and serverless builds

This project provides two builds: a server version that merges images, DOCX, and PDFs, and a fully client-side version aimed at merging images directly in the browser.

## Tech stack
- **Server build:** Node.js with Express, Multer for uploads, pdf-lib for PDF assembly, mammoth + libreoffice-convert for DOCX→PDF, puppeteer as a fallback, mime-types for detection; UI uses plain HTML/CSS/JS with SortableJS.
- **Serverless build:** plain HTML/CSS/JS with pdf-lib in the browser, SortableJS for drag-and-drop ordering, html2canvas + mammoth to render content to images; main use case is merging images locally without a backend.

## Quick start
- **Server:** `cd server-version && npm install && npm start`, then open `http://localhost:3000/index.html`. For DOCX conversion, set `SOFFICE_PATH`/`LIBREOFFICE_PATH` to a LibreOffice executable; without it, puppeteer fallback is used.
- **Serverless:** open `serverless/index.html` in a browser (locally or from any static host). Runs fully on the client; large DOCX/PDF files can be limited by browser resources, while images are the primary scenario.

## Features
- Drag-and-drop ordering of cards with preserved sequence in the final PDF.
- Automatic fitting of images onto an A4 page with margins.
- Server build accepts JPG/PNG/PDF/DOCX, returns a single PDF, and rejects protected PDFs.
- Serverless build requires no Node.js or external services and works offline after the page is loaded.

## Structure
- `server-version/` — server plus frontend for merging images, DOCX, and PDF files.
- `serverless/` — frontend for local merging (focused on images).

## License
MIT — see `LICENSE`.
