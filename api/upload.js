export const config = {
  api: {
    bodyParser: false,
    maxDuration: 60,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = req.headers['x-roblox-api-key'];
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });

  // Operation status polling
  if (req.headers['x-check-op']) {
    const opId = req.query.op || '';
    try {
      const r = await fetch(`https://apis.roblox.com/assets/v1/${opId}`, {
        headers: { 'x-api-key': apiKey }
      });
      const text = await r.text();
      if (!text || text.trim() === '') {
        return res.status(200).json({ done: false, status: 'empty_response' });
      }
      try { return res.status(r.status).json(JSON.parse(text)); }
      catch { return res.status(r.status).json({ raw: text }); }
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Upload
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    console.log('Upload body size:', body.length, 'Content-Type:', req.headers['content-type']);

    const r = await fetch('https://apis.roblox.com/assets/v1/assets', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': req.headers['content-type'],
      },
      body,
    });

    const text = await r.text();
    console.log('Roblox response status:', r.status, 'body:', text.substring(0, 200));

    if (!text || text.trim() === '') {
      // Empty response — still might be success on some status codes
      if (r.status >= 200 && r.status < 300) {
        return res.status(200).json({ success: true, operationId: '', message: 'Upload accepted (empty response)' });
      }
      return res.status(r.status).json({ error: 'Empty response from Roblox', status: r.status });
    }

    try {
      return res.status(r.status).json(JSON.parse(text));
    } catch {
      // Not JSON — return as message
      return res.status(r.status).json({ message: text, status: r.status });
    }
  } catch (e) {
    console.error('Proxy error:', e);
    return res.status(500).json({ error: e.message });
  }
}
