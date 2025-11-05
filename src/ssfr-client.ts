/**
 * SSFR API Client for Next-gen Agro Advisory Service
 *
 * This module provides a TypeScript client for interacting with the Next-gen Agro Advisory API,
 * which provides Site-Specific Fertilizer Recommendations (SSFR) for Ethiopian farmers.
 *
 * Key Features:
 * - Fetches fertilizer recommendations for wheat and maize
 * - Supports multiple fertilizer types: Urea, NPS, Compost, VCompost, Optimal Yield
 * - Location-based recommendations using coordinates
 *
 * @module ssfr-client
 */

import fetch from 'node-fetch';

/**
 * Ethiopian location bounds for validation
 */
export const ETHIOPIA_BOUNDS = {
  minLat: 3.0,
  maxLat: 15.0,
  minLon: 32.0,
  maxLon: 48.0
};

/**
 * SSFR Layer types for different crops and fertilizer types
 */
export const SSFR_LAYERS = {
  wheat: {
    compost: 'et_wheat_compost_probabilistic_dominant',
    nps: 'et_wheat_nps_probabilistic_dominant',
    urea: 'et_wheat_urea_probabilistic_dominant',
    vcompost: 'et_wheat_vcompost_probabilistic_dominant',
    yield: 'et_wheat_yieldtypes_optimal_dominant'
  },
  maize: {
    compost: 'et_maize_compost_probabilistic_dominant',
    nps: 'et_maize_nps_probabilistic_dominant',
    urea: 'et_maize_urea_probabilistic_dominant',
    vcompost: 'et_maize_vcompost_probabilistic_dominant',
    yield: 'et_maize_yieldtypes_optimal_dominant'
  }
};

/**
 * Dates for different layer types
 * Note: All layers currently use '2024-07' per API documentation
 */
export const LAYER_DATES = {
  default: '2024-07'
};

/**
 * Response from Next-gen Agro Advisory API
 * Note: Actual API response structure may vary - this is a flexible interface
 */
export interface SSFRResponse {
  /** Layer name */
  layer?: string;
  /** Coordinate data */
  coordinates?: Array<{
    lat?: number;
    lon?: number;
    /** Value returned for this coordinate */
    value?: number | string | null;
    /** Additional metadata */
    [key: string]: any;
  }>;
  /** Date used for the query */
  date?: string;
  /** Additional fields that may be present */
  [key: string]: any;
}

/**
 * Processed fertilizer recommendation
 */
export interface FertilizerRecommendation {
  /** Crop type */
  crop: 'wheat' | 'maize';
  /** Location coordinates */
  location: {
    latitude: number;
    longitude: number;
  };
  /** Organic fertilizers */
  organic: {
    compost?: number; // tons/ha
    vermicompost?: number; // tons/ha
  };
  /** Inorganic fertilizers */
  inorganic: {
    urea?: number; // kg/ha
    nps?: number; // kg/ha
  };
  /** Expected yield */
  expectedYield?: number; // kg/ha
  /** Data source */
  dataSource: 'Next-gen Agro Advisory Service';
}

/**
 * Client for interacting with the Next-gen Agro Advisory API
 */
export class SSFRClient {
  /** Base URL for Next-gen Agro Advisory API */
  private baseUrl: string;

  /**
   * Creates a new SSFR API client
   *
   * @param baseUrl - Base URL for API (default: https://webapi.nextgenagroadvisory.com)
   */
  constructor(baseUrl: string = 'https://webapi.nextgenagroadvisory.com') {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if coordinates are within Ethiopia bounds
   */
  isInEthiopia(lat: number, lon: number): boolean {
    return (
      lat >= ETHIOPIA_BOUNDS.minLat &&
      lat <= ETHIOPIA_BOUNDS.maxLat &&
      lon >= ETHIOPIA_BOUNDS.minLon &&
      lon <= ETHIOPIA_BOUNDS.maxLon
    );
  }

  /**
   * Fetch data from a specific SSFR layer
   *
   * @param layer - Layer name (e.g., 'et_wheat_urea_probabilistic_dominant')
   * @param lat - Latitude coordinate
   * @param lon - Longitude coordinate
   * @param date - Date for the query (default: '2024-07')
   * @returns Response from the API
   */
  async getLayerData(
    layer: string,
    lat: number,
    lon: number,
    date: string = LAYER_DATES.default
  ): Promise<SSFRResponse> {
    // Validate inputs
    if (!layer || typeof layer !== 'string') {
      throw new Error('Invalid layer name');
    }
    if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude: ${lat}`);
    }
    if (typeof lon !== 'number' || isNaN(lon) || lon < -180 || lon > 180) {
      throw new Error(`Invalid longitude: ${lon}`);
    }
    if (!date || typeof date !== 'string') {
      throw new Error('Invalid date format');
    }

    // Format coordinates as URL-encoded JSON array
    const coordinates = JSON.stringify([{ lat, lon }]);
    const encodedCoords = encodeURIComponent(coordinates);

    const url = `${this.baseUrl}/coordinates/${layer}/${encodedCoords}/${date}`;

    console.log(`[SSFR API] Fetching: ${layer} for (${lat}, ${lon}) on ${date}`);

    // Create AbortController for timeout (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SSFR-MCP-Server/1.0.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SSFR API error (${response.status}): ${errorText || response.statusText}`);
      }

