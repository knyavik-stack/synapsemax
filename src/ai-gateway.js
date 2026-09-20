const AI_GATEWAY_CONTRACT = 'ai-gateway-v1';

function normalizeModel(model) {
  const value = String(model ?? '').trim();
  if (!value || value.length > 200) throw new Error('model is required and must be <= 200 characters');
  return value;
}

function createAiGateway({ baseUrl, apiKey, defaultModel, fetchImpl = fetch } = {}) {
  if (!baseUrl) throw new Error('AI gateway baseUrl is required');
  const url = new URL(baseUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('AI gateway baseUrl must use HTTP(S)');
  const model = normalizeModel(defaultModel ?? 'configured-by-runtime');

  return {
    contractVersion: AI_GATEWAY_CONTRACT,
    async chat({ messages, modelOverride, temperature = 0.2, maxTokens = 1000, metadata = {} } = {}) {
      if (!Array.isArray(messages) || messages.length < 1) throw new Error('messages must contain at least one item');
      if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new Error('temperature must be between 0 and 2');
      if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 100000) throw new Error('maxTokens must be 1..100000');
      const targetModel = normalizeModel(modelOverride ?? model);
      const endpoint = new URL('/v1/chat/completions', url);
      const headers = { 'content-type': 'application/json', accept: 'application/json' };
      if (apiKey) headers.authorization = 'Bearer ' + apiKey;
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: targetModel, messages, temperature, max_tokens: maxTokens, metadata }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error('AI gateway request failed (' + response.status + '): ' + text.slice(0, 500));
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('AI gateway returned invalid JSON'); }
      return { contractVersion: AI_GATEWAY_CONTRACT, model: targetModel, response: data };
    },
  };
}

export { AI_GATEWAY_CONTRACT, createAiGateway };
