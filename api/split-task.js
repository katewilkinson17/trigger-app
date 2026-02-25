export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text } = req.body
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing text' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ tasks: null })
  }

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
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `A user typed this into a to-do app: "${text}"

If this contains multiple distinct tasks, split it into individual, specific, actionable tasks.
Return ONLY a valid JSON array of strings. No markdown, no explanation.
If it's a single task, return: null

Examples:
Input: "reply to Sarah and book dentist and pay rent"
Output: ["Reply to Sarah", "Book dentist appointment", "Pay rent"]

Input: "write the quarterly report"
Output: null`
        }]
      })
    })

    if (!response.ok) {
      return res.json({ tasks: null })
    }

    const data = await response.json()
    const content = data.content[0].text.trim()

    if (content === 'null') {
      return res.json({ tasks: null })
    }

    const tasks = JSON.parse(content)
    if (!Array.isArray(tasks) || tasks.length < 2) {
      return res.json({ tasks: null })
    }

    res.json({ tasks })
  } catch {
    res.json({ tasks: null })
  }
}
