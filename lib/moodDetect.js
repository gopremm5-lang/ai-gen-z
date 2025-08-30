const keywordsMood = {
  marah: [ /* ... */ ],
  positif: [ /* ... */ ],
  oot: [ /* ... */ ]
};

function containsPattern(text, patterns) {
  return patterns.some(pattern => text.includes(pattern));
}

function detectMoodHybrid(msg) {
  const lowerMsg = msg.toLowerCase();
  if (containsPattern(lowerMsg, keywordsMood.marah)) return "marah";
  if (containsPattern(lowerMsg, keywordsMood.positif)) return "positif";
  if (containsPattern(lowerMsg, keywordsMood.oot)) return "out_of_topic";
  // Regex/fuzzy tambahan
  if (/kapan.*(dikirim|dapat|masuk)/i.test(lowerMsg)) return "marah";
  if (/(kenapa|kok).*belum.*(proses|masuk|dikirim)/i.test(lowerMsg)) return "marah";
  return "netral";
}
module.exports = { detectMoodHybrid };
