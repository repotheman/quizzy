const fs = require('fs');
const raw = fs.readFileSync('test.json', 'utf8');

const stripped = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

const sanitized = stripped
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")

try {
  JSON.parse(sanitized);
  console.log("Parsed successfully!");
} catch (e) {
  console.log("Error:", e.message);
  console.log("Sanitized content:", sanitized);
}
