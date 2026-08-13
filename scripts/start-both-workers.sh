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
    kill $DOCUMENTS_PID $EXCEL_PID 2>/dev/null
    echo -e "${GREEN}✅ All Workers stopped${NC}"
    exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM

echo -e "${BLUE}📋 Worker Configuration:${NC}"
echo "------------------------"
echo -e "• ${GREEN}Documents Worker:${NC}"
echo "  - Config: wrangler.documents.jsonc"
echo "  - Port: 8787"
echo "  - Inspector Port: 9230"
echo "  - URL: http://localhost:8787"
echo "  - Env: workers/documents-local.env"
echo ""
echo -e "• ${GREEN}Excel Worker:${NC}"
echo "  - Config: wrangler.excel.jsonc"
echo "  - Port: 8788"
echo "  - Inspector Port: 9231"
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

# Start Documents Worker in background
echo -e "${BLUE}Starting Documents Worker on port 8787...${NC}"
npx wrangler dev --config wrangler.documents.jsonc --port 8787 --inspector-port 9230 --env-file workers/documents-local.env &
DOCUMENTS_PID=$!
echo -e "${GREEN}Documents Worker PID: $DOCUMENTS_PID${NC}"

# Start Excel Worker in background
echo -e "${BLUE}Starting Excel Worker on port 8788...${NC}"
npx wrangler dev --config wrangler.excel.jsonc --port 8788 --inspector-port 9231 &
EXCEL_PID=$!
echo -e "${GREEN}Excel Worker PID: $EXCEL_PID${NC}"

echo ""
echo -e "${GREEN}✅ All Workers started!${NC}"
echo ""
echo -e "${BLUE}📊 Status:${NC}"
echo "---------"
echo "• Documents Worker: http://localhost:8787"
echo "• Excel Worker: http://localhost:8788"
echo "• Main App: Run 'npm run dev' in another terminal"
echo ""
echo -e "${BLUE}🩺 Health Check URLs:${NC}"
echo "-------------------"
echo "• Documents Worker: curl http://localhost:8787"
echo "• Excel Worker: curl http://localhost:8788/health"
echo "• Excel Worker Info: curl http://localhost:8788/info"
echo ""
echo -e "${YELLOW}🛑 To stop all Workers: Press Ctrl+C${NC}"
echo ""
echo -e "${BLUE}📝 Logs will appear above${NC}"
echo "----------------------------------------"

# Wait for both processes
wait $DOCUMENTS_PID $EXCEL_PID