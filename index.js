const express = require('express');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const { exec } = require('child_process');

const app = express();
app.use(express.json({ limit: '100mb' }));

app.post('/extract-text', async (req, res) => {
  if (!req.body.pdf_base64) {
    return res.status(400).json({ error: 'Missing pdf_base64 field' });
  }

  try {
    // حفظ مؤقت للـ PDF
    const tempPdf = path.join('/tmp', 'file.pdf');
    fs.writeFileSync(tempPdf, Buffer.from(req.body.pdf_base64, 'base64'));

    // تحويل الصفحات لصور PNG
    await new Promise((resolve, reject) => {
      exec(`pdftoppm "${tempPdf}" "/tmp/page" -png`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // قراءة الصور
    let imageFiles = fs.readdirSync('/tmp')
      .filter(file => file.startsWith('page') && file.endsWith('.png'))
      .sort();

    // ✅ حماية: أقصى عدد صفحات مسموح به
    const MAX_PAGES = 10;
    if (imageFiles.length > MAX_PAGES) {
      return res.status(400).json({ error: `PDF has too many pages (limit is ${MAX_PAGES})` });
    }

    // OCR لكل صورة باستخدام اللغة العربية والإنجليزية
    const ocrPromises = imageFiles.map((file, index) => {
      const imagePath = path.join('/tmp', file);
      return Tesseract.recognize(imagePath, 'eng+ara').then(result => {
        return `\n\n--- Page ${index + 1} ---\n\n` + result.data.text;
      });
    });

    const results = await Promise.all(ocrPromises);
    const fullText = results.join('\n');

    res.json({ text: fullText.trim() || 'OCR could not extract text' });

  } catch (err) {
    console.error('Error:', err.toString());
    res.status(500).json({ error: 'Failed to process PDF', details: err.toString() });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`PDF OCR Extractor running on port ${PORT}`));
