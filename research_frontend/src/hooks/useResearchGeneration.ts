import { useState, useEffect, useRef } from 'react';
import { generateResearchReport } from '../services/api';
import type { ResearchResponse } from '../services/api';

export type GenerationStage = 'idle' | 'router' | 'research' | 'orchestrator' | 'workers' | 'reducer' | 'completed' | 'error';

export interface HistoryItem {
  id: string;
  topic: string;
  audience: string;
  reportType: string;
  response: ResearchResponse;
  timestamp: string;
}

const HISTORY_KEY = 'research_report_history';
const MAX_HISTORY = 15;

export function useResearchGeneration() {
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('General');
  const [reportType, setReportType] = useState('technical_overview');
  const [stage, setStage] = useState<GenerationStage>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const intervalRef = useRef<number | null>(null);

  // Load history on mount
  useEffect(() => {
    const cached = localStorage.getItem(HISTORY_KEY);
    if (cached) {
      try {
        setHistory(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse history from localStorage', e);
      }
    }
  }, []);

  // Save history helper
  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    // Trigger custom event to notify other components (e.g. sidebar) if needed
    window.dispatchEvent(new Event('history_updated'));
  };

  const cleanUpInterval = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => cleanUpInterval();
  }, []);

  const generateReport = async (overrideTopic?: string, overrideAudience?: string, overrideReportType?: string) => {
    const activeTopic = overrideTopic || topic;
    const activeAudience = overrideAudience || audience;
    const activeReportType = overrideReportType || reportType;

    if (!activeTopic.trim()) {
      setError('Please enter a research topic.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setStage('router');

    // Simulate progress tracker stages
    const stages: GenerationStage[] = ['router', 'research', 'orchestrator', 'workers', 'reducer'];
    let stageIdx = 0;
    
    cleanUpInterval();
    intervalRef.current = window.setInterval(() => {
      if (stageIdx < stages.length - 1) {
        stageIdx++;
        setStage(stages[stageIdx]);
      }
    }, 4000); // Step every 4 seconds to give a realistic feel

    try {
      const response = await generateResearchReport({
        topic: activeTopic,
        audience: activeAudience,
        report_type: activeReportType,
      });

      cleanUpInterval();
      setStage('completed');
      setIsLoading(false);
      setResult(response);

      // Add to history
      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 11),
        topic: activeTopic,
        audience: activeAudience,
        reportType: activeReportType,
        response,
        timestamp: new Date().toLocaleString(),
      };

      const updatedHistory = [newHistoryItem, ...history.filter(item => item.topic.toLowerCase() !== activeTopic.toLowerCase())].slice(0, MAX_HISTORY);
      saveHistory(updatedHistory);

    } catch (err: any) {
      cleanUpInterval();
      setStage('error');
      setIsLoading(false);
      setError(err.message || 'An error occurred during report generation.');
    }
  };

  const selectHistoryItem = (item: HistoryItem) => {
    setTopic(item.topic);
    setAudience(item.audience);
    setReportType(item.reportType);
    setResult(item.response);
    setStage('completed');
    setError(null);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = history.filter(item => item.id !== id);
    saveHistory(updatedHistory);
    // If the active result was deleted, reset state
    if (result && !updatedHistory.some(item => item.response.report === result.report)) {
      setResult(null);
      setStage('idle');
    }
  };

  const clearHistory = () => {
    saveHistory([]);
    setResult(null);
    setStage('idle');
  };

  return {
    topic,
    setTopic,
    audience,
    setAudience,
    reportType,
    setReportType,
    stage,
    setStage,
    isLoading,
    error,
    setError,
    result,
    setResult,
    history,
    generateReport,
    selectHistoryItem,
    deleteHistoryItem,
    clearHistory,
  };
}
