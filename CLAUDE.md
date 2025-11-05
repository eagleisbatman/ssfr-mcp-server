# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: SSFR MCP Server

**Express.js server implementing Model Context Protocol (MCP) to provide Site-Specific Fertilizer Recommendations (SSFR) for Ethiopian farmers via Next-gen Agro Advisory Service.**

## Architecture

This is a **data transformation layer** that:
1. Receives tool requests via MCP StreamableHTTP protocol
2. Validates location is within Ethiopia bounds
3. Fetches fertilizer recommendations from Next-gen Agro Advisory API
4. Returns structured JSON for agent analysis

**Critical: SSFR is ONLY available for Ethiopian locations. The server validates coordinates before making API calls.**

## Key Files

### src/index.ts
Main server file containing:
- Express.js setup with CORS
- MCP server initialization
- **2 SSFR tools** (see below)
- Location validation logic

### src/ssfr-client.ts
Wrapper for Next-gen Agro Advisory API:
- `isInEthiopia(lat, lon)` - Validates Ethiopian location
- `getLayerData(layer, lat, lon, date)` - Fetches data from specific layer
- `getFertilizerRecommendation(crop, lat, lon)` - Gets complete recommendation

## Development Commands

```bash
# Install dependencies
npm install

# Development (with auto-reload)
npm run dev

# Build TypeScript
npm run build

# Production
npm start

# Test health endpoint
curl http://localhost:3001/health
```

## The 2 SSFR Tools

All defined in `src/index.ts` as `server.tool()` calls:

### 1. is_ssfr_enabled
**Lines: ~67-112**
- **Purpose**: Check if SSFR is available for a location
- **Input**: latitude, longitude (optional if in headers)
- **Process**: Validates coordinates are within Ethiopia bounds
- **Output**: JSON with `is_enabled` boolean and location info
- **Key**: Always call this first before getting recommendations

### 2. get_fertilizer_recommendation
**Lines: ~115-205**
- **Purpose**: Get complete fertilizer recommendation for wheat or maize
- **Input**: crop (required), latitude, longitude (optional)
- **Process**:
  - Validates location is in Ethiopia
  - Fetches data from 5 layers in parallel:
    - Compost layer
    - NPS layer
    - Urea layer
    - Vermicompost layer
    - Yield layer
  - Combines results into structured recommendation
- **Output**: JSON with organic/inorganic fertilizers, expected yield, units
- **Crops**: wheat, maize only

## Supported Crops

**Wheat and Maize only** - These are the only crops supported by the Next-gen Agro Advisory API for SSFR.

## Ethiopia Location Validation

**Bounds:**
- Latitude: 3.0°N to 15.0°N
- Longitude: 32.0°E to 48.0°E

**Example valid locations:**
- Addis Ababa: ~9.1450°N, 38.7617°E
- Bishoftu: ~8.7525°N, 38.9784°E

**If coordinates are outside Ethiopia:**
- `is_ssfr_enabled` returns `is_enabled: false`
- `get_fertilizer_recommendation` returns error with location bounds info

## Tool Implementation Pattern

Every tool follows this structure:

```typescript
server.tool(
  'tool_name',
  'Farmer-friendly description',
  {
    latitude: z.number().optional().describe('...Optional if in headers'),
    longitude: z.number().optional().describe('...Optional if in headers'),
    // ... other params
  },
  async ({ latitude, longitude, ... }) => {
    try {
      // 1. Get coordinates (params or headers)
      const lat = latitude ?? defaultLatitude;
      const lon = longitude ?? defaultLongitude;

      // 2. Validate coordinates
      if (lat === undefined || lon === undefined) {
        return { content: [{ type: 'text', text: 'Farmer-friendly error' }], isError: true };
      }

      // 3. Validate Ethiopia location (for SSFR tools)
      if (!ssfrClient.isInEthiopia(lat, lon)) {
        return { content: [{ type: 'text', text: 'Location not in Ethiopia' }], isError: true };
      }

      // 4. Fetch data from API
      const data = await ssfrClient.getFertilizerRecommendation(crop, lat, lon);

      // 5. Format response (structured JSON for agent)
      const response = {
        // ... structured data
      };

      // 6. Return
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };

    } catch (error) {
      return { content: [{ type: 'text', text: 'Farmer-friendly error message' }], isError: true };
    }
  }
);
```

## Next-gen Agro Advisory API Details

**Base URL:** `https://webapi.nextgenagroadvisory.com`

**Endpoint Pattern:** `/coordinates/{layer}/{coordinates}/{date}`

**Parameters:**
- `layer`: Layer name (e.g., `et_wheat_urea_probabilistic_dominant`)
- `coordinates`: URL-encoded JSON array: `[{"lat":12.9345,"lon":77.6266}]`
- `date`: "2025-07" for DAP layer, "2024-07" for others

**Response Format:**
- Returns coordinate data with values
- Each layer returns different fertilizer type or yield data
- Values are in tons/ha (organic) or kg/ha (inorganic, yield)

## Custom Headers for Coordinates

The MCP endpoint accepts default coordinates via HTTP headers:
- `X-Farm-Latitude`: Default latitude if not in tool params
- `X-Farm-Longitude`: Default longitude if not in tool params

Set by ChatKit session server when creating sessions.

## Deployment (Railway)

**Config file:** `railway.json`

Railway automatically:
1. Detects Node.js project
2. Runs `npm install`
3. Runs `npm run build`
4. Runs `npm start`

**Health check:**
```
GET /health
```

**MCP endpoint:**
```
POST /mcp
```

## Testing Locally

```bash
# Start server
npm run dev

# Test health
curl http://localhost:3001/health
# Expected: {"status":"healthy","service":"ssfr-mcp-server",...}

# Test root
curl http://localhost:3001/
# Expected: Server info with list of 2 tools

# Test MCP endpoint (requires MCP client like Agent Builder)
# Cannot test with curl - requires MCP protocol
```

## Code Quality Guidelines

### When Modifying SSFR Logic
- Always validate Ethiopia location first
- Handle API errors gracefully
- Return farmer-friendly error messages
- Use structured JSON for agent analysis

### When Adding Features
- Follow existing tool pattern
- Add descriptive logging: `console.log('[MCP Tool] tool_name called: ...')`
- Return farmer-friendly errors
- Update tool descriptions

### TypeScript Patterns
- Use z.enum() for crop types
- Use optional parameters with `??` fallback for coordinates
- Type API responses (see ssfr-client.ts)
- Handle errors gracefully

## Common Issues

**"Location not supported"**
- Check coordinates are within Ethiopia bounds
- Use `is_ssfr_enabled` tool first to verify
- Verify coordinates are correct (lat/lon not swapped)

**API errors**
- Check Next-gen Agro Advisory API is responding
- Verify layer names are correct
- Check date format is correct (YYYY-MM)
- Test API endpoint directly with curl

**Responses showing coordinates**
- Search for `(${lat}, ${lon})` in code
- Replace with farmer-friendly headers
- Add location context without exposing coordinates

## Related Files

- **../gap-mcp-server/src/index.ts**: Reference implementation for MCP server
- **../gap-chat-widget/SYSTEM_PROMPT_GAP_ONLY.md**: Agent Builder system prompt (can be adapted for SSFR)

## GitHub Repository

https://github.com/eagleisbatman/ssfr-mcp-server

Changes pushed to `main` branch trigger automatic Railway deployment.

