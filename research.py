from __future__ import annotations

import operator
import os
from datetime import date, timedelta
from typing import TypedDict, List, Optional, Literal, Annotated

from pydantic import BaseModel, Field

from langgraph.graph import StateGraph, START, END
from langgraph.types import Send

from langchain_groq import ChatGroq
from langchain_mistralai import ChatMistralAI
from langchain_google_genai import ChatGoogleGenerativeAI

from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# Multi-Agent Research Assistant
# Router → (Research?) → Orchestrator → Workers → Reducer
# ============================================================


# -----------------------------
# 1) Schemas
# -----------------------------

class ResearchSection(BaseModel):
    id: int
    title: str
    goal: str = Field(..., description="One sentence describing what this section should answer.")
    key_questions: List[str] = Field(..., min_length=1, max_length=6)
    requires_web_search: bool = False
    requires_citations: bool = True
    requires_data: bool = False  # True if section needs stats/numbers


class ResearchPlan(BaseModel):
    report_title: str
    audience: str
    tone: str
    report_type: Literal[
        "market_research",
        "technical_overview",
        "competitive_analysis",
        "trend_analysis",
        "literature_review"
    ] = "technical_overview"
    constraints: List[str] = Field(default_factory=list)
    sections: List[ResearchSection]


class EvidenceItem(BaseModel):
    title: str
    url: str
    published_at: Optional[str] = None  # ISO "YYYY-MM-DD"
    snippet: Optional[str] = None
    source: Optional[str] = None


class RouterDecision(BaseModel):
    needs_research: bool
    mode: Literal["closed_book", "hybrid", "open_book"]
    reason: str
    queries: List[str] = Field(default_factory=list)
    max_results_per_query: int = Field(5)


class EvidencePack(BaseModel):
    evidence: List[EvidenceItem] = Field(default_factory=list)


class State(TypedDict):
    topic: str

    # routing / research
    mode: str
    needs_research: bool
    queries: List[str]
    evidence: List[EvidenceItem]
    plan: Optional[ResearchPlan]

    # recency
    as_of: str
    recency_days: int

    # workers
    sections: Annotated[List[tuple[int, str]], operator.add]  # (section_id, section_md)

    # final output
    final: str


# -----------------------------
# 2) LLM
# -----------------------------
# llm = ChatMistralAI(model="mistral-small-2506", temperature=0.2)
# Primary LLM — Mistral Small
primary_llm = ChatMistralAI(
    model="mistral-small-2506",
    temperature=0.1,
    mistral_api_key=os.getenv("MISTRAL_API_KEY")
)

# Fallback LLM — Groq Llama 3.3
fallback_llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.1,
    groq_api_key=os.getenv("GROQ_API_KEY")
)

# Combine using LangChain's native fallback wrapper
llm = primary_llm.with_fallbacks([fallback_llm])

# -----------------------------
# 3) Router
# -----------------------------
ROUTER_SYSTEM = """You are a routing module for a research report planner.

Decide whether web research is needed BEFORE planning the report.

Modes:
- closed_book (needs_research=false): Well-established, evergreen knowledge topics that don't need current data.
- hybrid (needs_research=true): Mix of evergreen concepts + current examples, tools, or recent developments.
- open_book (needs_research=true): Current events, latest trends, market data, recent releases, pricing, or policy changes.

If needs_research=true:
- Output 5–10 high-signal, scoped search queries.
- For open_book topics, include queries to find data from the last 7 days.
- Queries should target: statistics, recent developments, expert opinions, case studies.
"""

def router_node(state: State) -> dict:
    decider = llm.with_structured_output(RouterDecision)
    decision = decider.invoke(
        [
            SystemMessage(content=ROUTER_SYSTEM),
            HumanMessage(content=f"Research Topic: {state['topic']}\nAs-of date: {state['as_of']}"),
        ]
    )

    if decision is None:
        decision = RouterDecision(
            needs_research=False,
            mode="closed_book",
            reason="LLM router decision failed, fallback to closed_book.",
            queries=[]
        )

    if decision.mode == "open_book":
        recency_days = 7
    elif decision.mode == "hybrid":
        recency_days = 45
    else:
        recency_days = 3650

    return {
        "needs_research": decision.needs_research,
        "mode": decision.mode,
        "queries": decision.queries,
        "recency_days": recency_days,
    }

