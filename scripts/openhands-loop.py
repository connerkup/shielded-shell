#!/usr/bin/env python3
"""One-shot OpenHands SDK turn for ShieldedShell dual-agent loops.

Requires: pip install -U openhands-sdk openhands-tools
Env: LLM_API_KEY, optional LLM_MODEL / LLM_BASE_URL
"""

from __future__ import annotations

import argparse
import os
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Run one OpenHands SDK conversation turn")
    parser.add_argument("--prompt-file", required=True, help="Agent prompt text file")
    parser.add_argument("--workspace", required=True, help="Workspace directory")
    args = parser.parse_args()

    workspace = os.path.abspath(args.workspace)
    with open(args.prompt_file, encoding="utf-8") as handle:
        task = handle.read()

    task += (
        "\n\nIMPORTANT: Execute the agent prompt immediately. Write your complete JSON "
        "response to the Write Target file named in the prompt. Do not only reply in chat or stdout."
    )

    os.chdir(workspace)

    try:
        from openhands.sdk import LLM, Agent, Conversation, Tool
        from openhands.tools.file_editor import FileEditorTool
        from openhands.tools.terminal import TerminalTool
    except ImportError:
        print(
            "OpenHands SDK not installed. Run: pip install -U openhands-sdk openhands-tools",
            file=sys.stderr,
        )
        return 1

    llm = LLM(
        model=os.getenv("LLM_MODEL", "anthropic/claude-sonnet-4-5-20250929"),
        api_key=os.getenv("LLM_API_KEY"),
        base_url=os.getenv("LLM_BASE_URL") or None,
    )
    agent = Agent(
        llm=llm,
        tools=[
            Tool(name=TerminalTool.name),
            Tool(name=FileEditorTool.name),
        ],
    )
    conversation = Conversation(agent=agent, workspace=workspace)
    conversation.send_message(task)
    conversation.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
