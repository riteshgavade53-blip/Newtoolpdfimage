# TableCraft — PDF to Excel Converter
## Complete Setup & Run Guide

---

## Project Structure

```
tablecraft/
├── main.py        ← FastAPI backend
├── index.html     ← Frontend (served by FastAPI)
└── README.md      ← This file
```

---

## Step 1 — Python version

Requires **Python 3.9+**. Check yours:

```bash
python --version
```

---

## Step 2 — Create a virtual environment (recommended)

```bash
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

---

## Step 3 — Install core dependencies

```bash
pip install fastapi uvicorn python-multipart \
            pdfplumber pandas openpyxl
```

---

## Step 4 — Install OCR dependencies (optional but recommended for scanned PDFs)

### Install easyocr + pdf2image

```bash
pip install easyocr pdf2image
```

### Install poppler (required by pdf2image)

**macOS:**
```bash
brew install poppler
```

**Ubuntu / Debian:**
```bash
sudo apt-get install -y poppler-utils
```

**Windows:**
Download the binary from https://github.com/oschwartz10612/poppler-windows/releases
and add the `bin/` folder to your system PATH.

> Without poppler/pdf2image/easyocr, the app still works perfectly for
> native/digital PDFs. Scanned PDFs will return a "no tables detected" error.

---

## Step 5 — Place both files in the same folder

```
your-folder/
├── main.py
└── index.html
```

---

## Step 6 — Run the server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open your browser at: **http://localhost:8000**

---

## How it works

| Phase | What happens |
|-------|-------------|
| **Upload** | PDF sent via multipart POST to `/convert` |
| **Lattice mode** | `pdfplumber` detects cell borders using line geometry |
| **Stream mode** | Falls back to text-spacing heuristics if no borders found |
| **OCR mode** | `pdf2image` + `easyocr` for fully scanned documents |
| **Clean** | `pandas` drops empty rows/columns, strips whitespace |
| **Export** | `openpyxl` writes styled `.xlsx` with auto-fit columns |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/`  | Serves `index.html` |
| `POST` | `/convert` | Accepts PDF, returns `.xlsx` |
| `GET`  | `/health` | Health check |

---

## Troubleshooting

**"No tables detected"**
- The PDF may contain images instead of real text. Enable OCR (Step 4).
- Try a different PDF — some documents embed tables as graphics.

**Port already in use**
```bash
uvicorn main:app --reload --port 8080
```
Then change the fetch URL in `index.html` line ~170 from `/convert` to `http://localhost:8080/convert`.

**Slow first OCR run**
EasyOCR downloads language models (~100 MB) on first use. Subsequent runs are fast.

**Windows DLL errors with easyocr**
Install the Visual C++ Redistributable from Microsoft's website.

---

## Production deployment (optional)

```bash
# Run without --reload for production
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
```

For HTTPS, put Nginx or Caddy in front as a reverse proxy.
