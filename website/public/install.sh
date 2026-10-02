#!/usr/bin/env bash
# ShieldedShell Installer: curl -fsSL https://shieldedshell.com/install.sh | sh
# ==============================================================================
# Zero-Trust Local Safety Harness for CLI Coding Agents & Dual-Agent Consensus Loops

set -e

RESET="\033[0m"
BOLD="\033[1m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
DIM="\033[2m"

echo -e "${CYAN}${BOLD}"
cat << "EOF"
   _____ _     _      _     _          _ _____ _          _ _ 
  / ____| |   (_)    | |   | |        | / ____| |        | | |
 | (___ | |__  _  ___| | __| | ___  __| | (___ | |__   ___| | |
  \___ \| '_ \| |/ _ \ |/ _` |/ _ \/ _` |\___ \| '_ \ / _ \ | |
  ____) | | | | |  __/ | (_| |  __/ (_| |____) | | | |  __/ | |
 |_____/|_| |_|_|\___|_|\__,_|\___|\__,_|_____/|_| |_|\___|_|_|
EOF
echo -e "   ${BOLD}Zero-Trust Local Safety Harness & Dual-Agent Consensus Loop${RESET}"
echo -e "   ${DIM}Unified Agentic Containment & OpSec Standard (ACOB v2.0)${RESET}\n"

# 1. Check Node.js runtime
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] Node.js is required to run ShieldedShell.${RESET}"
    echo -e "Please install Node.js v20+ from https://nodejs.org or via your package manager."
    exit 1
fi

NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "${YELLOW}[WARNING] Node.js $(node -v) detected. ShieldedShell recommends Node.js v20 or higher.${RESET}"
fi
echo -e "${GREEN}✓${RESET} Detected Node.js $(node -v)"

# 2. Check npm
if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] npm is required to install ShieldedShell CLI.${RESET}"
    exit 1
fi

# 3. Install or update @shieldedshell/cli
echo -e "📦 Installing ${BOLD}@shieldedshell/cli@beta${RESET} globally via npm..."
if npm install -g @shieldedshell/cli@beta >/dev/null 2>&1; then
    echo -e "${GREEN}✓${RESET} Successfully installed global package."
else
    echo -e "${YELLOW}[!] Global npm install required permissions. Trying with prefix ~/.shieldedshell...${RESET}"
    mkdir -p "$HOME/.shieldedshell"
    npm install --prefix "$HOME/.shieldedshell" -g @shieldedshell/cli@beta
    
    SHIELDED_BIN="$HOME/.shieldedshell/bin"
    if [[ ":$PATH:" != *":$SHIELDED_BIN:"* ]]; then
        echo -e "\n${YELLOW}[!] Add ShieldedShell to your PATH by adding this line to your ~/.bashrc or ~/.zshrc:${RESET}"
        echo -e "    ${BOLD}export PATH=\"\$HOME/.shieldedshell/bin:\$PATH\"${RESET}\n"
    fi
fi

# 4. Verify installation
if command -v shieldedshell >/dev/null 2>&1; then
    echo -e "\n${GREEN}${BOLD}✓ ShieldedShell v2 installed successfully!${RESET}\n"
    shieldedshell doctor || true
    echo -e "\n${CYAN}${BOLD}Quick Start:${RESET}"
    echo -e "  ${BOLD}cd your-project${RESET}"
    echo -e "  ${BOLD}shieldedshell init${RESET}           # Initialize zero-trust policy"
    echo -e "  ${BOLD}shieldedshell run --ephemeral claude${RESET} # Run agent in ephemeral CoW overlay"
    echo -e "  ${BOLD}shieldedshell loop --dev claude --audit codellama --goal \"Refactor auth\"${RESET}"
    echo -e "  ${BOLD}shieldedshell acob${RESET}           # View 4-Tier ACOB Containment scorecard\n"
else
    echo -e "${GREEN}✓ Package downloaded.${RESET} Run via npx:"
    echo -e "  ${BOLD}npx @shieldedshell/cli doctor${RESET}\n"
fi
