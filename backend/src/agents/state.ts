import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { RouteDecision, SourceDoc } from "../types";

/**
 * LangGraph agent state.
 * Each node reads from / writes partial updates to this state,
 * and reducers define how concurrent/sequential writes merge.
 */
export const AgentState = Annotation.Root({
  /** The user's current question. */
  question: Annotation<string>({
    reducer: (_, b) => b,
    default: () => "",
  }),

  /** Prior conversation for follow-up questions. */
  history: Annotation<BaseMessage[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),

  /** Router decision: use documents, web, or both. */
  route: Annotation<RouteDecision>({
    reducer: (_, b) => b,
    default: () => "vector",
  }),

  /** Which retrieval legs to run (set by router). */
  needVector: Annotation<boolean>({
    reducer: (_, b) => b,
    default: () => true,
  }),
  needWeb: Annotation<boolean>({
    reducer: (_, b) => b,
    default: () => false,
  }),

  /** All retrieved sources (deduped by id across nodes/retries). */
  sources: Annotation<SourceDoc[]>({
    reducer: dedupeById,
    default: () => [],
  }),

  /** The assistant's generated answer. */
  answer: Annotation<string>({
    reducer: (_, b) => b,
    default: () => "",
  }),

  /** Self-check verdict: is the answer grounded in the sources? */
  grounded: Annotation<boolean>({
    reducer: (_, b) => b,
    default: () => true,
  }),

  /** How many self-correction retries have happened. */
  retries: Annotation<number>({
    reducer: (a, b) => a + b,
    default: () => 0,
  }),
});

export type AgentStateType = typeof AgentState.State;

/** Merge source lists, keeping the first occurrence of each id. */
function dedupeById(current: SourceDoc[], incoming: SourceDoc[]): SourceDoc[] {
  const map = new Map<string, SourceDoc>();
  for (const s of [...current, ...incoming]) {
    if (!map.has(s.id)) map.set(s.id, s);
  }
  return Array.from(map.values());
}
