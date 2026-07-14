# Setting Up GitHub Repository

## Steps to Push to GitHub

### 1. Create a Repository on GitHub
- Go to https://github.com/new
- Name it: `AI-Political-Agents`
- Choose public or private
- Don't initialize with README (we already have one)

### 2. Add Remote and Push
```bash
# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/AI-Political-Agents.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Alternative: If Using SSH
```bash
git remote add origin git@github.com:YOUR_USERNAME/AI-Political-Agents.git
git branch -M main
git push -u origin main
```

## What's Been Committed

The following AI Political Agents system has been committed:

✓ Base agent framework with personality modeling
✓ Agent factory for creating new political agents
✓ Historical figure agents (Hitler, Gandhi, Jinnah)
✓ Debate simulation system
✓ Web interface (Streamlit)
✓ Example scenarios
✓ Documentation and README

## Next Steps After Push

1. Set up a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the web interface:
   ```bash
   streamlit run web_app.py
   ```

4. Create additional agents using the factory function:
   ```python
   from agents.agent_factory import create_agent
   
   new_agent = create_agent(
       name="Winston Churchill",
       ideology="democracy",
       personality_traits={"assertiveness": 0.85, ...},
       time_period="1940s",
       major_events=["World War II", "Battle of Britain"],
       cultural_background="British, aristocratic"
   )
   ```

## Repository Contents

- `agents/` - Agent framework and implementations
- `debates/` - Debate simulation system
- `examples/` - Example scenarios
- `web_app.py` - Streamlit web interface
- `main.py` - Command-line interface
- `requirements.txt` - Python dependencies
- Documentation and README files
