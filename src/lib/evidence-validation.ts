export interface ValidationInput {
  quote: string
  content_item_id: string
  raw_text: string
}

export interface ValidationResult {
  valid: boolean
  failures: Array<{ content_item_id: string; reason: string }>
}

export function validateEvidenceQuotes(snippets: ValidationInput[]): ValidationResult {
  const failures: Array<{ content_item_id: string; reason: string }> = []

  for (const snippet of snippets) {
    if (!snippet.raw_text) {
      failures.push({
        content_item_id: snippet.content_item_id,
        reason: 'No raw_text found for content item',
      })
      continue
    }
    if (!snippet.raw_text.includes(snippet.quote)) {
      failures.push({
        content_item_id: snippet.content_item_id,
        reason: `Quote not found in raw_text: "${snippet.quote.slice(0, 80)}..."`,
      })
    }
  }

  return { valid: failures.length === 0, failures }
}
