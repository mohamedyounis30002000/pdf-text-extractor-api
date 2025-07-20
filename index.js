const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const pdfParse = require('pdf-parse');

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));

app.post('/extract-text', async (req, res) => {
    try {
        let pdfBuffer;
        if (req.body.pdf_url) {
            const response = await axios.get(req.body.pdf_url, { 
                responseType: 'arraybuffer', 
                httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) 
            });
            pdfBuffer = response.data;
        } else if (req.body.pdf_base64) {
            pdfBuffer = Buffer.from(req.body.pdf_base64, 'base64');
        } else {
            return res.status(400).json({ error: 'Please provide pdf_url or pdf_base64' });
        }

        const data = await pdfParse(pdfBuffer);
        res.json({ text: data.text });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to extract text', details: err.toString() });
    }
});

// Use PORT from environment (needed by Render)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('PDF Text Extractor API running on port ${PORT}'));
