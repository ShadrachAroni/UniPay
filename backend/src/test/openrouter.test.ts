import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenRouterLLMProvider, UniPayAIService } from '../services/aiService';

describe('OpenRouter AI Integration Test Suite', () => {
  const provider = new OpenRouterLLMProvider();

  it('generates text using OpenRouter with meta-llama/llama-3.1-8b-instruct', async () => {
    const prompt = JSON.stringify({ question: 'How much did I make in gross collections?' });
    const systemPrompt = `You are UniPay AI Financial Assistant. Translate the natural language financial question into structured JSON.
Allowed aggregations: "gross_collections", "net_collections", "total_fees".
Return ONLY valid JSON matching: {"aggregation": "gross_collections", "filters": {}, "explanation": "..."}`;

    const text = await provider.generateText(prompt, {
      systemPrompt,
      temperature: 0.1,
      maxTokens: 250,
    });

    assert.ok(text, 'Expected non-empty response from OpenRouter');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    assert.equal(parsed.aggregation, 'gross_collections');
  });

  it('generates plain-language explainMatch text', async () => {
    const inputPayload = {
      match_source: 'order',
      match_type: 'exact_reference',
      expected_reference: 'ORD-5544',
      expected_amount: 3500,
      matched_amount: 3500,
      confidence_score: 1.0,
      notes: 'Exact match on reference and amount',
    };

    const systemPrompt =
      'You are UniPay Reconciliation Intelligence Assistant. Generate a single plain-language sentence (maximum 30 words) explaining why this payment matched and stating the confidence level in everyday words. Do not format as markdown. Be concise and precise.';

    const text = await provider.generateText(JSON.stringify(inputPayload), {
      systemPrompt,
      temperature: 0.1,
      maxTokens: 100,
    });

    assert.ok(text && text.length > 10, 'Expected valid explanation text');
  });

  it('UniPayAIService uses OpenRouter provider by default when key is configured', async () => {
    const service = new UniPayAIService();
    const explanation = await service.explainMatch({
      id: 'match_test_001',
      profile_id: '00000000-0000-0000-0000-000000000001',
      transaction_id: 'tx_001',
      match_source: 'order',
      match_type: 'exact_reference',
      expected_reference: 'ORD-999',
      expected_amount: 1000,
      matched_amount: 1000,
      confidence_score: 1.0,
      discrepancy_amount: 0,
      created_at: new Date().toISOString(),
    });

    assert.ok(explanation, 'Expected explanation from UniPayAIService');
  });
});
