/**
 * memoryService.js
 *
 * Handles the full memory curation pipeline for gBot:
 * - Parses <memory_signal> blocks emitted by the LLM inline.
 * - Upserts signals into the Conditional cache.
 * - Promotes Conditional → Confirmed when occurrences >= 3.
 * - Enforces the strict 100-slot Confirmed memory cap via LLM-assisted
 *   consolidation (merge or evict).
 * - Fires a stylized push notification on every Confirmed promotion.
 */

const CustomerMemory = require('../models/CustomerMemory');
const { sendNativePush } = require('./pushService');

const CONFIRMED_SLOT_LIMIT = 100;
const PROMOTION_THRESHOLD = 3;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Signal Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips the <memory_signal> block from the raw LLM output and returns
 * both the clean user-facing text and the parsed signal array.
 *
 * @param {string} rawText - Full raw response from the LLM.
 * @returns {{ cleanText: string, signals: Array<{topic: string, summary: string}> }}
 */
const parseMemorySignal = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanText: rawText || '', signals: [] };
  }

  const SIGNAL_REGEX = /<memory_signal>([\s\S]*?)<\/memory_signal>/i;
  const match = rawText.match(SIGNAL_REGEX);

  const cleanText = rawText.replace(SIGNAL_REGEX, '').trim();

  if (!match) return { cleanText, signals: [] };

  try {
    const parsed = JSON.parse(match[1].trim());
    if (!Array.isArray(parsed)) return { cleanText, signals: [] };

    // Validate each signal has the required shape
    const signals = parsed.filter(
      (s) => s && typeof s.topic === 'string' && typeof s.summary === 'string'
        && s.topic.trim() && s.summary.trim()
    );

    return { cleanText, signals };
  } catch (e) {
    console.warn('[MemoryService] Failed to parse memory_signal JSON:', e.message);
    return { cleanText, signals: [] };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Conditional Cache Upsertion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upserts a signal into the conditional cache.
 * Matches by topic (case-insensitive) and increments occurrences.
 * Returns the updated conditional entry.
 */
const upsertConditional = async (memoryDoc, signal) => {
  const topicNorm = signal.topic.trim().toLowerCase();

  const existing = memoryDoc.conditionalMemories.find(
    (m) => m.topic.toLowerCase() === topicNorm
  );

  if (existing) {
    existing.occurrences = (existing.occurrences || 1) + 1;
    existing.summary = signal.summary.trim(); // Always keep the latest phrasing
    existing.lastMentionedAt = new Date();
    // Refresh TTL by updating the expiry
    existing.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return existing;
  } else {
    const newEntry = {
      topic: signal.topic.trim(),
      summary: signal.summary.trim(),
      occurrences: 1,
      lastMentionedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
    memoryDoc.conditionalMemories.push(newEntry);
    return memoryDoc.conditionalMemories[memoryDoc.conditionalMemories.length - 1];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Slot Limit Management: Consolidate or Evict
// ─────────────────────────────────────────────────────────────────────────────

/**
 * When the 100-slot limit is full, ask the LLM if the new memory can be merged
 * with an existing slot. If not, evict the least important + least recently used.
 *
 * Returns the updated confirmedMemories array.
 */
const consolidateOrEvict = async (confirmedMemories, newMemory, aiProvider) => {
  // Format confirmed memories for the LLM prompt
  const memoryList = confirmedMemories.map((m, i) => ({
    id: m._id.toString(),
    index: i,
    topic: m.topic,
    summary: m.summary,
    importanceScore: m.importanceScore,
    lastRecalledAt: m.lastRecalledAt
  }));

  const consolidationPrompt = [
    {
      role: 'system',
      content: `You are a Memory Consolidator for a business AI assistant.
The customer's memory bank has reached its ${CONFIRMED_SLOT_LIMIT}-slot limit.
A newly confirmed memory must be accommodated.

New Memory:
Topic: ${newMemory.topic}
Summary: ${newMemory.summary}

Current Memory Bank (${memoryList.length} slots):
${JSON.stringify(memoryList, null, 2)}

Your task:
1. MERGE: Can the new memory be logically combined with an existing slot without losing any critical context? If yes, provide a merged summary and the ID of the target slot.
2. EVICT: If merging is not possible, identify the single LEAST important memory slot to delete (consider importanceScore AND lastRecalledAt together).

Respond ONLY with a raw JSON object — no markdown, no explanation:
{"action":"merge","targetId":"<id>","mergedSummary":"<text>"}
or
{"action":"evict","targetId":"<id>","mergedSummary":null}`
    }
  ];

  try {
    const completion = await aiProvider.generateChat(consolidationPrompt, [], null);
    const raw = completion?.choices?.[0]?.message?.content || '';

    // Strip any accidental markdown wrapping
    const jsonStr = raw.replace(/```json|```/g, '').trim();
    const decision = JSON.parse(jsonStr);

    if (!decision.action || !decision.targetId) throw new Error('Invalid decision shape');

    if (decision.action === 'merge' && decision.mergedSummary) {
      const target = confirmedMemories.find((m) => m._id.toString() === decision.targetId);
      if (target) {
        target.summary = decision.mergedSummary;
        target.lastRecalledAt = new Date();
        console.log(`[MemoryService] Merged memory into slot ${decision.targetId}`);
        return confirmedMemories; // No new slot needed
      }
    }

    if (decision.action === 'evict') {
      const before = confirmedMemories.length;
      const updated = confirmedMemories.filter((m) => m._id.toString() !== decision.targetId);
      if (updated.length < before) {
        console.log(`[MemoryService] Evicted slot ${decision.targetId} to make room`);
        updated.push(buildConfirmedEntry(newMemory));
        return updated;
      }
    }
  } catch (err) {
    console.warn('[MemoryService] Consolidation LLM failed, falling back to LRU eviction:', err.message);
  }

  // Fallback: pure LRU eviction on importanceScore * recency
  const scored = confirmedMemories.map((m) => ({
    m,
    score: (m.importanceScore || 5) * (1 / (Date.now() - new Date(m.lastRecalledAt).getTime() + 1))
  }));
  scored.sort((a, b) => a.score - b.score);
  const evicted = scored[0].m;
  const updated = confirmedMemories.filter((m) => m._id.toString() !== evicted._id.toString());
  updated.push(buildConfirmedEntry(newMemory));
  console.log(`[MemoryService] LRU fallback evicted topic: "${evicted.topic}"`);
  return updated;
};

const buildConfirmedEntry = (conditional) => ({
  topic: conditional.topic,
  summary: conditional.summary,
  importanceScore: 5,
  lastRecalledAt: new Date(),
  createdAt: new Date()
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Promotion: Conditional → Confirmed
// ─────────────────────────────────────────────────────────────────────────────

const promoteToConfirmed = async (memoryDoc, conditionalEntry, businessId, aiProvider) => {
  const isAtLimit = memoryDoc.confirmedMemories.length >= CONFIRMED_SLOT_LIMIT;

  if (isAtLimit) {
    memoryDoc.confirmedMemories = await consolidateOrEvict(
      memoryDoc.confirmedMemories,
      conditionalEntry,
      aiProvider
    );
  } else {
    memoryDoc.confirmedMemories.push(buildConfirmedEntry(conditionalEntry));
  }

  // Remove from conditional cache
  memoryDoc.conditionalMemories = memoryDoc.conditionalMemories.filter(
    (m) => m._id.toString() !== conditionalEntry._id.toString()
  );

  console.log(`[MemoryService] Promoted "${conditionalEntry.topic}" to Confirmed for business ${businessId}`);

  // Fire push notification — fire-and-forget, non-blocking
  sendNativePush(
    businessId,
    '🧠 I\'ve learned something new about you!',
    `"${conditionalEntry.summary}"`,
    {
      type: 'memory_promotion',
      topic: conditionalEntry.topic,
      summary: conditionalEntry.summary
    }
  ).catch((err) => console.warn('[MemoryService] Push notification failed:', err.message));
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Main Entry: Process Signals from a Conversation Turn
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called after the LLM responds. Processes any <memory_signal> blocks,
 * upserts into the conditional cache, and promotes to confirmed if threshold met.
 *
 * This is intentionally non-blocking — the chat response is already sent to
 * the client before this resolves.
 *
 * @param {string} businessId
 * @param {Array<{topic: string, summary: string}>} signals - Already parsed signals.
 * @param {object} aiProvider - The AI provider instance for consolidation LLM calls.
 */
const processMemorySignals = async (businessId, signals, aiProvider) => {
  if (!signals || signals.length === 0) return;

  try {
    let memoryDoc = await CustomerMemory.findOne({ businessId });
    if (!memoryDoc) {
      memoryDoc = new CustomerMemory({ businessId, conditionalMemories: [], confirmedMemories: [] });
    }

    // Prune expired conditional entries (manual TTL since MongoDB can't TTL sub-documents)
    const now = new Date();
    const beforeCount = memoryDoc.conditionalMemories.length;
    memoryDoc.conditionalMemories = memoryDoc.conditionalMemories.filter(
      (m) => !m.expiresAt || new Date(m.expiresAt) > now
    );
    if (memoryDoc.conditionalMemories.length < beforeCount) {
      console.log(`[MemoryService] Pruned ${beforeCount - memoryDoc.conditionalMemories.length} expired conditional entries`);
    }

    let dirty = false;

    for (const signal of signals) {
      const entry = await upsertConditional(memoryDoc, signal);
      dirty = true;

      if (entry.occurrences >= PROMOTION_THRESHOLD) {
        await promoteToConfirmed(memoryDoc, entry, businessId, aiProvider);
      }
    }

    if (dirty) {
      await memoryDoc.save();
    }
  } catch (err) {
    // Never crash the main request over memory ops
    console.error('[MemoryService] processMemorySignals error:', err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Memory Retrieval for Context Injection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a compact, bulleted string of confirmed memories ready for injection
 * into the system prompt. Also updates lastRecalledAt for retrieved memories.
 *
 * @param {string} businessId
 * @returns {string} - Formatted memory context block, or empty string if none.
 */
const getConfirmedMemoryContext = async (businessId) => {
  try {
    const memoryDoc = await CustomerMemory.findOne({ businessId })
      .select('confirmedMemories')
      .lean();

    if (!memoryDoc || !memoryDoc.confirmedMemories?.length) return '';

    const lines = memoryDoc.confirmedMemories
      .sort((a, b) => (b.importanceScore || 5) - (a.importanceScore || 5))
      .map((m) => `- [${m.topic}] ${m.summary}`)
      .join('\n');

    // Note: lastRecalledAt is NOT blanket-updated here. It is only meaningful
    // when updated selectively (e.g., when a memory is used in consolidation).
    // A blanket update would make all 100 slots identical in recency, defeating LRU.

    return lines;
  } catch (err) {
    console.warn('[MemoryService] getConfirmedMemoryContext failed:', err.message);
    return '';
  }
};

module.exports = {
  parseMemorySignal,
  processMemorySignals,
  getConfirmedMemoryContext
};
