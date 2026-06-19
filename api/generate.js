function extractUrls(text) {
  const re = /https?:\/\/[^\s\)\"\']+/g;
  return [...new Set(text.match(re) || [])];
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 4000);
}

async function fetchUrl(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Martinusactar/1.0)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    return stripHtml(html);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API kľúč nie je nastavený.' });
  }

  const { messages, system } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Neplatné dáta.' });
  }

  // Extract URLs from first user message and fetch their content
  const firstMsg = messages[0]?.content || '';
  const urls = extractUrls(firstMsg);
  let urlContext = '';

  if (urls.length > 0) {
    const fetched = await Promise.all(urls.slice(0, 3).map(async (url) => {
      const content = await fetchUrl(url);
      return content ? `--- Obsah stránky ${url} ---\n${content}` : null;
    }));
    const valid = fetched.filter(Boolean);
    if (valid.length > 0) {
      urlContext = '\n\n=== OBSAH NAČÍTANÝCH STRÁNOK ===\n' + valid.join('\n\n');
    }
  }

  const enrichedSystem = (system || '') + urlContext;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: enrichedSystem,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Chyba API.' });
    }

    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: 'Chyba spojenia: ' + err.message });
  }
}
