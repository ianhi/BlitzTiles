interface TrieNode {
  children: Record<string, TrieNode>;
  isEnd: boolean;
}

function createNode(): TrieNode {
  return { children: {}, isEnd: false };
}

export class Trie {
  private root: TrieNode = createNode();
  private _size = 0;

  insert(word: string): void {
    const upper = word.toUpperCase();
    let node = this.root;
    for (const ch of upper) {
      if (!node.children[ch]) {
        node.children[ch] = createNode();
      }
      node = node.children[ch];
    }
    if (!node.isEnd) {
      node.isEnd = true;
      this._size++;
    }
  }

  has(word: string): boolean {
    if (word.length === 0) return false;
    const upper = word.toUpperCase();
    let node = this.root;
    for (const ch of upper) {
      if (!node.children[ch]) return false;
      node = node.children[ch];
    }
    return node.isEnd;
  }

  get size(): number {
    return this._size;
  }
}

export function loadDictionary(text: string): Trie {
  const trie = new Trie();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      trie.insert(trimmed);
    }
  }
  return trie;
}
