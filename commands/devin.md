---
description: Delegate a coding task to Devin AI
allowed-tools: mcp__devin-mcp__create_devin_session, mcp__devin-mcp__get_devin_session, mcp__devin-mcp__send_devin_message, mcp__devin-mcp__list_devin_sessions
argument-hint: <task description>
---

The user wants to delegate the following task to Devin AI: $ARGUMENTS

Follow these steps:

1. If $ARGUMENTS is empty, ask the user what task they want to give Devin before proceeding.

2. Expand the task into a detailed, specific Devin prompt. Include:
   - A clear goal
   - Any relevant repository, files, or context from the conversation
   - How to verify success (tests, expected output, or behavior)

3. Call `create_devin_session` with the expanded prompt.

4. After creating the session, tell the user:
   - That Devin has started working
   - The session URL so they can watch live
   - That you'll check back on progress

5. Call `get_devin_session` once after ~30 seconds to get an initial status update and share it with the user.

6. If the session status is `waiting`, Devin needs input. Read the latest message and respond appropriately using `send_devin_message`.

7. Keep the user informed. Do not leave them without an update for more than a few exchanges.