def route_next(state: State) -> str:
    return "research" if state["needs_research"] else "orchestrator"


# -----------------------------
# 4) Research (Tavily)
# -----------------------------
def _tavily_search(query: str, max_results: int = 5) -> List[dict]:
    if not os.getenv("TAVILY_API_KEY"):
        return []
    try:
        from langchain_community.tools.tavily_search import TavilySearchResults
        tool = TavilySearchResults(max_results=max_results)
        results = tool.invoke({"query": query})
        out: List[dict] = []
        for r in results or []:
            out.append(
                {
                    "title": r.get("title") or "",
                    "url": r.get("url") or "",
                    "snippet": r.get("content") or r.get("snippet") or "",
                    "published_at": r.get("published_date") or r.get("published_at"),
                    "source": r.get("source"),
                }
            )
        return out
    except Exception:
        return []

def _iso_to_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except Exception:
        return None

RESEARCH_SYSTEM = """You are a research data synthesizer.

Given raw web search results, produce clean EvidenceItem objects for a research report.

Rules:
- Only include items with a non-empty url.
- Prefer authoritative sources: academic papers, official docs, reputable news, industry reports.
- Normalize published_at to ISO YYYY-MM-DD if reliably inferable; else null.
- Keep snippets concise but informative (focus on facts, stats, key claims).
- Deduplicate by URL.
- Prioritize sources with data, statistics, or expert quotes.
"""

def research_node(state: State) -> dict:
    queries = (state.get("queries") or [])[:5]
    raw: List[dict] = []
    for q in queries:
        raw.extend(_tavily_search(q, max_results=3))

    if not raw:
        return {"evidence": []}

    extractor = llm.with_structured_output(EvidencePack)
    pack = extractor.invoke(
        [
            SystemMessage(content=RESEARCH_SYSTEM),
            HumanMessage(
                content=(
                    f"As-of date: {state['as_of']}\n"
                    f"Recency days: {state['recency_days']}\n\n"
                    f"Raw results:\n{raw}"
                )
            ),
        ]
    )

    if pack is None:
        pack = EvidencePack(evidence=[])

    # Deduplicate by URL
    dedup = {}
    for e in pack.evidence:
        if e.url:
            dedup[e.url] = e
    evidence = list(dedup.values())

    # Filter by recency for open_book mode
    if state.get("mode") == "open_book":
        as_of = date.fromisoformat(state["as_of"])
        cutoff = as_of - timedelta(days=int(state["recency_days"]))
        evidence = [e for e in evidence if (d := _iso_to_date(e.published_at)) and d >= cutoff]

    return {"evidence": evidence}


# -----------------------------
# 5) Orchestrator (Research Plan)
# -----------------------------
ORCH_SYSTEM = """You are a senior research analyst and report strategist.

Produce a structured research plan for a professional research report.

Requirements:
- 5–8 sections that together give a complete picture of the topic.
- Recommended section structure:
    1. Overview / Introduction
    2. Background & Context
    3. Key Findings / Current State
    4. Trends & Developments
    5. Challenges & Limitations
    6. Opportunities / Future Outlook
    7. Comparative Analysis (if relevant)
    8. Conclusion & Recommendations
- Each section must have a clear goal + 2–6 key_questions to answer.
- Set requires_citations=True for any section using external facts or data.
- Set requires_data=True for sections that should include statistics or numbers.
- report_type options: market_research | technical_overview | competitive_analysis | trend_analysis | literature_review

Grounding rules:
- closed_book: evergreen knowledge, no citations needed.
- hybrid: mix of evergreen + current; mark relevant sections with requires_citations=True.
- open_book: current data only; all sections require citations; don't invent facts.

Output must match ResearchPlan schema.
"""

