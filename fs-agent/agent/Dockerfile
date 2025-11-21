FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

# Copy dependency files
COPY requirements.txt pyproject.toml langgraph.json ./

# Create virtual environment and install dependencies
RUN /root/.local/bin/uv venv .venv && \
    /root/.local/bin/uv pip install -r requirements.txt && \
    /root/.local/bin/uv pip install -e . && \
    ls -la .venv/bin/ | head -10 && \
    test -f .venv/bin/python && echo "✅ Python exists" || echo "❌ Python missing"

# Copy application code (but preserve .venv)
COPY agent.py __init__.py langgraph.json ./

# Verify venv still exists after COPY
RUN test -f .venv/bin/python && echo "✅ Python still exists after COPY" || (echo "❌ Python missing after COPY" && ls -la .venv/bin/ 2>&1 | head -5)

# Expose the agent port
EXPOSE 8123

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8123/docs || exit 1

# Run the agent using Python module from venv
WORKDIR /app
CMD [".venv/bin/python", "-m", "langgraph_cli", "dev", "--host", "0.0.0.0", "--port", "8123", "--no-browser"]

