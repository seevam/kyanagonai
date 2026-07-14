# Commands: AI Political Agents Simulator

## CLI (Cursor-friendly)
- Summary JSON (no transcript):
```bash
python3 main.py --agents hitler gandhi jinnah \
  --topic territorial_disputes --rounds 10 --format json --summary-only
```
- Full text with transcript:
```bash
python3 main.py --agents gandhi jinnah --topic partition_of_india --rounds 8
```
- Another example:
```bash
python3 main.py --agents hitler gandhi --topic race_relations --rounds 6 --format text --summary-only
```

## FastAPI Frontend (Local UI)
```bash
uvicorn frontend.server:app --reload
# Open http://127.0.0.1:8000
```
- Select agents, topic, rounds, (optional) check "Use Ollama" and set base URL/model.

## Streamlit UI (Alternative)
```bash
pip3 install -r requirements.txt
streamlit run web_app.py
```

## Optional: Ollama (Local LLM)
- Install Ollama: `https://ollama.com`
- Start server:
```bash
ollama serve
```
- Pull a model:
```bash
ollama pull llama3.1:8b
```
- Environment (optional):
```bash
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.1:8b
```
- Use in frontend: check "Use Ollama" and set Base URL / Model
