const express = require('express');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const app = express();
app.use(express.json({ limit: '50mb' }));

app.post('/extract-text', async (req, res) => {
    if (!req.body.pdf_base64) {
        return res.status(400).json({ error: 'Missing pdf_base64 field' });
    }

    try {
        const pdfData = Buffer.from(req.body.pdf_base64, 'base64');
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;

        let text = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }

        res.json({ text });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to extract text', details: err.toString() });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`PDF Text Extractor API running on port ${PORT}`));
