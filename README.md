# PDF Text Extractor API

Node.js REST API to extract text from PDF files.  
- First tries to parse text using pdfjs-dist.
- If parsing fails, uses OCR (tesseract.js) to extract text from page images.

## Install
```bash
npm install
