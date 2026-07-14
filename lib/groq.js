export async function groqChat({ apiKey, model, messages, maxTokens }) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens || 400,
      reasoning_format: 'hidden', // modelos gpt-oss/qwen são reasoning models — evita <think> vazando na resposta
      messages
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('groq_error_' + res.status + ': ' + text.slice(0, 200));
  }
  const data = await res.json();
  return (
    (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || ''
  ).trim();
}
