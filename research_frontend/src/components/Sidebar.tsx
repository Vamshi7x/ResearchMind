import React from 'react';
import type { HistoryItem } from '../hooks/useResearchGeneration';
import { Plus, BookOpen, Trash2, Calendar, FileText } from 'lucide-react';

interface SidebarProps {
  history: HistoryItem[];
  currentReportId?: string;
  onSelectItem: (item: HistoryItem) => void;
  onDeleteItem: (id: string, e: React.MouseEvent) => void;
  onClearHistory: () => void;
  onNewReport: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  history,
  currentReportId,
  onSelectItem,
  onDeleteItem,
  onClearHistory,
  onNewReport,
}) => {
  const formatType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <aside className="app-sidebar">
      <button className="new-report-btn" onClick={onNewReport}>
        <Plus size={18} />
        <span>New Research</span>
      </button>

      <div className="history-section">
        <div className="history-header">
          <BookOpen size={16} />
          <span>Research History</span>
          <span className="history-count">{history.length}</span>
        </div>

        <div className="history-list-container">
          {history.length === 0 ? (
            <div className="history-empty-state">
              <FileText size={32} className="empty-icon" />
              <p>No previous reports</p>
              <p className="empty-subtext">Reports you generate will be saved here locally.</p>
            </div>
          ) : (
            <ul className="history-list">
              {history.map((item) => {
                const isActive = item.response.report === currentReportId;
                return (
                  <li
                    key={item.id}
                    className={`history-item ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectItem(item)}
                  >
                    <div className="history-item-body">
                      <p className="history-item-topic" title={item.topic}>
                        {item.topic}
                      </p>
                      <div className="history-item-meta">
                        <span className="meta-badge">{formatType(item.reportType)}</span>
                        <span className="meta-time">
                          <Calendar size={10} style={{ marginRight: '3px' }} />
                          {item.timestamp.split(',')[0]}
                        </span>
                      </div>
                    </div>
                    <button
                      className="delete-item-btn"
                      onClick={(e) => onDeleteItem(item.id, e)}
                      title="Delete report"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <button className="clear-history-btn" onClick={onClearHistory}>
          <Trash2 size={14} />
          <span>Clear All Cache</span>
        </button>
      )}
    </aside>
  );
};
