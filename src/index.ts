import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { SSFRClient, ETHIOPIA_BOUNDS } from './ssfr-client.js';

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  exposedHeaders: ['Mcp-Session-Id'],
  allowedHeaders: ['Content-Type', 'mcp-session-id', 'Authorization', 'X-Farm-Latitude', 'X-Farm-Longitude']
}));

// Environment variables
const PORT = process.env.PORT || 3001;
const SSFR_API_BASE_URL = process.env.SSFR_API_BASE_URL || 'https://webapi.nextgenagroadvisory.com';

// Initialize SSFR Client
const ssfrClient = new SSFRClient(SSFR_API_BASE_URL);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ssfr-mcp-server',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    supportedCrops: ['wheat', 'maize'],
    supportedRegion: 'Ethiopia'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'SSFR MCP Server',
    version: '1.0.0',
    description: 'Site-Specific Fertilizer Recommendations for Ethiopian farmers via Next-gen Agro Advisory Service',
    endpoints: {
      health: '/health',
      mcp: '/mcp (POST)'
    },
    tools: [
      'get_fertilizer_recommendation'
    ],
    supportedCrops: ['wheat', 'maize'],
    supportedRegion: 'Ethiopia only'
  });
});

// Main MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    // Extract default coordinates from custom headers
    const headerLat = req.headers['x-farm-latitude'] as string;
    const headerLon = req.headers['x-farm-longitude'] as string;
    const defaultLatitude = headerLat ? parseFloat(headerLat) : undefined;
    const defaultLongitude = headerLon ? parseFloat(headerLon) : undefined;

    if (defaultLatitude && defaultLongitude) {
      console.log(`[MCP] Using default coordinates from headers: lat=${defaultLatitude}, lon=${defaultLongitude}`);
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined // Stateless
    });

    const server = new McpServer({
      name: 'ssfr-fertilizer-recommendations',
      version: '1.0.0',
      description: 'Site-Specific Fertilizer Recommendations (SSFR) for Ethiopian farmers. Provides personalized fertilizer quantity and type advice based on location coordinates. Only works for Ethiopian locations.'
    });

    // Single Tool: Get fertilizer recommendation (matches FarmerChat API structure)
    server.tool(
      'get_fertilizer_recommendation',
      'Get Site-Specific Fertilizer Recommendation for wheat or maize. This tool automatically checks if the location is in Ethiopia. Returns organic and inorganic fertilizer quantities (Compost, Vermicompost, Urea, NPS) plus expected yield.',
      {
        ssfr_crop: z.enum(['wheat', 'maize']).describe('Crop type: wheat or maize (matches FarmerChat API field name)'),
        latitude: z.number().min(-90).max(90).optional().describe('Latitude coordinate. Optional if provided in headers.'),
        longitude: z.number().min(-180).max(180).optional().describe('Longitude coordinate. Optional if provided in headers.'),
        query: z.string().optional().describe('Optional user query text (e.g., "What is the recommended quantity of fertilizer for wheat?"). Used for context but not required.')
      },
      async ({ ssfr_crop, latitude, longitude, query }) => {
        try {
          const lat = latitude ?? defaultLatitude;
          const lon = longitude ?? defaultLongitude;

          console.log(`[MCP Tool] get_fertilizer_recommendation called: crop=${ssfr_crop}, lat=${lat}, lon=${lon}, query=${query || 'none'}`);

          if (lat === undefined || lon === undefined) {
            return {
              content: [{
                type: 'text',
                text: 'I need to know your farm location to provide fertilizer recommendations. Please provide your latitude and longitude coordinates.'
              }],
              isError: true
            };
          }

          // Automatically check if location is in Ethiopia (no separate tool needed)
          if (!ssfrClient.isInEthiopia(lat, lon)) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'Location not supported',
                  message: 'Site-Specific Fertilizer Recommendations are only available for locations in Ethiopia. Your coordinates are outside the supported region.',
                  location: {
                    latitude: lat,
                    longitude: lon
                  },
                  ethiopia_bounds: ETHIOPIA_BOUNDS
                }, null, 2)
              }],
              isError: true
            };
          }

          const recommendation = await ssfrClient.getFertilizerRecommendation(ssfr_crop, lat, lon);

          // Format response matching FarmerChat API structure
          const response = {
            crop: recommendation.crop,
            location: recommendation.location,
            fertilizers: {
              organic: recommendation.organic,
              inorganic: recommendation.inorganic
            },
            expected_yield: recommendation.expectedYield,
            data_source: recommendation.dataSource,
            units: {
              organic: 'tons/ha',
              inorganic: 'kg/ha',
              yield: 'kg/ha'
            }
          };

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }]
          };
        } catch (error: any) {
          console.error('[MCP Tool] Error in get_fertilizer_recommendation:', error);
          return {
            content: [{
              type: 'text',
              text: `I'm having trouble getting fertilizer recommendations right now. ${error.message || 'Try again in a moment?'}`
            }],
            isError: true
          };
        }
      }
    );

    // Connect and handle the request
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

  } catch (error) {
    console.error('[MCP] Error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
        data: error instanceof Error ? error.message : 'Unknown error'
      },
      id: null
    });
  }
});

// Start server
const HOST = '0.0.0.0';
app.listen(Number(PORT), HOST, () => {
  console.log('');
  console.log('🚀 =========================================');
  console.log('   SSFR Fertilizer Recommendations MCP Server');
  console.log('=========================================');
  console.log(`✅ Server running on ${HOST}:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌾 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`🌍 Supported Region: Ethiopia only`);
  console.log(`🌾 Supported Crops: wheat, maize`);
  console.log(`🛠️  Tools: 1 (get_fertilizer_recommendation)`);
  console.log('=========================================');
  console.log('📝 Provides fertilizer recommendations based on location');
  console.log('=========================================');
  console.log('');
});

