const express = require('express');
const PDFParser = require('pdf2json');

const app = express();
app.use(express.json({ limit: '50mb' }));

app.post('/extract-text', (req, res) => {
    if (!req.body.pdf_base64) {
        return res.status(400).json({ error: 'Missing pdf_base64 field' });
    }

    const pdfBuffer = Buffer.from(req.body.pdf_base64, 'base64');
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", errData =>
        res.status(500).json({ error: 'Failed to parse PDF', details: errData.parserError })
    );

    pdfParser.on("pdfParser_dataReady", pdfData => {
        const text = pdfData.formImage.Pages.map(page =>
            page.Texts.map(t =>
                decodeURIComponent(t.R.map(r => r.T).join(''))
            ).join(' ')
        ).join('\n');
        res.json({ text });
    });

    pdfParser.parseBuffer(pdfBuffer);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`PDF Text Extractor API running on port ${PORT}`));