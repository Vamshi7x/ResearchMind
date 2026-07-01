import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidRenderer } from './MermaidRenderer';
import type { ResearchResponse } from '../services/api';
import { Copy, Download, Printer, Check, Globe, Layout, ShieldAlert } from 'lucide-react';

interface ReportViewerProps {
  response: ResearchResponse;
  topic: string;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ response, topic }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(response.report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([response.report], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Create clean file name
    const safeTitle = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/(^_+|_+$)/g, '');
    
    link.setAttribute('download', `research_report_${safeTitle || 'report'}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatMode = (mode: string) => {
    return mode.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className="report-viewer-card printable">
      <div className="report-viewer-toolbar no-print">
        <div className="report-meta-pills">
          <span className="meta-pill mode" title="API Retrieval Mode">
            <Globe size={12} />
            <span>Mode: {formatMode(response.mode)}</span>
          </span>
          <span className="meta-pill sources" title="Sources Checked">
            <Layout size={12} />
            <span>Sources: {response.sources_count}</span>
          </span>
          <span className="meta-pill sections" title="Report Sections">
            <ShieldAlert size={12} className="rotate-180" />
            <span>Sections: {response.sections_count}</span>
          </span>
        </div>

        <div className="toolbar-actions">
          <button className="action-btn" onClick={handleCopy} title="Copy Markdown">
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="action-btn" onClick={handleDownload} title="Download Markdown">
            <Download size={14} />
            <span>Download</span>
          </button>
          <button className="action-btn" onClick={handlePrint} title="Print/Save to PDF">
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>
      </div>

      <div className="report-content-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code(props) {
              const { children, className, node, ...rest } = props;
              const match = /language-(\w+)/.exec(className || '');
              const isMermaid = match && match[1] === 'mermaid';

              if (isMermaid) {
                return <MermaidRenderer chartCode={String(children).replace(/\n$/, '')} />;
              }

              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            },
          }}
        >
          {response.report}
        </ReactMarkdown>
      </div>
    </div>
  );
};
