import React from 'react';
import { useResearchGeneration } from '../hooks/useResearchGeneration';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { TopicInput } from '../components/TopicInput';
import { ProgressTracker } from '../components/ProgressTracker';
import { ReportViewer } from '../components/ReportViewer';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export const Home: React.FC = () => {
  const {
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
  } = useResearchGeneration();

  const handleReset = () => {
    setResult(null);
    setStage('idle');
    setError(null);
  };

  return (
    <div className="app-container">
      <Sidebar
        history={history}
        currentReportId={result?.report}
        onSelectItem={selectHistoryItem}
        onDeleteItem={deleteHistoryItem}
        onClearHistory={clearHistory}
        onNewReport={handleReset}
      />

      <main className="main-content">
        <Header isLoading={isLoading} stage={stage} />

        <div className="content-area">
          {error && (
            <div className="error-card">
              <div className="error-card-header">
                <AlertCircle className="text-danger" size={24} />
                <h2>Research Failed</h2>
              </div>
              <p className="error-message">{error}</p>
              <div className="error-actions">
                <button className="primary-btn flex-btn" onClick={() => generateReport()}>
                  <RefreshCw size={16} />
                  <span>Retry Generation</span>
                </button>
                <button className="secondary-btn flex-btn" onClick={handleReset}>
                  <ArrowLeft size={16} />
                  <span>Back to Options</span>
                </button>
              </div>
            </div>
          )}

          {!error && stage === 'idle' && !result && (
            <TopicInput
              topic={topic}
              setTopic={setTopic}
              audience={audience}
              setAudience={setAudience}
              reportType={reportType}
              setReportType={setReportType}
              onSubmit={generateReport}
              isLoading={isLoading}
            />
          )}

          {!error && isLoading && (
            <ProgressTracker currentStage={stage} />
          )}

          {!error && !isLoading && result && (
            <ReportViewer response={result} topic={topic} />
          )}
        </div>
      </main>
    </div>
  );
};
export default Home;
