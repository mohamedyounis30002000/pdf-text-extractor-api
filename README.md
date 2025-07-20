# PDF Text Extractor API

Simple Node.js REST API to extract text from a PDF (by URL or Base64).

## How to use

POST `/extract-text`

**Body:**
```json
{ "pdf_url": "https://example.com/file.pdf" }
