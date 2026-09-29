// Curated problem bank (NeetCode-150-style core set) — the ONLY problems the AI study plan
// is allowed to recommend. The plan call receives candidate slugs filtered from here and
// its output is validated back against this list, so it can never invent a problem or URL.
// Also used to tag imported LeetCode solves without an extra GraphQL round-trip.
//
// Compact rows: 'slug|E/M/H|tag,tag'. Tags are LeetCode tagSlugs (same vocabulary as
// templates.js's lcTags), so topic matching works identically for imports and the bank.

const RAW = `
contains-duplicate|E|array,hash-table
valid-anagram|E|hash-table,string
two-sum|E|array,hash-table
group-anagrams|M|hash-table,string
top-k-frequent-elements|M|hash-table,heap-priority-queue
encode-and-decode-strings|M|array,string
product-of-array-except-self|M|array,prefix-sum
valid-sudoku|M|array,hash-table,matrix
longest-consecutive-sequence|M|array,hash-table,union-find
valid-palindrome|E|two-pointers,string
two-sum-ii-input-array-is-sorted|M|two-pointers,binary-search
3sum|M|array,two-pointers,sorting
container-with-most-water|M|array,two-pointers,greedy
trapping-rain-water|H|two-pointers,stack,monotonic-stack,dynamic-programming
best-time-to-buy-and-sell-stock|E|array,dynamic-programming
longest-substring-without-repeating-characters|M|sliding-window,hash-table
longest-repeating-character-replacement|M|sliding-window,hash-table
permutation-in-string|M|sliding-window,two-pointers
minimum-window-substring|H|sliding-window,hash-table
sliding-window-maximum|H|sliding-window,heap-priority-queue,monotonic-stack
valid-parentheses|E|stack,string
min-stack|M|stack
evaluate-reverse-polish-notation|M|stack,math
generate-parentheses|M|backtracking,string
daily-temperatures|M|stack,monotonic-stack
car-fleet|M|stack,monotonic-stack,sorting
largest-rectangle-in-histogram|H|stack,monotonic-stack
binary-search|E|binary-search
search-a-2d-matrix|M|binary-search,matrix
koko-eating-bananas|M|binary-search
find-minimum-in-rotated-sorted-array|M|binary-search
search-in-rotated-sorted-array|M|binary-search
time-based-key-value-store|M|binary-search,hash-table
median-of-two-sorted-arrays|H|binary-search
reverse-linked-list|E|linked-list
merge-two-sorted-lists|E|linked-list
reorder-list|M|linked-list,two-pointers
remove-nth-node-from-end-of-list|M|linked-list,two-pointers
copy-list-with-random-pointer|M|linked-list,hash-table
add-two-numbers|M|linked-list,math
linked-list-cycle|E|linked-list,two-pointers
find-the-duplicate-number|M|two-pointers,binary-search
lru-cache|M|linked-list,hash-table
merge-k-sorted-lists|H|linked-list,heap-priority-queue
reverse-nodes-in-k-group|H|linked-list
invert-binary-tree|E|tree,binary-tree
maximum-depth-of-binary-tree|E|tree,binary-tree,depth-first-search
diameter-of-binary-tree|E|tree,binary-tree,depth-first-search
balanced-binary-tree|E|tree,binary-tree
same-tree|E|tree,binary-tree
subtree-of-another-tree|E|tree,binary-tree
lowest-common-ancestor-of-a-binary-search-tree|M|tree,binary-search-tree
binary-tree-level-order-traversal|M|tree,binary-tree,breadth-first-search
binary-tree-right-side-view|M|tree,binary-tree,breadth-first-search
count-good-nodes-in-binary-tree|M|tree,binary-tree,depth-first-search
validate-binary-search-tree|M|tree,binary-search-tree
kth-smallest-element-in-a-bst|M|tree,binary-search-tree
construct-binary-tree-from-preorder-and-inorder-traversal|M|tree,binary-tree,hash-table
binary-tree-maximum-path-sum|H|tree,binary-tree,dynamic-programming
serialize-and-deserialize-binary-tree|H|tree,binary-tree,breadth-first-search
implement-trie-prefix-tree|M|trie,hash-table
design-add-and-search-words-data-structure|M|trie,depth-first-search
word-search-ii|H|trie,backtracking,matrix
kth-largest-element-in-a-stream|E|heap-priority-queue
last-stone-weight|E|heap-priority-queue
k-closest-points-to-origin|M|heap-priority-queue,math
kth-largest-element-in-an-array|M|heap-priority-queue,sorting
task-scheduler|M|heap-priority-queue,greedy
design-twitter|M|heap-priority-queue,hash-table
find-median-from-data-stream|H|heap-priority-queue,two-pointers
subsets|M|backtracking,bit-manipulation
combination-sum|M|backtracking
permutations|M|backtracking
subsets-ii|M|backtracking
combination-sum-ii|M|backtracking
word-search|M|backtracking,matrix
palindrome-partitioning|M|backtracking,dynamic-programming
letter-combinations-of-a-phone-number|M|backtracking,hash-table
n-queens|H|backtracking
number-of-islands|M|graph,depth-first-search,breadth-first-search,union-find
max-area-of-island|M|graph,depth-first-search
clone-graph|M|graph,hash-table,depth-first-search
walls-and-gates|M|graph,breadth-first-search
rotting-oranges|M|graph,breadth-first-search,matrix
pacific-atlantic-water-flow|M|graph,depth-first-search,matrix
surrounded-regions|M|graph,depth-first-search,union-find
course-schedule|M|graph,topological-sort,depth-first-search
course-schedule-ii|M|graph,topological-sort
graph-valid-tree|M|graph,union-find
number-of-connected-components-in-an-undirected-graph|M|graph,union-find
redundant-connection|M|graph,union-find
word-ladder|H|graph,breadth-first-search,hash-table
reconstruct-itinerary|H|graph,depth-first-search
min-cost-to-connect-all-points|M|graph,minimum-spanning-tree
network-delay-time|M|graph,shortest-path,heap-priority-queue
swim-in-rising-water|H|graph,shortest-path,heap-priority-queue
alien-dictionary|H|graph,topological-sort
cheapest-flights-within-k-stops|M|graph,shortest-path,dynamic-programming
climbing-stairs|E|dynamic-programming,memoization
min-cost-climbing-stairs|E|dynamic-programming
house-robber|M|dynamic-programming
house-robber-ii|M|dynamic-programming
longest-palindromic-substring|M|dynamic-programming,two-pointers
palindromic-substrings|M|dynamic-programming,two-pointers
decode-ways|M|dynamic-programming,string
coin-change|M|dynamic-programming
maximum-product-subarray|M|dynamic-programming,array
word-break|M|dynamic-programming,trie,hash-table
longest-increasing-subsequence|M|dynamic-programming,binary-search
partition-equal-subset-sum|M|dynamic-programming
unique-paths|M|dynamic-programming,math
longest-common-subsequence|M|dynamic-programming,string
best-time-to-buy-and-sell-stock-with-cooldown|M|dynamic-programming
coin-change-ii|M|dynamic-programming
target-sum|M|dynamic-programming,backtracking
interleaving-string|M|dynamic-programming,string
longest-increasing-path-in-a-matrix|H|dynamic-programming,depth-first-search,topological-sort
distinct-subsequences|H|dynamic-programming,string
edit-distance|M|dynamic-programming,string
burst-balloons|H|dynamic-programming
regular-expression-matching|H|dynamic-programming,string
maximum-subarray|M|array,dynamic-programming,greedy
jump-game|M|greedy,dynamic-programming
jump-game-ii|M|greedy,dynamic-programming
gas-station|M|greedy
hand-of-straights|M|greedy,hash-table,sorting
merge-triplets-to-form-target-triplet|M|greedy
partition-labels|M|greedy,two-pointers
valid-parenthesis-string|M|greedy,dynamic-programming,stack
insert-interval|M|sorting,line-sweep
merge-intervals|M|sorting,line-sweep
non-overlapping-intervals|M|sorting,greedy
meeting-rooms|E|sorting
meeting-rooms-ii|M|sorting,heap-priority-queue,line-sweep
minimum-interval-to-include-each-query|H|sorting,heap-priority-queue,line-sweep
rotate-image|M|matrix,math
spiral-matrix|M|matrix
set-matrix-zeroes|M|matrix,hash-table
happy-number|E|math,hash-table
plus-one|E|math,array
pow-x-n|M|math
multiply-strings|M|math,string
single-number|E|bit-manipulation
number-of-1-bits|E|bit-manipulation
counting-bits|E|bit-manipulation,dynamic-programming
reverse-bits|E|bit-manipulation
missing-number|E|bit-manipulation,math
sum-of-two-integers|M|bit-manipulation,math
reverse-integer|M|math
combine-two-tables|E|database
second-highest-salary|M|database
nth-highest-salary|M|database
rank-scores|M|database
consecutive-numbers|M|database
employees-earning-more-than-their-managers|E|database
duplicate-emails|E|database
customers-who-never-order|E|database
department-highest-salary|M|database
department-top-three-salaries|H|database
rising-temperature|E|database
game-play-analysis-iv|M|database
`

