// The 24 basic Hangul jamo used by the site, plus helpers to break syllables into them.

export const CONSONANTS = [
  { ch: 'ㄱ', ko: '기역', rom: 'giyeok' },
  { ch: 'ㄴ', ko: '니은', rom: 'nieun' },
  { ch: 'ㄷ', ko: '디귿', rom: 'digeut' },
  { ch: 'ㄹ', ko: '리을', rom: 'rieul' },
  { ch: 'ㅁ', ko: '미음', rom: 'mieum' },
  { ch: 'ㅂ', ko: '비읍', rom: 'bieup' },
  { ch: 'ㅅ', ko: '시옷', rom: 'siot' },
  { ch: 'ㅇ', ko: '이응', rom: 'ieung' },
  { ch: 'ㅈ', ko: '지읒', rom: 'jieut' },
  { ch: 'ㅊ', ko: '치읓', rom: 'chieut' },
  { ch: 'ㅋ', ko: '키읔', rom: 'kieuk' },
  { ch: 'ㅌ', ko: '티읕', rom: 'tieut' },
  { ch: 'ㅍ', ko: '피읖', rom: 'pieup' },
  { ch: 'ㅎ', ko: '히읗', rom: 'hieut' },
];

export const VOWELS = [
  { ch: 'ㅏ', ko: '아', rom: 'a' },
  { ch: 'ㅑ', ko: '야', rom: 'ya' },
  { ch: 'ㅓ', ko: '어', rom: 'eo' },
  { ch: 'ㅕ', ko: '여', rom: 'yeo' },
  { ch: 'ㅗ', ko: '오', rom: 'o' },
  { ch: 'ㅛ', ko: '요', rom: 'yo' },
  { ch: 'ㅜ', ko: '우', rom: 'u' },
  { ch: 'ㅠ', ko: '유', rom: 'yu' },
  { ch: 'ㅡ', ko: '으', rom: 'eu' },
  { ch: 'ㅣ', ko: '이', rom: 'i' },
];

export const ALL_JAMO = [...CONSONANTS, ...VOWELS];
export const JAMO_INFO = Object.fromEntries(ALL_JAMO.map((j) => [j.ch, j]));
const BASIC = new Set(ALL_JAMO.map((j) => j.ch));

const LEAD = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const VOWEL = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const TAIL = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// Double / compound jamo split into the 24 basic ones.
const SPLIT = {
  'ㄲ': 'ㄱㄱ', 'ㄸ': 'ㄷㄷ', 'ㅃ': 'ㅂㅂ', 'ㅆ': 'ㅅㅅ', 'ㅉ': 'ㅈㅈ',
  'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ',
  'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
  'ㅐ': 'ㅏㅣ', 'ㅒ': 'ㅑㅣ', 'ㅔ': 'ㅓㅣ', 'ㅖ': 'ㅕㅣ', 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅏㅣ',
  'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅓㅣ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ',
};

function pushJamo(out, j) {
  if (!j) return;
  if (BASIC.has(j)) out.push(j);
  else if (SPLIT[j]) out.push(...SPLIT[j]);
}

/** Break text into the 24 basic jamo, in reading order. Non-Hangul characters are ignored. */
export function decompose(text) {
  const out = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const s = code - 0xac00;
      pushJamo(out, LEAD[Math.floor(s / 588)]);
      pushJamo(out, VOWEL[Math.floor((s % 588) / 28)]);
      pushJamo(out, TAIL[s % 28]);
    } else {
      pushJamo(out, ch);
    }
  }
  return out;
}

/** Unique basic jamo in a text, ordered as in the 24-jamo palette. */
export function uniqueJamo(text) {
  const set = new Set(decompose(text));
  return ALL_JAMO.map((j) => j.ch).filter((ch) => set.has(ch));
}
