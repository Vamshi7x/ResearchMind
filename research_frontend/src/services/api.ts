const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://researchmind-ai-qinm.onrender.com/';

export interface ResearchRequest {
  topic: string;
  audience?: string;
  report_type?: string;
}

export interface ResearchResponse {
  report: string;
  report_type: string;
  sources_count: number;
  sections_count: number;
  mode: string;
  generated_at: string;
}

export async function generateResearchReport(req: ResearchRequest): Promise<ResearchResponse> {
  const response = await fetch(`${API_BASE_URL}/research`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    let errorDetail = 'Failed to generate research report';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return response.json();
}
