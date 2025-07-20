const express = require('express');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const Tesseract = require('tesseract.js');
const { createCanvas } = require('canvas');

const app = express();
app.use(express.json({ limit: '50mb' }));

app.post('/extract-text', async (req, res) => {
  if (!req.body.pdf_base64) {
    return res.status(400).json({ error: 'Missing pdf_base64 field' });
  }

  try {
    const pdfData = Buffer.from(req.body.pdf_base64, 'base64');
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) });
    const pdf = await loadingTask.promise;

    let text = '';

    // Try normal parsing
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }

    if (text.trim()) {
      return res.json({ text });
    } else {
      throw new Error('No text found, fallback to OCR');
    }

  } catch (err) {
    console.log('Normal parsing failed:', err.message);
    // Try OCR fallback
    try {
      const pdfData = Buffer.from(req.body.pdf_base64, 'base64');
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) });
      const pdf = await loadingTask.promise;

      // Render first page to image
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const imageBuffer = canvas.toBuffer('image/png');

      const result = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: m => console.log(m),
      });

      return res.json({ text: result.data.text || 'OCR fallback found nothing' });

    } catch (ocrErr) {
      console.error('OCR fallback failed:', ocrErr.message);
      return res.json({ text: 'Could not parse PDF: both parsing and OCR failed.' });
    }
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`PDF Text Extractor API running on port ${PORT}`));