const DIFF = { E: 'Easy', M: 'Medium', H: 'Hard' }
const SMALL = new Set(['a', 'an', 'the', 'of', 'in', 'to', 'and', 'or', 'with', 'from', 'for', 'ii', 'iv', 'k', 'x', 'n', '1', '2d', '3sum', 'bst', 'lru'])
const SPECIAL = { ii: 'II', iv: 'IV', k: 'K', x: 'x', n: 'n', '2d': '2D', '3sum': '3Sum', bst: 'BST', lru: 'LRU', '1': '1' }

export function titleFromSlug(slug) {
  return slug.split('-').map((w, i) => {
    if (SPECIAL[w]) return SPECIAL[w]
    if (i > 0 && SMALL.has(w)) return w
    return w.charAt(0).toUpperCase() + w.slice(1)
  }).join(' ')
}

export const PROBLEM_BANK = RAW.trim().split('\n').map(line => {
  const [slug, d, tags] = line.split('|')
  return {
    slug,
    title: titleFromSlug(slug),
    difficulty: DIFF[d],
    tags: tags.split(','),
    url: `https://leetcode.com/problems/${slug}/`,
  }
})

export const PROBLEM_BY_SLUG = new Map(PROBLEM_BANK.map(p => [p.slug, p]))

// Parse a LeetCode problem URL (or bare slug) → slug, or null.
export function slugFromLeetcodeUrl(input) {
  if (!input) return null
  const s = String(input).trim()
  const m = s.match(/leetcode\.(?:com|cn)\/problems\/([a-z0-9-]+)/i)
  if (m) return m[1].toLowerCase()
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) return s
  return null
}
