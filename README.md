# Devin Plugin

Delegate coding tasks to [Devin AI](https://app.devin.ai) directly from Claude. Devin acts as a sub-agent — Claude orchestrates, Devin executes deep software engineering work.

## What's included

| Component | Description |
|-----------|-------------|
| `/devin` command | Quickly assign a task to Devin |
| `devin-orchestration` skill | Guides Claude on when and how to use Devin |
| `devin-mcp` server | Wraps the Devin API with MCP tools |

## Setup

### 1. Install Node.js dependencies

```bash
cd <plugin-root>/servers
npm install
```

### 2. Set your Devin API token

Add this to your environment (e.g. `~/.zshrc` or `~/.bashrc`):

```bash
export DEVIN_API_TOKEN="your_token_here"
```

You can find your token at: https://app.devin.ai → Settings → API

### 3. Reload Claude

Restart Claude after installing the plugin and setting the environment variable.

## Usage

### Via command

```
/devin Fix the login bug in github.com/myorg/myapp — login fails for uppercase emails
```

### Via natural language

- "Deleguj tohle Devinovi"
- "Ať to Devin opraví"
- "Pošli tento task Devinovi"
- "Zkontroluj, co Devin dělá"

## Available MCP tools

| Tool | Description |
|------|-------------|
| `create_devin_session` | Start a new Devin task |
| `get_devin_session` | Check status of a session |
| `send_devin_message` | Send follow-up message to Devin |
| `list_devin_sessions` | List recent sessions |

## Required environment variables

| Variable | Description |
|----------|-------------|
| `DEVIN_API_TOKEN` | Your Devin API Bearer token |
