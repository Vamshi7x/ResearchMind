import React from 'react';
import { Send, Sparkles, User, FilePieChart } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

interface TopicInputProps {
  topic: string;
  setTopic: (topic: string) => void;
  audience: string;
  setAudience: (audience: string) => void;
  reportType: string;
  setReportType: (type: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

const PRESETS = [
  'Transformer Architecture vs State Space Models',
  'Multi-Agent Frameworks in 2026: LangGraph & Autogen',
  'Healthcare AI compliance and HIPAA requirements',
  'Post-Quantum Cryptography standards & adoption',
];

export const TopicInput: React.FC<TopicInputProps> = ({
  topic,
  setTopic,
  audience,
  setAudience,
  reportType,
  setReportType,
  onSubmit,
  isLoading,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && topic.trim()) {
      onSubmit();
    }
  };

  return (
    <div className="input-card">
      <div className="card-header">
        <Sparkles size={18} className="text-accent" />
        <h2>Design Your Research Scope</h2>
      </div>

      <form onSubmit={handleSubmit} className="topic-form">
        <div className="form-group">
          <label htmlFor="topic-input">Research Topic</label>
          <div className="topic-input-wrapper">
            <input
              id="topic-input"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What would you like to research? e.g., 'RAG evaluation frameworks' or 'Vision Transformers in agriculture'"
              disabled={isLoading}
              autoComplete="off"
              required
            />
            <button
              type="submit"
              className="submit-btn"
              disabled={isLoading || !topic.trim()}
              title="Start research"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        <div className="presets-container">
          <p className="presets-label">Popular Topics:</p>
          <div className="presets-chips">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="preset-chip"
                onClick={() => !isLoading && setTopic(preset)}
                disabled={isLoading}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <CustomSelect
            label="Target Audience"
            icon={<User size={14} className="form-icon" />}
            value={audience}
            onChange={setAudience}
            disabled={isLoading}
            options={[
              { value: 'General', label: 'General Readers' },
              { value: 'Developers / Tech Professionals', label: 'Developers & Engineers' },
              { value: 'Business Stakeholders / Executives', label: 'Executives & Business Leaders' },
              { value: 'Academic / Research Community', label: 'Researchers & Academics' },
            ]}
          />

          <CustomSelect
            label="Report Type"
            icon={<FilePieChart size={14} className="form-icon" />}
            value={reportType}
            onChange={setReportType}
            disabled={isLoading}
            options={[
              { value: 'technical_overview', label: 'Technical Overview' },
              { value: 'market_research', label: 'Market Research' },
              { value: 'competitive_analysis', label: 'Competitive Analysis' },
              { value: 'trend_analysis', label: 'Trend Analysis' },
              { value: 'literature_review', label: 'Literature Review' },
            ]}
          />
        </div>
      </form>
    </div>
  );
};
