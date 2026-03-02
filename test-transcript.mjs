// Test the original TimedText approach directly
const videoId = 'dQw4w9WgXcQ'

// JSON3 format
console.log('=== JSON3 ===')
const json3Url = `https://www.youtube.com/api/timedtext?fmt=json3&v=${videoId}&lang=en`
const json3Res = await fetch(json3Url, { signal: AbortSignal.timeout(10000) })
console.log('Status:', json3Res.status)
const json3Text = await json3Res.text()
console.log('Length:', json3Text.length)
console.log('Is HTML:', json3Text.includes('<html'))
console.log('Preview:', json3Text.slice(0, 300))

// XML format
console.log('\n=== XML ===')
const xmlUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`
const xmlRes = await fetch(xmlUrl, { signal: AbortSignal.timeout(10000) })
console.log('Status:', xmlRes.status)
const xmlText = await xmlRes.text()
console.log('Length:', xmlText.length)
console.log('Is HTML:', xmlText.includes('<html'))
console.log('Has <text:', xmlText.includes('<text'))
console.log('Preview:', xmlText.slice(0, 300))

// Try auto-captions (no lang)
console.log('\n=== Auto (no lang) ===')
const autoUrl = `https://www.youtube.com/api/timedtext?fmt=json3&v=${videoId}&lang=`
const autoRes = await fetch(autoUrl, { signal: AbortSignal.timeout(10000) })
console.log('Status:', autoRes.status)
const autoText = await autoRes.text()
console.log('Length:', autoText.length)
console.log('Preview:', autoText.slice(0, 300))
