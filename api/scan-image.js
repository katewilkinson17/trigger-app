export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { image } = req.body
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing image' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'No API key' })
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image },
            },
            {
              type: 'text',
              text: `Today is ${today}. Look at this image and extract any task, to-do item, or reminder visible in it.

Return ONLY a valid JSON object with these fields (omit any field you cannot determine):
- "task": short actionable task description (string)
- "deadline": due date in YYYY-MM-DD format if one is visible (string or omit)
- "amount": any dollar amount or number visible (string or omit)

No markdown, no explanation. Example: {"task":"Pay electric bill","deadline":"2025-03-01","amount":"$84.50"}`,
            },
          ],
        }],
      }),
    })

    if (!response.ok) {
      return res.json({})
    }

    const data = await response.json()
    const content = data.content[0].text.trim()
    const result = JSON.parse(content)
    res.json(result)
  } catch {
    res.json({})
  }
}
