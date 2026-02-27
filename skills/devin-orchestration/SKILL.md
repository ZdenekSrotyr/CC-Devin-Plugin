---
name: devin-orchestration
description: >
  This skill should be used when the user wants to "delegate a task to Devin",
  "send something to Devin", "let Devin handle it", "assign a coding task to Devin",
  "check what Devin is doing", "ask Devin to fix", "ask Devin to build", or any time
  Devin AI should be used as a sub-agent for software engineering tasks.
version: 0.1.0
---

# Devin Orchestration

Devin is an autonomous AI software engineer. Use it as a sub-agent for coding tasks that require deep, multi-step work — fixing bugs, implementing features, writing tests, refactoring, or working inside a repository.

## When to use Devin vs. doing it directly

Use Devin when the task:
- Requires working inside a specific repository or codebase
- Involves multiple files or steps
- Will take more than a few minutes of focused work
- Benefits from Devin's ability to run code, tests, and see results in real time

Do it directly (without Devin) when:
- The task is a quick explanation, code snippet, or single-file edit
- No repository access is needed
- The user needs an immediate answer

## How to write effective Devin prompts

A good Devin prompt is specific and includes:
1. **What to do** — the goal, clearly stated
2. **Where to do it** — repo URL or name, relevant files/directories
3. **How to verify** — what passing looks like (tests, output, behavior)

Example of a weak prompt:
> "Fix the auth bug"

Example of a strong prompt:
> "In the repo github.com/user/myapp, fix the bug in `src/auth/login.py` where login fails when the email contains uppercase letters. The fix should make the existing test `test_login_case_insensitive` pass."

## Workflow for delegating to Devin

1. Call `create_devin_session` with a well-formed prompt
2. Share the session URL with the user so they can watch Devin work live
3. Poll `get_devin_session` periodically to check status
4. If Devin asks for clarification or gets stuck, use `send_devin_message`
5. When status is `finished`, summarize the result for the user

## Devin session statuses

| Status | Meaning |
|--------|---------|
| `running` | Devin is actively working |
| `waiting` | Devin needs input — send a message |
| `finished` | Task completed |
| `stopped` | Session was stopped manually |

## Polling strategy

Devin tasks can take anywhere from 2 minutes to over an hour. Do not poll more than once every 30 seconds. Inform the user that Devin is working and offer to notify them when done rather than making them wait.

## Sending follow-up messages

Use `send_devin_message` to:
- Answer questions Devin asks
- Provide additional context mid-task
- Course-correct if Devin is going in the wrong direction
- Ask Devin to open a PR when the work is done

## Interpreting results

When a session finishes, `get_devin_session` returns the full session details including:
- Messages exchanged
- Any pull request URLs created
- A summary of what was done

Always surface the PR link and a plain-language summary to the user.
