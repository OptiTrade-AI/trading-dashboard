import type { CspPipelineConfig } from '@/types';

export const DEFAULT_CSP_CONFIG: CspPipelineConfig = {
  deltaLower: -0.40,
  deltaUpper: -0.20,
  minOpenInterest: 100,
  minImpliedVolatility: 0.75,
  minReturnOnRiskPercent: 3.0,
  minMarketCap: 500_000_000,
  minStockPrice: 10.0,
  minVolume: 10,
  minDte: 21,
  maxDte: 35,
};

export interface CspConfigPreset {
  key: string;
  label: string;
  tagline: string;
  config: Partial<CspPipelineConfig>;
}

export const CSP_CONFIG_PRESETS: CspConfigPreset[] = [
  {
    key: 'conservative',
    label: 'Conservative',
    tagline: 'Tight delta, large caps',
    config: {
      deltaLower: -0.30,
      deltaUpper: -0.15,
      minOpenInterest: 200,
      minReturnOnRiskPercent: 2.0,
      minMarketCap: 2_000_000_000,
      minDte: 30,
      maxDte: 45,
    },
  },
  {
    key: 'standard',
    label: 'Standard',
    tagline: 'Default parameters',
    config: {},
  },
  {
    key: 'aggressive',
    label: 'Aggressive',
    tagline: 'Wide delta, smaller caps',
    config: {
      deltaLower: -0.50,
      deltaUpper: -0.25,
      minOpenInterest: 50,
      minImpliedVolatility: 0.50,
      minReturnOnRiskPercent: 5.0,
      minMarketCap: 300_000_000,
      minDte: 14,
      maxDte: 45,
    },
  },
];
