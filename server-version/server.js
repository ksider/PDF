/* Simple server merge: images, PDFs, DOCX (via LibreOffice). */
const express = require('express');
const multer = require('multer');
const { PDFDocument, PageSizes } = require('pdf-lib');
const path = require('path');
const mime = require('mime-types');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const mammoth = require('mammoth');
const puppeteer = require('puppeteer');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

const isImage = (mimetype) => mimetype && mimetype.startsWith('image/');
const isPdf = (mimetype) => mimetype === 'application/pdf';
const isDocx = (mimetype) => mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const embedImage = async (pdfDoc, file) => {
  const buffer = file.buffer;
  const ext = mime.extension(file.mimetype) || '';
  const isPng = ext === 'png';
  const embedded = isPng ? await pdfDoc.embedPng(buffer) : await pdfDoc.embedJpg(buffer);
  const { width, height } = embedded.scale(1);
  const orientation = width >= height ? 'landscape' : 'portrait';
  const [pageWidth, pageHeight] = orientation === 'landscape' ? [PageSizes.A4[1], PageSizes.A4[0]] : PageSizes.A4;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const renderWidth = width * scale;
  const renderHeight = height * scale;
  const x = (pageWidth - renderWidth) / 2;
  const y = (pageHeight - renderHeight) / 2;
  page.drawImage(embedded, { x, y, width: renderWidth, height: renderHeight });
};

const appendPdf = async (pdfDoc, file) => {
  const srcDoc = await PDFDocument.load(file.buffer);
  const pages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
  pages.forEach((p) => pdfDoc.addPage(p));
};

const convertWithSoffice = async (file) => {
  const sofficePath = process.env.SOFFICE_PATH || process.env.LIBREOFFICE_PATH || 'soffice';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-'));
  const docxName = file.originalname && file.originalname.toLowerCase().endsWith('.docx')
    ? file.originalname
    : 'input.docx';
  const docxPath = path.join(tempDir, docxName);
  const pdfPath = path.join(tempDir, `${path.parse(docxName).name}.pdf`);

  fs.writeFileSync(docxPath, file.buffer);

  try {
    await new Promise((resolve, reject) => {
      const proc = spawn(sofficePath, [
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        tempDir,
        docxPath
      ]);
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(stderr || `soffice exited with code ${code}`));
        }
        return resolve();
      });
    });

    const pdfBuffer = fs.readFileSync(pdfPath);
    return pdfBuffer;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const convertWithPuppeteer = async (file) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-'));
  const htmlPath = path.join(tempDir, 'doc.html');
  const { value: html } = await mammoth.convertToHtml({ buffer: file.buffer });
  const fullHtml = `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: "Arial", sans-serif; }
        </style>
      </head>
      <body>${html}</body>
    </html>`;
  fs.writeFileSync(htmlPath, fullHtml, 'utf8');

  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const fileUrl = `file://${htmlPath.replace(/\\/g, '/')}`;
    await page.goto(encodeURI(fileUrl));
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return pdfBuffer;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const convertDocxToPdfBuffer = async (file) => {
  try {
    return await convertWithSoffice(file);
  } catch (err) {
    // Fallback to puppeteer + mammoth if soffice is unavailable.
    return convertWithPuppeteer(file);
  }
};

app.post('/api/merge', upload.array('files'), async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).send('No files uploaded');
  }

  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    try {
      if (isImage(file.mimetype)) {
        await embedImage(pdfDoc, file);
      } else if (isPdf(file.mimetype)) {
        await appendPdf(pdfDoc, file);
      } else if (isDocx(file.mimetype)) {
        const pdfBuffer = await convertDocxToPdfBuffer(file);
        const tmpFile = { buffer: pdfBuffer, mimetype: 'application/pdf' };
        await appendPdf(pdfDoc, tmpFile);
      }
    } catch (err) {
      return res.status(400).send(`Failed on file "${file.originalname}": ${err.message}`);
    }
  }

  const merged = await pdfDoc.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="merged.pdf"');
  res.send(Buffer.from(merged));
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