      let data: SSFRResponse;
      try {
        data = await response.json() as SSFRResponse;
      } catch (parseError) {
        throw new Error(`Failed to parse API response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid API response format: expected object');
      }

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: API took too long to respond (30s limit)');
      }
      throw error;
    }
  }

  /**
   * Get complete fertilizer recommendation for a crop
   *
   * @param crop - Crop type ('wheat' or 'maize')
   * @param lat - Latitude coordinate
   * @param lon - Longitude coordinate
   * @returns Complete fertilizer recommendation
   */
  async getFertilizerRecommendation(
    crop: 'wheat' | 'maize',
    lat: number,
    lon: number
  ): Promise<FertilizerRecommendation> {
    // Validate location is in Ethiopia
    if (!this.isInEthiopia(lat, lon)) {
      throw new Error(`Coordinates (${lat}, ${lon}) are outside Ethiopia. SSFR is only available for Ethiopian locations.`);
    }

    const layers = SSFR_LAYERS[crop];
    const recommendation: FertilizerRecommendation = {
      crop,
      location: { latitude: lat, longitude: lon },
      organic: {},
      inorganic: {},
      dataSource: 'Next-gen Agro Advisory Service'
    };

    // Fetch all layer data in parallel with error handling per layer
    // Each promise resolves to either SSFRResponse or an error object
    type LayerResult = SSFRResponse | { error: string; layer: string };

    const layerPromises: Promise<LayerResult>[] = [
      this.getLayerData(layers.compost, lat, lon).catch(err => ({ error: err instanceof Error ? err.message : String(err), layer: 'compost' })),
      this.getLayerData(layers.nps, lat, lon).catch(err => ({ error: err instanceof Error ? err.message : String(err), layer: 'nps' })),
      this.getLayerData(layers.urea, lat, lon).catch(err => ({ error: err instanceof Error ? err.message : String(err), layer: 'urea' })),
      this.getLayerData(layers.vcompost, lat, lon).catch(err => ({ error: err instanceof Error ? err.message : String(err), layer: 'vcompost' })),
      this.getLayerData(layers.yield, lat, lon, LAYER_DATES.default).catch(err => ({ error: err instanceof Error ? err.message : String(err), layer: 'yield' }))
    ];

    const results = await Promise.all(layerPromises);

    // Helper function to safely parse numeric values
    const parseNumericValue = (value: any): number | undefined => {
      if (value === null || value === undefined) return undefined;
      const parsed = parseFloat(value.toString());
      return isNaN(parsed) ? undefined : parsed;
    };

    // Helper function to check if result is an error
    const isError = (result: LayerResult): result is { error: string; layer: string } => {
      return 'error' in result;
    };

    // Extract values from responses (handle partial failures gracefully)
    const compostData = results[0];
    const npsData = results[1];
    const ureaData = results[2];
    const vcompostData = results[3];
    const yieldData = results[4];

    if (!isError(compostData) && compostData.coordinates && compostData.coordinates[0]?.value) {
      const value = parseNumericValue(compostData.coordinates[0].value);
      if (value !== undefined) {
        recommendation.organic.compost = value;
      }
    }

    if (!isError(vcompostData) && vcompostData.coordinates && vcompostData.coordinates[0]?.value) {
      const value = parseNumericValue(vcompostData.coordinates[0].value);
      if (value !== undefined) {
        recommendation.organic.vermicompost = value;
      }
    }

    if (!isError(ureaData) && ureaData.coordinates && ureaData.coordinates[0]?.value) {
      const value = parseNumericValue(ureaData.coordinates[0].value);
      if (value !== undefined) {
        recommendation.inorganic.urea = value;
      }
    }

    if (!isError(npsData) && npsData.coordinates && npsData.coordinates[0]?.value) {
      const value = parseNumericValue(npsData.coordinates[0].value);
      if (value !== undefined) {
        recommendation.inorganic.nps = value;
      }
    }

    if (!isError(yieldData) && yieldData.coordinates && yieldData.coordinates[0]?.value) {
      const value = parseNumericValue(yieldData.coordinates[0].value);
      if (value !== undefined) {
        recommendation.expectedYield = value;
      }
    }

    // Check if we got at least some data
    const hasOrganicData = recommendation.organic.compost !== undefined || recommendation.organic.vermicompost !== undefined;
    const hasInorganicData = recommendation.inorganic.urea !== undefined || recommendation.inorganic.nps !== undefined;
    const hasAnyData = hasOrganicData || hasInorganicData || recommendation.expectedYield !== undefined;

    if (!hasAnyData) {
      throw new Error('No fertilizer recommendation data was returned from the API. The location may not have data available.');
    }

    return recommendation;
  }
}

