import React from 'react';
import MetricCard from './MetricCard';
import InsightChart from './InsightChart';
import RecommendationCard from './RecommendationCard';
import DataTable from './DataTable';

interface DashboardPayload {
  type: string;
  summary?: string;
  metrics?: Array<any>;
  charts?: Array<any>;
  tables?: Array<any>;
  recommendations?: Array<any>;
}

interface DashboardMessageProps {
  payload: DashboardPayload;
  onNavigate?: (route: any, params?: any) => void;
}

const DashboardMessage: React.FC<DashboardMessageProps> = ({ payload, onNavigate }) => {
  return (
    <div className="flex flex-col gap-4 w-full">
      {payload.summary && (
        <div className="text-sm text-gray-800 leading-relaxed px-1">
          {payload.summary}
        </div>
      )}

      {payload.metrics && payload.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {payload.metrics.map((metric, i) => (
            <MetricCard key={`metric-${i}`} {...metric} />
          ))}
        </div>
      )}

      {payload.charts && payload.charts.length > 0 && (
        <div className="flex flex-col gap-2">
          {payload.charts.map((chart, i) => (
            <InsightChart key={`chart-${i}`} chart={chart} />
          ))}
        </div>
      )}

      {payload.tables && payload.tables.length > 0 && (
        <div className="flex flex-col gap-2">
          {payload.tables.map((table, i) => (
            <DataTable key={`table-${i}`} table={table} />
          ))}
        </div>
      )}

      {payload.recommendations && payload.recommendations.length > 0 && (
        <div className="flex flex-col gap-2">
          {payload.recommendations.map((rec, i) => (
            <RecommendationCard key={`rec-${i}`} {...rec} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardMessage;
