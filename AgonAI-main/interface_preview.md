# AI Political Agents - Web Interface Preview

## 🏛️ Main Interface

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Political Agents                         │
│                 Debate Simulator                               │
│                                                                 │
│  ┌─────────────────────────────────┐  ┌─────────────────────┐   │
│  │        Configuration            │  │   Quick Scenarios   │   │
│  │                                 │  │                     │   │
│  │  Select Agents:                 │  │  [Hitler vs Gandhi  │   │
│  │  ☑ Hitler                       │  │   vs Jinnah]        │   │
│  │  ☑ Gandhi                       │  │                     │   │
│  │  ☑ Jinnah                       │  │  [Hitler vs Gandhi] │   │
│  │                                 │  │                     │   │
│  │  Topic: territorial_disputes    │  │  [Gandhi vs Jinnah] │   │
│  │                                 │  │                     │   │
│  │  Max Rounds: [15]               │  │                     │   │
│  │  Consensus: [0.7]               │  │                     │   │
│  │                                 │  │                     │   │
│  │  [🚀 Start Debate]              │  │                     │   │
│  └─────────────────────────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Debate Results Display

```
┌─────────────────────────────────────────────────────────────────┐
│                        Debate Results                          │
│                                                                 │
│  Status: DEADLOCK        Consensus: 0.15    Rounds: 12         │
│  Duration: 3.2 min                                              │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │   Key Agreements    │  │    Key Disagreements           │   │
│  │                     │  │                                 │   │
│  │  • None found       │  │  • Territorial expansion       │   │
│  │                     │  │  • Race relations              │   │
│  │                     │  │  • Economic policy             │   │
│  │                     │  │  • Military strategy           │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Debate Transcript                        │ │
│  │                                                             │ │
│  │  Round 1 - Hitler:                                         │ │
│  │  "I speak with the authority of the German people!         │ │
│  │   Gandhi and Jinnah, you fail to understand the            │ │
│  │   fundamental truth: Germany requires Lebensraum..."       │ │
│  │                                                             │ │
│  │  Round 2 - Gandhi:                                         │ │
│  │  "My dear Hitler and Jinnah, I speak to you with          │ │
│  │   love and compassion. Territorial disputes are born       │ │
│  │   from the illusion of separation..."                      │ │
│  │                                                             │ │
│  │  Round 3 - Jinnah:                                         │ │
│  │  "My dear Hitler and Gandhi, the question of territory    │ │
│  │   is not merely about land - it is about the very         │ │
│  │   survival of Muslim civilization..."                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Example Debate Scenarios

### Scenario 1: Hitler vs Gandhi vs Jinnah
- **Topic**: Territorial Disputes
- **Expected Result**: Very low consensus (0.1-0.2)
- **Key Issues**: German expansion vs non-violence vs Muslim state

### Scenario 2: Hitler vs Gandhi
- **Topic**: Race Relations  
- **Expected Result**: No consensus (0.0)
- **Key Issues**: Aryan supremacy vs equality of all races

### Scenario 3: Gandhi vs Jinnah
- **Topic**: Partition of India
- **Expected Result**: Moderate consensus (0.3-0.4)
- **Key Issues**: Unity vs separate Muslim state

## 🔧 Features Available

### Real-time Analysis
- Consensus score tracking
- Personality compatibility analysis
- Ideology alignment measurement
- Deadlock detection

### Export Options
- JSON data export
- Text transcript download
- CSV analysis files
- Visualization charts

### Interactive Controls
- Agent selection
- Topic customization
- Round limits
- Consensus thresholds
- Historical context settings

## 🚀 Getting Started

Once the Xcode tools installation completes:

1. **Install Dependencies**:
   ```bash
   pip3 install -r requirements.txt
   ```

2. **Launch Web App**:
   ```bash
   streamlit run web_app.py
   ```

3. **Open Browser**: Navigate to `http://localhost:8501`

4. **Start Debating**: Select agents and topics, then click "Start Debate"

The system will simulate realistic political debates between historical figures and analyze their potential for consensus!
