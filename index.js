const express = require('express');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const Tesseract = require('tesseract.js');
const { createCanvas } = require('canvas');

const app = express();
app.use(express.json({ limit: '50mb' }));

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

app.post('/extract-text', async (req, res) => {
  if (!req.body.pdf_base64) {
    return res.status(400).json({ error: 'Missing pdf_base64 field' });
  }

  const pdfData = Buffer.from(req.body.pdf_base64, 'base64');

  try {
    // محاولة parsing عادي
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) });
    const pdf = await loadingTask.promise;

    let text = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }

    if (text.trim()) {
      return res.json({ text });
    } else {
      throw new Error("Parsed text is empty, try OCR");
    }

  } catch (parseErr) {
    console.warn('PDF parse failed, fallback to OCR:', parseErr.toString());

    try {
      // fallback OCR: نحول أول صفحة صورة + OCR
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      const viewport = page.getViewport({ scale: 2.0 });
      const canvasFactory = new NodeCanvasFactory();
      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
      const renderContext = {
        canvasContext: canvasAndContext.context,
        viewport: viewport,
        canvasFactory: canvasFactory
      };
      await page.render(renderContext).promise;

      const image = canvasAndContext.canvas.toBuffer();

      const { data: { text: ocrText } } = await Tesseract.recognize(image, 'eng');
      return res.json({ text: ocrText || 'OCR could not extract text' });

    } catch (ocrErr) {
      console.error('OCR failed:', ocrErr.toString());
      return res.json({ text: 'Could not parse PDF text (maybe file is corrupted or unsupported structure)' });
    }
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`PDF Text Extractor API running on port ${PORT}`));
