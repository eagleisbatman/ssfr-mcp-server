# 🌾 SSFR MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

**Model Context Protocol (MCP) server providing Site-Specific Fertilizer Recommendations (SSFR) for Ethiopian farmers.**

Provides personalized fertilizer quantity and type advice based on location coordinates using the Next-gen Agro Advisory Service.

## ✨ Features

### 1 MCP Tool

| Tool | Purpose |
|------|---------|
| `get_fertilizer_recommendation` | Get fertilizer recommendations for wheat or maize. Automatically checks if location is in Ethiopia. |

### Supported Crops (2)

- **Wheat** - Urea, NPS, Compost, Vermicompost, Expected Yield
- **Maize** - Urea, NPS, Compost, Vermicompost, Expected Yield

### Geographic Coverage

**IMPORTANT:** This MCP server only works for locations within **Ethiopia**.

Ethiopia bounds:
- Latitude: 3.0°N to 15.0°N
- Longitude: 32.0°E to 48.0°E

## 🏃 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- No API token required (Next-gen Agro Advisory API is public)

### Local Setup

```bash
# Clone and install
cd ssfr-mcp-server
npm install

# Start development server
npm run dev

# Test
curl http://localhost:3001/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "ssfr-mcp-server",
  "supportedCrops": ["wheat", "maize"],
  "supportedRegion": "Ethiopia"
}
```

## ⚙️ Configuration

### Environment Variables

```bash
# Optional (defaults shown)
PORT=3001
SSFR_API_BASE_URL=https://webapi.nextgenagroadvisory.com
ALLOWED_ORIGINS=*
```

## 🚀 Deployment

This server can be deployed to any Node.js hosting platform:

- **PaaS:** Railway, Heroku, Render, Fly.io
- **Cloud:** AWS (EC2/Lambda), Google Cloud Run, Azure App Service
- **Containerized:** Docker, Kubernetes
- **VPS:** DigitalOcean, Linode, your own server

### Railway Deployment

1. **Push code to GitHub**
2. **Connect to Railway**
3. **Deploy** - Railway auto-detects Node.js
4. **Test:** `curl https://your-deployment-url/health`

## 🔌 Integration

### OpenAI Agent Builder

**1. Deploy MCP Server** (any platform)

**2. Create Agent Workflow:**
- Go to [platform.openai.com](https://platform.openai.com/playground/agents)
- Create new agent

**3. Add MCP Server:**
- Add Tool → Custom MCP Server
- **Name:** `ssfr-fertilizer-recommendations`
- **Transport:** `StreamableHTTP`
- **URL:** `https://your-deployment-url/mcp`

**4. Configure System Prompt:**

The agent should:
- Check `is_ssfr_enabled` first if user asks about fertilizers
- Only call `get_fertilizer_recommendation` for Ethiopian locations
- Use farmer-friendly language (hybrid approach: description + numbers + explanation)
- Format responses clearly for farmers

## 🏗️ Architecture

```
AI Agent (OpenAI/Claude/Custom)
    ↓ MCP Protocol (StreamableHTTP) + Custom Headers
Express.js MCP Server (This Repo)
    ↓ Reads X-Farm-Latitude, X-Farm-Longitude from headers
    ↓ HTTP REST
Next-gen Agro Advisory API
    - Provides: Fertilizer recommendations
    - Returns: Urea, NPS, Compost, Vermicompost quantities + Expected yield
```

## 📁 Project Structure

```
ssfr-mcp-server/
├── src/
│   ├── index.ts          # Main: 2 MCP tools + server setup
│   └── ssfr-client.ts    # Next-gen Agro Advisory API client
├── dist/                 # Compiled output (generated)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript config
├── railway.json          # Railway deployment config
└── README.md             # This file
```

## 🛠️ Development

### Commands

```bash
npm install     # Install dependencies
npm run build   # Compile TypeScript
npm run dev     # Development mode (hot reload)
npm start       # Production mode
```

## 📚 API Reference

### Tool: get_fertilizer_recommendation

**Purpose:** Get fertilizer recommendations for wheat or maize

**Parameters:**
- `ssfr_crop` (required): "wheat" or "maize" (matches FarmerChat API field name)
- `latitude` (optional): Latitude coordinate
- `longitude` (optional): Longitude coordinate
- `query` (optional): User query text for context

**Note:** This tool automatically checks if the location is in Ethiopia. If coordinates are outside Ethiopia, it returns an error.

**Returns:**
```json
{
  "crop": "wheat",
  "location": {
    "latitude": 12.9345,
    "longitude": 77.6266
  },
  "fertilizers": {
    "organic": {
      "compost": 20,
      "vermicompost": 16
    },
    "inorganic": {
      "urea": 265.67,
      "nps": 0
    }
  },
  "expected_yield": 3580.53,
  "data_source": "Next-gen Agro Advisory Service",
  "units": {
    "organic": "tons/ha",
    "inorganic": "kg/ha",
    "yield": "kg/ha"
  }
}
```

## 🐛 Troubleshooting

### Server Won't Start

**Error:** Port already in use

```bash
# Use different port
PORT=3002 npm start
```

### Location Not Supported

**Error:** Coordinates outside Ethiopia

- Verify coordinates are within Ethiopia bounds:
  - Latitude: 3.0°N to 15.0°N
  - Longitude: 32.0°E to 48.0°E
- Use `is_ssfr_enabled` tool first to check availability

### API Errors

**404 Not Found:** Invalid layer name or coordinates
**500 Internal Server Error:** API service unavailable

Check Next-gen Agro Advisory API status.

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

**Site-Specific Fertilizer Recommendations for Ethiopian farmers 🌾**

