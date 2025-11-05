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
 */
export const LAYER_DATES = {
  dap: '2025-07',
  other: '2024-07'
};

/**
 * Response from Next-gen Agro Advisory API
 */
export interface SSFRResponse {
  /** Layer name */
  layer: string;
  /** Coordinate data */
  coordinates: Array<{
    lat: number;
    lon: number;
    /** Value returned for this coordinate */
    value?: number | string;
    /** Additional metadata */
    [key: string]: any;
  }>;
  /** Date used for the query */
  date: string;
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
    date: string = LAYER_DATES.other
  ): Promise<SSFRResponse> {
    // Format coordinates as URL-encoded JSON array
    const coordinates = JSON.stringify([{ lat, lon }]);
    const encodedCoords = encodeURIComponent(coordinates);

    const url = `${this.baseUrl}/coordinates/${layer}/${encodedCoords}/${date}`;

    console.log(`[SSFR API] Fetching: ${layer} for (${lat}, ${lon})`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SSFR API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as SSFRResponse;
    return data;
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

    // Fetch all layer data in parallel
    const [compostData, npsData, ureaData, vcompostData, yieldData] = await Promise.all([
      this.getLayerData(layers.compost, lat, lon),
      this.getLayerData(layers.nps, lat, lon),
      this.getLayerData(layers.urea, lat, lon),
      this.getLayerData(layers.vcompost, lat, lon),
      this.getLayerData(layers.yield, lat, lon, LAYER_DATES.other)
    ]);

    // Extract values from responses
    if (compostData.coordinates && compostData.coordinates[0]?.value) {
      recommendation.organic.compost = parseFloat(compostData.coordinates[0].value.toString());
    }

    if (vcompostData.coordinates && vcompostData.coordinates[0]?.value) {
      recommendation.organic.vermicompost = parseFloat(vcompostData.coordinates[0].value.toString());
    }

    if (ureaData.coordinates && ureaData.coordinates[0]?.value) {
      recommendation.inorganic.urea = parseFloat(ureaData.coordinates[0].value.toString());
    }

    if (npsData.coordinates && npsData.coordinates[0]?.value) {
      recommendation.inorganic.nps = parseFloat(npsData.coordinates[0].value.toString());
    }

    if (yieldData.coordinates && yieldData.coordinates[0]?.value) {
      recommendation.expectedYield = parseFloat(yieldData.coordinates[0].value.toString());
    }

    return recommendation;
  }
}

