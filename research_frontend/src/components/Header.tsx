import React from 'react';
import { Search, Cpu, Sparkles } from 'lucide-react';

interface HeaderProps {
  isLoading: boolean;
  stage: string;
}

export const Header: React.FC<HeaderProps> = ({ isLoading, stage }) => {
  return (
    <header className="app-header">
      <div className="header-logo-container">
        <div className="logo-icon-wrapper">
          <Search className="logo-search-icon" />
          <Cpu className="logo-cpu-icon" />
        </div>
        <div className="header-title-wrapper">
          <h1>
            ResearchMind <span>AI</span>
          </h1>
          <p className="header-tagline">
            Multi-Agent Report Generator <Sparkles className="inline-sparkle" size={12} />
          </p>
        </div>
      </div>

      <div className="header-status-badge">
        {isLoading ? (
          <div className="status-badge processing">
            <span className="pulse-dot"></span>
            Agent Orchestrator: <span className="stage-name">{stage.toUpperCase()}</span>
          </div>
        ) : (
          <div className="status-badge ready">
            <span className="static-dot"></span>
            System Ready
          </div>
        )}
      </div>
    </header>
  );
};
