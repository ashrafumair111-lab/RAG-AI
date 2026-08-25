import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState, type AgentStateType } from "./state";
import {
  routerNode,
  retrieveNode,
  webSearchNode,
  generateNode,
  checkNode,
} from "./nodes";

/**
 * RAGent agent graph:
 *
 *                 ┌──────────┐
 *          ┌─────▶│ retrieve │───(needWeb?)────────┐
 *          │      └──────────┘                     ▼
 *        router                               web_search
 *          │      ┌────────────┐                   │
 *          └─────▶│ web_search │───────────────────┤
 *   (no docs)     └────────────┘                   ▼
 *                                              generate
 *                                                 │
 *                                               check ──(ungrounded,
 *                                                 │      web unused)──┐
 *                                                END ◀────────────────┘
 */
const workflow = new StateGraph(AgentState)
  .addNode("router", routerNode)
  .addNode("retrieve", retrieveNode)
  .addNode("web_search", webSearchNode)
  .addNode("generate", generateNode)
  .addNode("check", checkNode)

  // Entry
  .addEdge(START, "router")

  // Router → vector leg if needed, otherwise straight to web
  .addConditionalEdges("router", (state: AgentStateType) =>
    state.needVector ? "retrieve" : "web_search",
  )

  // After document retrieval → continue to web if hybrid/needed
  .addConditionalEdges("retrieve", (state: AgentStateType) =>
    state.needWeb ? "web_search" : "generate",
  )

  // Web search always flows into generation
  .addEdge("web_search", "generate")

  // Generate → self-check
  .addEdge("generate", "check")

  // Self-correction loop: ungrounded + web not yet used → try Tavily once
  .addConditionalEdges("check", (state: AgentStateType) => {
    if (state.grounded) return END;
    if (!state.needWeb && state.retries < 1) return "web_search";
    return END;
  });

/** Compiled, reusable agent graph (stateless — history passed per call). */
export const agentGraph = workflow.compile();