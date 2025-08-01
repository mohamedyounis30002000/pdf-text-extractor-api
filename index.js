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

    //احفظ الـ PDF مؤقتًا
    const tempPdf = path.join('/tmp', 'file.pdf');
    fs.writeFileSync(tempPdf, Buffer.from(req.body.pdf_base64, 'base64'));
    //حول كل الصفحات لصور
    await new Promise((resolve, reject) => {
      exec(`pdftoppm "${tempPdf}" "/tmp/page" -png`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // اقرأ الصور الناتجة
    const files = fs.readdirSync('/tmp').filter(file => file.startsWith('page') && file.endsWith('.png'));
    files.sort(); // تأكد إن الصور بترتيب الصفحات

    // OCR لكل صورة
    // let fullText = '';
    for (const file of files) {
      const imagePath = path.join('/tmp', file);
      const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
      fullText += `\n\n--- Page ${file} ---\n\n` + text;
    }

    res.json({ text: fullText.trim() || 'OCR could not extract text' });

  } catch (err) {
    console.error('Error:', err.toString());
    res.status(500).json({ error: 'Failed to process PDF', details: err.toString() });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`PDF OCR Extractor running on port ${PORT}`));