def orchestrator_node(state: State) -> dict:
    planner = llm.with_structured_output(ResearchPlan)
    mode = state.get("mode", "closed_book")
    evidence = state.get("evidence", [])

    plan = planner.invoke(
        [
            SystemMessage(content=ORCH_SYSTEM),
            HumanMessage(
                content=(
                    f"Research Topic: {state['topic']}\n"
                    f"Mode: {mode}\n"
                    f"As-of: {state['as_of']} (recency_days={state['recency_days']})\n\n"
                    f"Available Evidence:\n{[e.model_dump() for e in evidence][:20]}"
                )
            ),
        ]
    )

    if plan is None:
        plan = ResearchPlan(
            report_title=f"Detailed Report: {state['topic']}",
            audience="General",
            tone="Professional",
            report_type="technical_overview",
            constraints=[],
            sections=[
                ResearchSection(id=1, title="Executive Summary", goal="Introduction & overview", key_questions=["What is the topic?", "Why is it important?"], requires_web_search=False, requires_citations=False, requires_data=False),
                ResearchSection(id=2, title="Key Concepts & Background", goal="Core background information", key_questions=["What are the main concepts?", "What is the history/context?"], requires_web_search=False, requires_citations=False, requires_data=False),
                ResearchSection(id=3, title="Current State & Analysis", goal="Analyze the current state of the topic", key_questions=["What is the current state?", "What are the latest developments?"], requires_web_search=state.get("needs_research", False), requires_citations=state.get("needs_research", False), requires_data=False),
                ResearchSection(id=4, title="Challenges & Opportunities", goal="Identify problems and potential solutions", key_questions=["What are the challenges?", "What opportunities exist?"], requires_web_search=False, requires_citations=False, requires_data=False),
                ResearchSection(id=5, title="Conclusion & Future Outlook", goal="Wrap up and future outlook", key_questions=["What does the future hold?", "What are the final takeaways?"], requires_web_search=False, requires_citations=False, requires_data=False),
            ]
        )

    return {"plan": plan}


# -----------------------------
# 6) Fanout
# -----------------------------
def fanout(state: State):
    assert state["plan"] is not None
    return [
        Send(
            "worker",
            {
                "section": section.model_dump(),
                "topic": state["topic"],
                "mode": state["mode"],
                "as_of": state["as_of"],
                "recency_days": state["recency_days"],
                "plan": state["plan"].model_dump(),
                "evidence": [e.model_dump() for e in state.get("evidence", [])],
            },
        )
        for section in state["plan"].sections
    ]


# -----------------------------
# 7) Worker
# -----------------------------
WORKER_SYSTEM = """You are a senior research analyst writing ONE section of a professional research report.

Your job:
- Answer ALL key_questions listed for this section.
- Write in a clear, professional, analytical tone.
- Output ONLY the section markdown starting with "## <Section Title>".

Formatting rules:
- Use bullet points for findings and data points.
- Bold key terms and important figures.
- Add a "### Key Takeaway" subsection at the end of every section.
- Keep paragraphs short (2–4 sentences max).

Citation rules:
- If requires_citations=True: Every factual claim, statistic, or external reference MUST include a Markdown citation link: [Source Title](URL).
- If a claim has NO supporting evidence in the provided sources, write: *(Further research needed)*.
- NEVER invent URLs or fabricate statistics.

Data rules:
- If requires_data=True: Include specific numbers, percentages, market sizes, dates, or growth rates.
- Pull data only from the provided Evidence list.

Scope rules:
- Stay focused ONLY on this section's goal and key_questions.
- Do NOT repeat content from other sections.
"""

def worker_node(payload: dict) -> dict:
    section = ResearchSection(**payload["section"])
    plan = ResearchPlan(**payload["plan"])
    evidence = [EvidenceItem(**e) for e in payload.get("evidence", [])]

    questions_text = "\n- " + "\n- ".join(section.key_questions)
    evidence_text = "\n".join(
        f"- {e.title} | {e.url} | {e.published_at or 'date:unknown'} | {e.snippet or ''}"
        for e in evidence[:25]
    )

    section_md = llm.invoke(
        [
            SystemMessage(content=WORKER_SYSTEM),
            HumanMessage(
                content=(
                    f"Report Title: {plan.report_title}\n"
                    f"Audience: {plan.audience}\n"
                    f"Tone: {plan.tone}\n"
                    f"Report Type: {plan.report_type}\n"
                    f"Constraints: {plan.constraints}\n"
                    f"Topic: {payload['topic']}\n"
                    f"Mode: {payload.get('mode')}\n"
                    f"As-of: {payload.get('as_of')} (recency_days={payload.get('recency_days')})\n\n"
                    f"Section Title: {section.title}\n"
                    f"Section Goal: {section.goal}\n"
                    f"requires_citations: {section.requires_citations}\n"
                    f"requires_data: {section.requires_data}\n"
                    f"Key Questions to Answer:{questions_text}\n\n"
                    f"Evidence (ONLY cite these URLs):\n{evidence_text}\n"
                )
            ),
        ]
    ).content.strip()

    return {"sections": [(section.id, section_md)]}


