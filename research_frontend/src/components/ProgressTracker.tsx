import React from 'react';
import { Network, Search, Compass, Users, GitMerge, CheckCircle, Loader } from 'lucide-react';
import type { GenerationStage } from '../hooks/useResearchGeneration';

interface ProgressTrackerProps {
  currentStage: GenerationStage;
}

interface StageDetail {
  key: GenerationStage;
  label: string;
  desc: string;
  icon: React.ComponentType<any>;
}

const STAGES: StageDetail[] = [
  {
    key: 'router',
    label: 'Router Agent',
    desc: 'Analyzing topic volatile signals & generating queries',
    icon: Compass,
  },
  {
    key: 'research',
    label: 'Research Agent',
    desc: 'Retrieving from Tavily & deduplicating evidence items',
    icon: Search,
  },
  {
    key: 'orchestrator',
    label: 'Planner Agent',
    desc: 'Structuring constraints & building Section outline',
    icon: Network,
  },
  {
    key: 'workers',
    label: 'Section Writers',
    desc: 'Executing parallel writers with citations & citations validation',
    icon: Users,
  },
  {
    key: 'reducer',
    label: 'Reducer',
    desc: 'Sequencing, filtering & merging final markdown report',
    icon: GitMerge,
  },
];

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ currentStage }) => {
  const getStageIndex = (stage: GenerationStage) => {
    if (stage === 'idle' || stage === 'error') return -1;
    if (stage === 'completed') return STAGES.length;
    return STAGES.findIndex((s) => s.key === stage);
  };

  const currentIdx = getStageIndex(currentStage);

  return (
    <div className="progress-card">
      <div className="progress-card-header">
        <Loader className="spin-icon text-accent" size={18} />
        <h2>Multi-Agent Graph Progress</h2>
      </div>

      <div className="progress-stages-container">
        {STAGES.map((stageItem, idx) => {
          const Icon = stageItem.icon;
          const isCompleted = idx < currentIdx;
          const isActive = idx === currentIdx;

          let statusClass = 'pending';
          if (isCompleted) statusClass = 'completed';
          if (isActive) statusClass = 'active';

          return (
            <div key={stageItem.key} className={`progress-step-row ${statusClass}`}>
              <div className="progress-icon-column">
                <div className={`step-icon-bubble ${statusClass}`}>
                  {isCompleted ? (
                    <CheckCircle className="check-icon" size={16} />
                  ) : (
                    <Icon size={16} />
                  )}
                </div>
                {idx < STAGES.length - 1 && (
                  <div className={`step-connector-line ${isCompleted ? 'completed' : ''}`} />
                )}
              </div>

              <div className="progress-text-column">
                <div className="progress-step-header">
                  <h3>{stageItem.label}</h3>
                  {isActive && <span className="active-badge">Processing...</span>}
                  {isCompleted && <span className="completed-badge">Done</span>}
                </div>
                <p className="progress-step-desc">{stageItem.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
