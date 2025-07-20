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
  let allText = '';

  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) });
    const pdf = await loadingTask.promise;

    console.log(`PDF has ${pdf.numPages} pages`);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        console.log(`Parsing page ${pageNum}...`);
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const text = content.items.map(item => item.str).join(' ');
        allText += text + '\n';

        if (!text.trim()) {
          // Fallback OCR for empty page
          console.log(`Page ${pageNum} empty, trying OCR...`);
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
          allText += ocrText + '\n';
        }

      } catch (pageErr) {
        console.warn(`Failed to parse page ${pageNum}:`, pageErr.toString());
        allText += `\n[Failed to parse page ${pageNum}]\n`;
      }
    }

    return res.json({ text: allText || 'Could not extract text' });

  } catch (err) {
    console.error('Failed to process PDF:', err.toString());
    return res.json({ text: 'Could not parse PDF at all' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`PDF Text Extractor API running on port ${PORT}`));