# -----------------------------
# 8) Reducer
# -----------------------------
def merge_content(state: State) -> dict:
    plan = state["plan"]
    if plan is None:
        raise ValueError("merge_content called without a plan.")

    # Sort sections by id and join
    ordered_sections = [
        md for _, md in sorted(state["sections"], key=lambda x: x[0])
    ]
    body = "\n\n".join(ordered_sections).strip()

    # Collect all cited sources
    evidence_list = state.get("evidence", [])
    sources_md = "\n".join(
        f"- [{e.title or e.url}]({e.url}){' — ' + e.published_at if e.published_at else ''}"
        for e in evidence_list
    ) or "_No external sources used (closed-book mode)._"

    final = f"""# {plan.report_title}

| Field | Details |
|---|---|
| **Report Type** | {plan.report_type.replace('_', ' ').title()} |
| **Audience** | {plan.audience} |
| **Tone** | {plan.tone} |
| **Generated** | {state['as_of']} |
| **Research Mode** | {state.get('mode', 'closed_book')} |
| **Sources Found** | {len(evidence_list)} |

---

## Executive Summary

This report provides a comprehensive analysis of **{state['topic']}**.
It covers key findings, current trends, challenges, and future outlook
based on {'web research and' if state.get('needs_research') else ''} expert knowledge
as of {state['as_of']}.

---

{body}

---

## References & Sources

{sources_md}
"""
    return {"final": final}


# -----------------------------
# 9) Build Graph
# -----------------------------
g = StateGraph(State)

g.add_node("router", router_node)
g.add_node("research", research_node)
g.add_node("orchestrator", orchestrator_node)
g.add_node("worker", worker_node)
g.add_node("reducer", merge_content)

g.add_edge(START, "router")
g.add_conditional_edges(
    "router",
    route_next,
    {"research": "research", "orchestrator": "orchestrator"}
)
g.add_edge("research", "orchestrator")
g.add_conditional_edges("orchestrator", fanout, ["worker"])
g.add_edge("worker", "reducer")
g.add_edge("reducer", END)

app = g.compile()


# -----------------------------
# 10) FastAPI Server
# -----------------------------
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

server = FastAPI(title="Multi-Agent Research Assistant API")

server.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResearchRequest(BaseModel):
    topic: str
    audience: Optional[str] = "General"
    report_type: Optional[str] = None  # market_research | technical_overview | etc.


class ResearchResponse(BaseModel):
    report: str
    report_type: str
    sources_count: int
    sections_count: int
    mode: str
    generated_at: str


@server.post("/research", response_model=ResearchResponse)
async def generate_research_report(req: ResearchRequest):
    """
    Generate a professional research report on any topic.
    
    - **topic**: The research topic (e.g. "AI trends in healthcare 2025")
    - **audience**: Target audience (e.g. "investors", "developers", "general")
    - **report_type**: Optional report type override
    """
    try:
        result = app.invoke({
            "topic": req.topic,
            "as_of": date.today().isoformat(),
            "sections": [],
            "evidence": [],
            "queries": [],
            "needs_research": False,
            "mode": "closed_book",
            "recency_days": 3650,
            "plan": None,
            "final": "",
        })

        plan = result.get("plan")

        return ResearchResponse(
            report=result.get("final", "No report generated."),
            report_type=plan.report_type if plan else "unknown",
            sources_count=len(result.get("evidence", [])),
            sections_count=len(result.get("sections", [])),
            mode=result.get("mode", "closed_book"),
            generated_at=date.today().isoformat(),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@server.get("/health")
async def health_check():
    """Check if the API is running."""
    return {
        "status": "healthy",
        "service": "Multi-Agent Research Assistant",
        "date": date.today().isoformat()
    }


@server.get("/")
async def root():
    return {
        "message": "Multi-Agent Research Assistant API",
        "endpoints": {
            "POST /research": "Generate a research report",
            "GET /health": "Health check",
            "GET /docs": "Swagger UI documentation"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(server, host="0.0.0.0", port=8000)