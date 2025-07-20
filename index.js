const express = require('express');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const { exec } = require('child_process');

const app = express();
app.use(express.json({ limit: '50mb' }));

app.post('/extract-text', async (req, res) => {
  if (!req.body.pdf_base64) {
    return res.status(400).json({ error: 'Missing pdf_base64 field' });
  }

  try {
    // نحفظ pdf مؤقتًا
    const tempPdf = path.join('/tmp', 'file.pdf');
    fs.writeFileSync(tempPdf, Buffer.from(req.body.pdf_base64, 'base64'));

    // نحول أول صفحة لصورة
    const tempImage = path.join('/tmp', 'page.png');
    await new Promise((resolve, reject) => {
      exec(`pdftoppm -f 1 -singlefile -png "${tempPdf}" "/tmp/page"`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // OCR
    const { data: { text } } = await Tesseract.recognize(tempImage, 'eng');
    res.json({ text: text || 'OCR could not extract text' });

  } catch (err) {
    console.error('Error:', err.toString());
    res.status(500).json({ error: 'Failed to process PDF', details: err.toString() });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`PDF OCR Extractor running on port ${PORT}`));
