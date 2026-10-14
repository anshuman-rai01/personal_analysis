import { useState, useEffect, useCallback } from 'react';
import { authedFetch } from '../../services/apiClient.ts';

export interface ModuleReadiness {
  totalRecords: number;
  distinctDays: number;
  required: number;
  reliableAt: number;
  remaining: number;
  status: 'insufficient' | 'low_confidence' | 'reliable';
  allowed: boolean;
  isUnlocked: boolean;
}

export interface ForecastReadiness {
  thresholds: {
    minActiveDays: number;
    reliableActiveDays: number;
    minCsvRows: number;
  };
  modules: {
    study: ModuleReadiness;
    finance: ModuleReadiness;
    habits: ModuleReadiness;
  };
}

export function useForecastReadiness() {
  const [readiness, setReadiness] = useState<ForecastReadiness | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReadiness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch('/api/forecasting/readiness');
      if (!res.ok) {
        throw new Error(`Failed to load forecast readiness (HTTP ${res.status})`);
      }
      const data: ForecastReadiness = await res.json();
      const enriched: ForecastReadiness = {
        ...data,
        modules: {
          study: { ...data.modules.study, isUnlocked: data.modules.study.allowed },
          finance: { ...data.modules.finance, isUnlocked: data.modules.finance.allowed },
          habits: { ...data.modules.habits, isUnlocked: data.modules.habits.allowed },
        },
      };
      setReadiness(enriched);
    } catch (err: any) {
      console.error('Error fetching forecast readiness:', err);
      setError(err?.message || 'Failed to fetch readiness');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  return {
    readiness,
    loading,
    error,
    reload: fetchReadiness,
    refresh: fetchReadiness,
  };
}
