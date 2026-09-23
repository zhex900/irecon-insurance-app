#!/bin/bash

# Start both Workers with one command
# Documents Worker: http://localhost:8787
# Excel Worker: http://localhost:8788

echo "🚀 Starting all Workers for local development..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to clean up on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping all Workers...${NC}"
    kill $PDF_PID $EXCEL_PID 2>/dev/null
    echo -e "${GREEN}✅ All Workers stopped${NC}"
    exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM

# Free worker HTTP ports from crashed prior runs (do not touch 9230 — main `npm run dev`).
free_port() {
    local port=$1
    local pids
    pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Clearing port $port (PID: $pids)${NC}"
        kill $pids 2>/dev/null || true
        sleep 0.5
    fi
}

PDF_INSPECTOR_PORT=9232
EXCEL_INSPECTOR_PORT=9233

free_port 8787
free_port 8788
free_port "$PDF_INSPECTOR_PORT"
free_port "$EXCEL_INSPECTOR_PORT"

echo -e "${BLUE}📋 Worker Configuration:${NC}"
echo "------------------------"
echo -e "• ${GREEN}PDF Worker:${NC}"
echo "  - Config: wrangler.pdf.jsonc"
echo "  - Port: 8787"
echo "  - Inspector Port: $PDF_INSPECTOR_PORT (9230 is used by main npm run dev)"
echo "  - URL: http://localhost:8787"
echo "  - Env: workers/documents-local.env"
echo ""
echo -e "• ${GREEN}Excel Worker:${NC}"
echo "  - Config: wrangler.excel.jsonc"
echo "  - Port: 8788"
echo "  - Inspector Port: $EXCEL_INSPECTOR_PORT"
echo "  - URL: http://localhost:8788"
echo ""

echo -e "${BLUE}🔗 Main App Configuration:${NC}"
echo "-------------------------"
echo "Add to your .env file:"
echo "  DOCUMENT_SERVICE_URL=http://localhost:8787"
echo "  EXCEL_WORKER_URL=http://localhost:8788"
echo ""

echo -e "${YELLOW}🚦 Starting Workers...${NC}"
echo ""

# Start PDF Worker in background
echo -e "${BLUE}Starting PDF Worker on port 8787...${NC}"
npx wrangler dev --config wrangler.pdf.jsonc --port 8787 --inspector-port "$PDF_INSPECTOR_PORT" --env-file workers/documents-local.env &
PDF_PID=$!
echo -e "${GREEN}PDF Worker PID: $PDF_PID${NC}"

# Start Excel Worker in background
echo -e "${BLUE}Starting Excel Worker on port 8788...${NC}"
npx wrangler dev --config wrangler.excel.jsonc --port 8788 --inspector-port "$EXCEL_INSPECTOR_PORT" --env-file workers/excel-local.env &
EXCEL_PID=$!
echo -e "${GREEN}Excel Worker PID: $EXCEL_PID${NC}"

echo ""
echo -e "${GREEN}✅ All Workers started!${NC}"
echo ""
echo -e "${BLUE}📊 Status:${NC}"
echo "---------"
echo "• PDF Worker: http://localhost:8787"
echo "• Excel Worker: http://localhost:8788"
echo "• Main App: Run 'npm run dev' in another terminal"
echo ""
echo -e "${BLUE}🩺 Health Check URLs:${NC}"
echo "-------------------"
echo "• PDF Worker: curl http://localhost:8787"
echo "• Excel Worker: curl http://localhost:8788/health"
echo "• Excel Worker Info: curl http://localhost:8788/info"
echo ""
echo -e "${YELLOW}🛑 To stop all Workers: Press Ctrl+C${NC}"
echo ""
echo -e "${BLUE}📝 Logs will appear above${NC}"
echo "----------------------------------------"

# Wait for both processes
wait $PDF_PID $EXCEL_PID