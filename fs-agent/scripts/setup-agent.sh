#!/bin/bash

# Navigate to the agent directory
cd "$(dirname "$0")/../agent" || exit 1

# Create virtual environment using uv if it doesn't exist
if [ ! -d ".venv" ]; then
  uv venv .venv
fi

# Install requirements using uv
uv pip install -r requirements.txt
