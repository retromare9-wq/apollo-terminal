// Ordnet eine frei eingegebene Frage anhand von Schlüsselwörtern einer Kategorie zu.

export function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Optimal-String-Alignment-Distanz: Levenshtein plus vertauschte Nachbarbuchstaben.
export function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// Kurze Stämme müssen exakt passen, mittlere am Wortanfang, lange dürfen
// irgendwo im Wort stehen (Komposita) und einen Tippfehler enthalten.
function tokenHits(token, stem) {
  if (token === stem) return true;
  if (stem.length <= 3) return false;
  if (token.startsWith(stem)) return true;
  if (stem.length < 5) return false;
  if (token.includes(stem)) return true;
  if (token.length < stem.length - 1) return false;
  return distance(token.slice(0, stem.length), stem) <= 1 || distance(token, stem) <= 1;
}

export function matchTopic(input, topics) {
  const text = normalize(input);
  if (!text) return null;
  const tokens = text.split(' ');
  const padded = ` ${text} `;
  let best = null;

  for (const topic of topics) {
    let score = 0;
    let length = 0;
    const check = (list, weight) => {
      for (const keyword of list || []) {
        const k = normalize(keyword);
        if (!k) continue;
        const hit = k.includes(' ') ? padded.includes(` ${k}`) : tokens.some((t) => tokenHits(t, k));
        if (hit) {
          score += weight;
          length += k.length;
        }
      }
    };
    check(topic.keywords, 3);
    check(topic.weak, 1);
    // Exakt eingetippte Frage gewinnt immer
    if ((topic.questions || []).some((q) => q && normalize(q) === text)) score += 100;
    if (score > 0) score += topic.bonus || 0;
    // Bei Gleichstand gewinnt die Kategorie mit den spezifischeren (längeren) Treffern.
    if (score > 0 && (!best || score > best.score || (score === best.score && length > best.length))) {
      best = { topic, score, length };
    }
  }
  return best;
}
