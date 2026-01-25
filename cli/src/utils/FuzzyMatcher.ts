import Fuse from 'fuse.js';

interface MatchResult {
  startIndex: number;
  endIndex: number;
  originalText: string;
  score: number;
}

export class FuzzyMatcher {
  public static findMatch(fileContent: string, searchBlock: string): MatchResult | null {
    const fileLines = fileContent.split(/\r?\n/);
    const searchLines = searchBlock.split(/\r?\n/);

    const normalize = (str: string) => str.replace(/\s+/g, '');
    const normalizedSearch = normalize(searchBlock);

    const meaningfulSearchLines = searchLines.filter((l) => l.trim().length > 0);
    if (meaningfulSearchLines.length === 0) return null;

    const anchorLine = meaningfulSearchLines[0];

    const lineList = fileLines.map((line, index) => ({ text: line, index }));
    const fuse = new Fuse(lineList, {
      keys: ['text'],
      includeScore: true,
      threshold: 0.6,
      ignoreLocation: true,
    });

    const anchorResults = fuse.search(anchorLine);

    let bestMatch: MatchResult | null = null;
    let bestScore = 0;

    const candidates = anchorResults.slice(0, 20);

    for (const result of candidates) {
      const fileAnchorIdx = result.item.index;
      const anchorOffsetInSearch = searchLines.indexOf(anchorLine);

      const potentialStartLineIdx = fileAnchorIdx - anchorOffsetInSearch;
      if (potentialStartLineIdx < 0) continue;

      const maxWindowLines = Math.max(searchLines.length * 5, 20);

      for (let length = 1; length <= maxWindowLines; length++) {
        const endIdx = potentialStartLineIdx + length;
        if (endIdx > fileLines.length) break;

        const candidateLines = fileLines.slice(potentialStartLineIdx, endIdx);
        const candidateBlock = candidateLines.join('\n');
        const normalizedCandidate = normalize(candidateBlock);

        const similarity = this.calculateSimilarity(normalizedSearch, normalizedCandidate);

        if (similarity >= bestScore && similarity > 0.7) {
          bestScore = similarity;
          bestMatch = {
            startIndex: this.getCharacterIndex(fileContent, potentialStartLineIdx),
            originalText: candidateBlock,
            endIndex: -1,
            score: 1 - similarity,
          };
        }
        if (normalizedCandidate.length > normalizedSearch.length * 1.5) break;
      }
    }

    return bestMatch;
  }

  private static calculateSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    const len1 = s1.length;
    const len2 = s2.length;
    const maxLen = Math.max(len1, len2);
    if (maxLen === 0) return 1;

    const getBigrams = (str: string) => {
      const bigrams = new Set<string>();
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.substring(i, i + 2));
      }
      return bigrams;
    };

    const b1 = getBigrams(s1);
    const b2 = getBigrams(s2);
    const intersection = new Set([...b1].filter((x) => b2.has(x))).size;

    return (2 * intersection) / (b1.size + b2.size);
  }

  private static getCharacterIndex(content: string, lineIndex: number): number {
    const lines = content.split(/\r?\n/);
    let index = 0;
    for (let i = 0; i < lineIndex; i++) {
      index += lines[i].length + 1;
    }
    return index;
  }
}
