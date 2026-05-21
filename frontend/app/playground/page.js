"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Cpu, Code2, Clipboard, RefreshCw, Sparkles, Wand2, Bug, Gauge, Lightbulb, ListChecks, MessageSquare, ShieldCheck } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api, apiLong } from "../../lib/api";
import { useRequireAuth } from "../../hooks/useRequireAuth";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const SNIPPETS = {
  cpp: `#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

// C++ Quicksort / Binary Search Template
int main() {
    int n;
    cout << "Enter number of elements: ";
    if (!(cin >> n)) {
        cout << "\\n[Error] Please provide input elements in the custom input section!" << endl;
        return 0;
    }
    
    vector<int> arr(n);
    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }
    
    // Sort array
    sort(arr.begin(), arr.end());
    
    cout << "\\nSorted array elements:" << endl;
    for (int x : arr) {
        cout << x << " ";
    }
    cout << endl;
    
    return 0;
}`,
  python: `# Python Binary Search Tree (BST) Template
import sys

class Node:
    def __init__(self, key):
        self.left = None
        self.right = None
        self.val = key

def insert(root, key):
    if root is None:
        return Node(key)
    if key < root.val:
        root.left = insert(root.left, key)
    else:
        root.right = insert(root.right, key)
    return root

def inorder(root):
    if root:
        inorder(root.left)
        print(root.val, end=" ")
        inorder(root.right)

def main():
    print("Reading integers from custom input...")
    input_data = sys.stdin.read().split()
    if not input_data:
        print("[Warning] No custom inputs found in stdin panel. Using defaults [50, 30, 20, 40, 70, 60, 80]")
        numbers = [50, 30, 20, 40, 70, 60, 80]
    else:
        try:
            numbers = [int(x) for x in input_data]
        except ValueError:
            print("[Error] Invalud numeric input tokens.")
            return

    r = Node(numbers[0])
    for num in numbers[1:]:
        insert(r, num)
        
    print("Inorder traversal of the generated BST:")
    inorder(r)
    print()

if __name__ == "__main__":
    main()`,
  javascript: `// JavaScript custom Input Parser
const fs = require('fs');

function main() {
    const input = fs.readFileSync(0, 'utf-8').trim();
    if (!input) {
        console.log("[Warning] No custom input. Provide numbers in the Custom Input panel.");
        console.log("Example sum of [10, 20, 30, 40] = 100");
        return;
    }
    
    const tokens = input.split(/\\s+/).map(Number).filter(x => !isNaN(x));
    const sum = tokens.reduce((acc, curr) => acc + curr, 0);
    
    console.log("Tokens read:", tokens);
    console.log("Sum of all custom input values:", sum);
}

main();`,
  typescript: `// TypeScript execution model
import * as fs from 'fs';

function solve() {
    const input = fs.readFileSync(0, 'utf-8').trim();
    if (!input) {
        console.log("Standard input stream is empty.");
        return;
    }
    const lines = input.split('\\n');
    console.log(\`Received \${lines.length} lines from custom input:\`);
    lines.forEach((line, i) => {
        console.log(\`Line \${i + 1}: \${line}\`);
    });
}

solve();`,
  java: `import java.util.Scanner;
import java.util.ArrayList;
import java.util.Collections;

// Java collection sort template
public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        ArrayList<Integer> nums = new ArrayList<>();
        
        System.out.println("Loading custom inputs...");
        while (scanner.hasNextInt()) {
            nums.add(scanner.nextInt());
        }
        
        if (nums.isEmpty()) {
            System.out.println("[Warning] Stdin stream empty. Paste numbers below!");
            return;
        }
        
        Collections.sort(nums);
        System.out.println("Sorted Inputs: " + nums);
    }
}`
};

const CPP_DSA_COMPLETIONS = [
  {
    label: "gcd",
    detail: "Generic GCD function",
    insertText: `gcd(T a, T b) {
    while (b) {
        T t = a % b;
        a = b;
        b = t;
    }
    return a;
}`,
    match: /\bgcd\s*\([^)]*$|\bgcd$/
  },
  {
    label: "modpow",
    detail: "Fast binary exponentiation",
    insertText: `modpow(ll a, ll e, ll mod = MOD) {
    ll res = 1 % mod;
    a %= mod;
    while (e > 0) {
        if (e & 1) res = (res * a) % mod;
        a = (a * a) % mod;
        e >>= 1;
    }
    return res;
}`,
    match: /\bmodpow$|\bpower$|\bbinpow$/
  },
  {
    label: "readvec",
    detail: "Read vector<int>",
    insertText: `int n;
cin >> n;
vector<int> a(n);
for (int i = 0; i < n; i++) cin >> a[i];`,
    match: /\breadvec$|\binputvec$/
  },
  {
    label: "fori",
    detail: "Indexed for loop",
    insertText: `for (int i = 0; i < n; i++) {
    $0
}`,
    match: /\bfori$/
  },
  {
    label: "bfs",
    detail: "BFS over adjacency list",
    insertText: `vector<int> dist(n, -1);
queue<int> q;
dist[src] = 0;
q.push(src);
while (!q.empty()) {
    int u = q.front();
    q.pop();
    for (int v : adj[u]) {
        if (dist[v] == -1) {
            dist[v] = dist[u] + 1;
            q.push(v);
        }
    }
}`,
    match: /\bbfs$/
  },
  {
    label: "dfs",
    detail: "Recursive DFS lambda",
    insertText: `vector<int> vis(n, 0);
auto dfs = [&](auto&& self, int u) -> void {
    vis[u] = 1;
    for (int v : adj[u]) {
        if (!vis[v]) self(self, v);
    }
};
dfs(dfs, 0);`,
    match: /\bdfs$/
  },
  {
    label: "binary_search_answer",
    detail: "Binary search on answer",
    insertText: `ll lo = 0, hi = 1e18, ans = -1;
while (lo <= hi) {
    ll mid = lo + (hi - lo) / 2;
    if (can(mid)) {
        ans = mid;
        hi = mid - 1;
    } else {
        lo = mid + 1;
    }
}`,
    match: /\bbinsearch$|\bbinary$/
  },
  {
    label: "dsu",
    detail: "Disjoint Set Union",
    insertText: `struct DSU {
    vector<int> parent, sz;
    DSU(int n) : parent(n), sz(n, 1) {
        iota(parent.begin(), parent.end(), 0);
    }
    int find(int x) {
        return parent[x] == x ? x : parent[x] = find(parent[x]);
    }
    bool unite(int a, int b) {
        a = find(a), b = find(b);
        if (a == b) return false;
        if (sz[a] < sz[b]) swap(a, b);
        parent[b] = a;
        sz[a] += sz[b];
        return true;
    }
};`,
    match: /\bdsu$|\bunionfind$/
  }
];

const LOCAL_INLINE_PATTERNS = {
  python: [
    { match: /^\s*fori$/, text: "for i in range(n):\n    " },
    { match: /^\s*readints$/, text: "arr = list(map(int, input().split()))" },
    { match: /^\s*readn$/, text: "n = int(input())" },
    { match: /^\s*def bfs$/, text: "(graph, start):\n    from collections import deque\n    q = deque([start])\n    seen = {start}\n    while q:\n        node = q.popleft()\n        for nei in graph[node]:\n            if nei not in seen:\n                seen.add(nei)\n                q.append(nei)" },
    { match: /^\s*def dfs$/, text: "(node):\n    seen.add(node)\n    for nei in graph[node]:\n        if nei not in seen:\n            dfs(nei)" },
    { match: /^\s*bisect$/, text: "from bisect import bisect_left, bisect_right" }
  ],
  javascript: [
    { match: /^\s*readints$/, text: "const nums = input.trim().split(/\\s+/).map(Number);" },
    { match: /^\s*fori$/, text: "for (let i = 0; i < n; i++) {\n  \n}" },
    { match: /^\s*bfs$/, text: "const q = [start];\nconst seen = new Set([start]);\nfor (let head = 0; head < q.length; head++) {\n  const node = q[head];\n  for (const nei of graph[node]) {\n    if (!seen.has(nei)) {\n      seen.add(nei);\n      q.push(nei);\n    }\n  }\n}" }
  ],
  typescript: [
    { match: /^\s*readints$/, text: "const nums: number[] = input.trim().split(/\\s+/).map(Number);" },
    { match: /^\s*fori$/, text: "for (let i = 0; i < n; i++) {\n  \n}" },
    { match: /^\s*typepair$/, text: "type Pair = [number, number];" }
  ],
  java: [
    { match: /^\s*fori$/, text: "for (int i = 0; i < n; i++) {\n    \n}" },
    { match: /^\s*readints$/, text: "int n = scanner.nextInt();\nint[] arr = new int[n];\nfor (int i = 0; i < n; i++) arr[i] = scanner.nextInt();" },
    { match: /^\s*arraylist$/, text: "ArrayList<Integer> list = new ArrayList<>();" }
  ]
};

const AI_ACTIONS = [
  { task: "hint", label: "Hint", icon: Lightbulb, prompt: "Give a progressive DSA hint for this code/problem attempt. Do not reveal a full solution unless the code is already almost complete." },
  { task: "fix", label: "Fix", icon: Bug, prompt: "Find and fix correctness, compile, runtime, and input-handling bugs. Return corrected code only." },
  { task: "optimize", label: "Optimize", icon: Gauge, prompt: "Optimize this DSA solution for time and memory. Return improved code only when code changes are needed; otherwise explain the bottleneck concisely." },
  { task: "edge-cases", label: "Edge Cases", icon: ShieldCheck, prompt: "List the strongest edge cases and tricky tests for this DSA solution, including expected behavior." },
  { task: "complexity", label: "Complexity", icon: ListChecks, prompt: "Analyze time complexity, space complexity, and why. Mention hidden constants or bottlenecks." },
  { task: "explain", label: "Explain", icon: MessageSquare, prompt: "Explain this code like a senior DSA mentor. Focus on algorithm, invariants, input/output, and failure points." }
];

function getCppSmartCompletion(lineBeforeCursor) {
  const trimmed = lineBeforeCursor.trim();
  if (trimmed === "#include") return " <bits/stdc++.h>";
  if (/\bgcd\s*\([^)]*$/.test(trimmed)) {
    if (/,\s*T\s*$/.test(trimmed)) {
      return ` b) {
    while (b) {
        T t = a % b;
        a = b;
        b = t;
    }
    return a;
}`;
    }
    return `(T a, T b) {
    while (b) {
        T t = a % b;
        a = b;
        b = t;
    }
    return a;
}`;
  }
  const exact = CPP_DSA_COMPLETIONS.find((item) => item.match.test(trimmed));
  if (exact) return exact.insertText;
  if (/template\s*<typename\s+T>\s*$/.test(trimmed)) {
    return "\nT gcd(T a, T b) {\n    while (b) {\n        T t = a % b;\n        a = b;\n        b = t;\n    }\n    return a;\n}";
  }
  return "";
}

function getCppInlineCompletion(lineBeforeCursor) {
  const trimmed = lineBeforeCursor.trim();
  if (trimmed === "#include") return " <bits/stdc++.h>";
  if (trimmed === "#include <") return "bits/stdc++.h>";
  if (trimmed === "#include <iost") return "ream>";
  if (trimmed === "#include <vec") return "tor>";
  if (trimmed === "#include <algo") return "rithm>";
  if (trimmed === "using namespace") return " std;";
  if (trimmed === "using namespace std") return ";";
  if (trimmed === "template <typename T>") {
    return `\nT gcd(T a, T b) {
    while (b) {
        T t = a % b;
        a = b;
        b = t;
    }
    return a;
}`;
  }
  if (/\bT\s+gcd\s*\(\s*T\s+a\s*,\s*T$/.test(trimmed)) {
    return ` b) {
    while (b) {
        T t = a % b;
        a = b;
        b = t;
    }
    return a;
}`;
  }
  if (/\bgcd$/.test(trimmed)) return `(T a, T b)`;
  if (/\bfori$/.test(trimmed)) {
    return ` (int i = 0; i < n; i++) {
    
}`;
  }
  if (/\breadvec$/.test(trimmed)) {
    return `int n;
cin >> n;
vector<int> a(n);
for (int i = 0; i < n; i++) cin >> a[i];`;
  }
  if (/\bmodpow$|\bbinpow$/.test(trimmed)) {
    return `(ll a, ll e, ll mod = MOD) {
    ll res = 1 % mod;
    a %= mod;
    while (e > 0) {
        if (e & 1) res = (res * a) % mod;
        a = (a * a) % mod;
        e >>= 1;
    }
    return res;
}`;
  }
  if (/\bdsu$/.test(trimmed)) return CPP_DSA_COMPLETIONS.find((item) => item.label === "dsu")?.insertText || "";
  if (/\bbfs$/.test(trimmed)) return CPP_DSA_COMPLETIONS.find((item) => item.label === "bfs")?.insertText || "";
  if (/\bdfs$/.test(trimmed)) return CPP_DSA_COMPLETIONS.find((item) => item.label === "dfs")?.insertText || "";
  if (/\bbinsearch$/.test(trimmed)) return CPP_DSA_COMPLETIONS.find((item) => item.label === "binary_search_answer")?.insertText || "";
  return "";
}

function getLocalInlineCompletion(language, lineBeforeCursor) {
  if (language === "cpp") return getCppInlineCompletion(lineBeforeCursor);
  const rules = LOCAL_INLINE_PATTERNS[language] || [];
  const hit = rules.find((item) => item.match.test(lineBeforeCursor.trimEnd()));
  return hit?.text || "";
}

function buildLocalSuggestions(monaco, model, position, language) {
  const word = model.getWordUntilPosition(position);
  const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
  if (language !== "cpp") return [];

  const snippets = CPP_DSA_COMPLETIONS.map((item) => ({
    label: item.label,
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: item.insertText,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail: item.detail,
    documentation: "Instant local DSA snippet. No AI wait.",
    range
  }));

  return [
    {
      label: "bits/stdc++.h",
      kind: monaco.languages.CompletionItemKind.Module,
      insertText: "bits/stdc++.h>",
      detail: "C++ all-in-one include",
      range
    },
    ...snippets
  ];
}

function PlaygroundInner() {
  const router = useRouter();
  const { user, booted } = useRequireAuth();
  
  const [language, setLanguage] = useState("cpp");
  const [code, setCode] = useState(SNIPPETS.cpp);
  const [stdin, setStdin] = useState("5\n43\n12\n89\n5\n27");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPanelResult, setAiPanelResult] = useState("");
  const [aiPanelTask, setAiPanelTask] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [executionStats, setExecutionStats] = useState(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const aiRequestRef = useRef(false);
  const aiEnabledRef = useRef(aiEnabled);
  const ghostTextRef = useRef("");
  const ghostDecorationRef = useRef(null);
  const ghostTimerRef = useRef(null);
  const remoteGhostTimerRef = useRef(null);
  const remoteGhostKeyRef = useRef("");
  const remoteGhostSeqRef = useRef(0);
  const remoteGhostAbortRef = useRef(null);
  const codeRef = useRef(code);
  const languageRef = useRef(language);

  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { aiEnabledRef.current = aiEnabled; }, [aiEnabled]);
  
  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setCode(SNIPPETS[lang] || "");
    
    if (lang === "cpp" || lang === "python" || lang === "java") {
      setStdin("5\n43\n12\n89\n5\n27");
    } else if (lang === "javascript" || lang === "typescript") {
      setStdin("10 20 30 40 50");
    } else {
      setStdin("");
    }
  };

  async function runPlaygroundCode() {
    setRunning(true);
    setOutput("Running execution sandboxed container...");
    setExecutionStats(null);
    try {
      const { data } = await apiLong.post("/execute", {
        language,
        code,
        stdin
      });
      
      const parts = [];
      if (data.output) parts.push(data.output);
      if (data.error) parts.push(`[stderr]\n${data.error}`);
      
      setOutput(parts.join("\n") || "Executed successfully with no stdout.");
      setExecutionStats({
        exitCode: data.exitCode,
        executionTimeMs: data.executionTimeMs
      });
    } catch (error) {
      setOutput(`Error: ${error.response?.data?.detail || error.message || "Compilation failed"}`);
      setExecutionStats({
        exitCode: 1,
        executionTimeMs: 0
      });
    } finally {
      setRunning(false);
    }
  }

  function resetSnippet() {
    setCode(SNIPPETS[language]);
    toast.success("Snippet reset to default template");
  }

  function copyOutputToClipboard() {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      toast.success("Output copied!");
    });
  }

  async function requestAiCompletion(positionOverride) {
    const editor = editorRef.current;
    if (!editor) return "";
    const position = positionOverride || editor.getPosition();
    if (!position || aiRequestRef.current) return "";
    aiRequestRef.current = true;
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/complete", {
        language: languageRef.current,
        code: codeRef.current,
        cursorLine: position.lineNumber,
        cursorColumn: position.column,
        context: "DSA playground autocomplete. Complete the exact cursor location only. Prefer competitive-programming style and minimal insertions."
      });
      return data.completion || "";
    } catch (error) {
      toast.error(error.response?.data?.detail || "AI autocomplete failed");
      return "";
    } finally {
      aiRequestRef.current = false;
      setAiLoading(false);
    }
  }

  async function runAiAction(action) {
    setAiPanelTask(action.label);
    setAiPanelResult("Thinking...");
    setAiLoading(true);
    try {
      const editor = editorRef.current;
      const selection = editor?.getModel()?.getValueInRange(editor.getSelection()) || "";
      const prompt = `${action.prompt}

Custom stdin:
${stdin || "(empty)"}

User question:
${aiQuestion || "(none)"}`;
      const { data } = await api.post("/ai/workspace", {
        task: action.task === "hint" || action.task === "edge-cases" || action.task === "complexity" ? "ask" : action.task,
        language,
        code,
        selection,
        fileName: `main.${language === "cpp" ? "cpp" : language}`,
        workspaceContext: "Standalone DSA playground. User is solving algorithmic problems with custom stdin and sandbox execution.",
        prompt
      });
      setAiPanelResult(data.result || "No response.");
    } catch (error) {
      setAiPanelResult(error.response?.data?.detail || "AI request failed.");
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiPanelResult() {
    const editor = editorRef.current;
    if (!editor || !aiPanelResult || aiPanelResult === "Thinking...") return;
    const model = editor.getModel();
    const selection = editor.getSelection();
    const text = aiPanelResult.replace(/^```[a-zA-Z0-9+_-]*\n?/, "").replace(/```$/, "").trim();
    editor.executeEdits("ai-panel-apply", [{
      range: selection && !selection.isEmpty() ? selection : model.getFullModelRange(),
      text,
      forceMoveMarkers: true
    }]);
    editor.focus();
    toast.success("AI result applied");
  }

  async function insertAiCompletion() {
    const editor = editorRef.current;
    if (!editor) return;
    const position = editor.getPosition();
    const model = editor.getModel();
    const lineBeforeCursor = model?.getLineContent(position.lineNumber).slice(0, position.column - 1) || "";
    const localCompletion = languageRef.current === "cpp" ? getCppSmartCompletion(lineBeforeCursor) : "";
    if (localCompletion) {
      editor.executeEdits("local-complete", [{
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        },
        text: localCompletion,
        forceMoveMarkers: true
      }]);
      editor.focus();
      return;
    }
    const completion = await requestAiCompletion(position);
    if (!completion) return;
    editor.executeEdits("ai-complete", [{
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      },
      text: completion,
      forceMoveMarkers: true
    }]);
    editor.focus();
  }

  function clearGhostSuggestion() {
    ghostTextRef.current = "";
    ghostDecorationRef.current?.clear();
  }

  function updateGhostSuggestion(editor, monaco) {
    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position || !aiEnabledRef.current) {
      clearGhostSuggestion();
      return;
    }

    const lineBeforeCursor = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const completion = getLocalInlineCompletion(languageRef.current, lineBeforeCursor);
    if (!completion) {
      clearGhostSuggestion();
      return;
    }

    ghostTextRef.current = completion;
    const firstLine = completion.split("\n")[0];
    const preview = firstLine + (completion.includes("\n") ? " ..." : "");
    ghostDecorationRef.current?.set([{
      range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
      options: {
        showIfCollapsed: true,
        after: {
          content: preview,
          inlineClassName: "aether-ghost-text",
          cursorStops: monaco.editor.InjectedTextCursorStops.None
        }
      }
    }]);
  }

  function scheduleGhostSuggestion(editor, monaco) {
    window.clearTimeout(ghostTimerRef.current);
    window.clearTimeout(remoteGhostTimerRef.current);
    ghostTimerRef.current = window.setTimeout(() => updateGhostSuggestion(editor, monaco), 30);
    remoteGhostTimerRef.current = window.setTimeout(() => requestRemoteGhostSuggestion(editor, monaco), 420);
  }

  async function requestRemoteGhostSuggestion(editor, monaco) {
    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position || !aiEnabledRef.current || ghostTextRef.current || aiRequestRef.current) return;

    const line = model.getLineContent(position.lineNumber);
    const before = line.slice(0, position.column - 1);
    if (before.trim().length < 3 || before.trim().startsWith("//") || before.trim().startsWith("# ")) return;

    const key = `${languageRef.current}:${position.lineNumber}:${position.column}:${before}:${codeRef.current.length}`;
    if (remoteGhostKeyRef.current === key) return;
    remoteGhostKeyRef.current = key;
    const seq = ++remoteGhostSeqRef.current;

    remoteGhostAbortRef.current?.abort?.();
    const controller = new AbortController();
    remoteGhostAbortRef.current = controller;

    aiRequestRef.current = true;
    try {
      const { data } = await api.post("/ai/complete", {
        language: languageRef.current,
        code: codeRef.current,
        cursorLine: position.lineNumber,
        cursorColumn: position.column,
        context: "Fast inline DSA ghost text. Return only the next few tokens/lines needed at cursor."
      }, { signal: controller.signal, timeout: 4500 });

      if (seq !== remoteGhostSeqRef.current || !data.completion) return;
      const freshPos = editor.getPosition();
      if (!freshPos || freshPos.lineNumber !== position.lineNumber || freshPos.column !== position.column) return;

      const completion = data.completion.trimEnd();
      if (!completion || completion.length > 1200) return;
      ghostTextRef.current = completion;
      const firstLine = completion.split("\n")[0];
      const preview = firstLine + (completion.includes("\n") ? " ..." : "");
      ghostDecorationRef.current?.set([{
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        options: {
          showIfCollapsed: true,
          after: {
            content: preview,
            inlineClassName: "aether-ghost-text aether-ai-ghost-text",
            cursorStops: monaco.editor.InjectedTextCursorStops.None
          }
        }
      }]);
    } catch (error) {
      if (error.name !== "CanceledError" && error.code !== "ERR_CANCELED") {
        remoteGhostKeyRef.current = "";
      }
    } finally {
      aiRequestRef.current = false;
    }
  }

  function acceptGhostSuggestion(editor) {
    const completion = ghostTextRef.current;
    if (!completion) return false;
    const position = editor.getPosition();
    editor.executeEdits("ghost-complete", [{
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      },
      text: completion,
      forceMoveMarkers: true
    }]);
    clearGhostSuggestion();
    editor.focus();
    return true;
  }

  function handleEditorMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    ghostDecorationRef.current = editor.createDecorationsCollection([]);
    monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ["#", "g", "d", "b", "f", "m", "r"],
      provideCompletionItems: (model, position) => ({
        suggestions: buildLocalSuggestions(monaco, model, position, languageRef.current)
      })
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      updateGhostSuggestion(editor, monaco);
      if (!ghostTextRef.current) editor.trigger("keyboard", "editor.action.triggerSuggest", {});
    });
    editor.addCommand(monaco.KeyCode.Tab, () => {
      if (!acceptGhostSuggestion(editor)) {
        editor.trigger("keyboard", "type", { text: "    " });
      }
    });
    editor.onDidChangeModelContent(() => scheduleGhostSuggestion(editor, monaco));
    editor.onDidChangeCursorPosition(() => scheduleGhostSuggestion(editor, monaco));
    editor.onDidBlurEditorText(() => clearGhostSuggestion());
    scheduleGhostSuggestion(editor, monaco);
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(ghostTimerRef.current);
      window.clearTimeout(remoteGhostTimerRef.current);
      remoteGhostAbortRef.current?.abort?.();
      ghostDecorationRef.current?.clear();
    };
  }, []);

  if (!booted || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-rail">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="relative flex flex-col h-screen bg-rail text-slate-200 font-sans overflow-hidden">
      <style>{`
        .monaco-editor .aether-ghost-text {
          color: rgba(148, 163, 184, 0.45);
          font-style: italic;
          pointer-events: none;
        }
        .monaco-editor .aether-ai-ghost-text {
          color: rgba(143, 179, 155, 0.55);
        }
      `}</style>
      
      {/* Subtle Glow Accents */}
      <div className="glow-overlay right-[-10%] top-[-10%] h-[400px] w-[400px] bg-accent opacity-[0.04]" />
      <div className="glow-overlay left-[-10%] bottom-[-10%] h-[400px] w-[400px] bg-luxuryPurple opacity-[0.04]" />

      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-[#090b10] px-6 z-10 select-none">
        <div className="flex items-center gap-3.5">
          <Link 
            href="/dashboard" 
            className="flex h-8 items-center gap-1.5 rounded-xl border border-line bg-panel/30 px-3 text-xs font-bold text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={13} /> Back
          </Link>
          <div className="h-4 w-[1px] bg-line/60" />
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 border border-accent/25 text-accent shadow-sm">
              <Sparkles size={12} className="animate-pulse" />
            </span>
            <h1 className="text-xs font-extrabold tracking-widest text-white uppercase">Playground</h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="h-8 rounded-lg border border-line bg-rail/60 px-2.5 text-xs font-bold text-slate-300 outline-none transition focus:border-accent"
            >
              <option value="cpp">C++ (GCC 17)</option>
              <option value="python">Python (3.12)</option>
              <option value="javascript">JavaScript (NodeJS)</option>
              <option value="typescript">TypeScript (esbuild)</option>
              <option value="java">Java (OpenJDK)</option>
            </select>
          </div>

          <button 
            onClick={resetSnippet}
            className="flex h-8 items-center gap-1 rounded-lg border border-line bg-rail/60 px-2.5 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition"
            title="Reset template code"
          >
            <RefreshCw size={11} /> Reset
          </button>

          <button
            onClick={() => setAiEnabled((v) => !v)}
            className={`flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-bold transition ${
              aiEnabled 
                ? "border-accent/30 bg-accent/10 text-accent" 
                : "border-line bg-rail/60 text-slate-400 hover:text-slate-200"
            }`}
            title="Toggle AI inline autocomplete"
          >
            <Wand2 size={11} /> AI Autocomplete
          </button>

          <button
            onClick={insertAiCompletion}
            disabled={aiLoading}
            className="flex h-8 items-center gap-1 rounded-lg border border-line bg-rail/60 px-2.5 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition disabled:opacity-40"
            title="Insert AI completion at cursor"
          >
            <Wand2 size={11} /> {aiLoading ? "Thinking..." : "Complete"}
          </button>

          <button
            onClick={runPlaygroundCode}
            disabled={running}
            className="flex h-8 items-center gap-1 rounded-lg bg-accent px-3 text-[11px] font-black text-rail transition hover:shadow-[0_0_12px_rgba(0,240,168,0.3)] disabled:opacity-40"
          >
            <Play size={11} className="fill-current" /> {running ? "Running..." : "Run Code"}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Editor Wrapper */}
        <div className="flex-1 flex flex-col border-r border-line bg-[#1e1e1e]">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-line bg-panel/30 px-4 select-none">
            <span className="text-[9px] font-extrabold tracking-wider text-slate-500 uppercase">Buffer</span>
            <span className="text-[9px] font-extrabold text-accent uppercase tracking-wider">{language} file</span>
          </div>
          <div className="flex-1 min-h-0">
            <MonacoEditor
              key={language}
              height="100%"
              theme="vs-dark"
              language={language}
              value={code}
              onChange={(v) => setCode(v || "")}
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
                fontLigatures: true,
                minimap: { enabled: false },
                lineNumbers: "on",
                automaticLayout: true,
                padding: { top: 12 },
                inlineSuggest: { enabled: false },
                quickSuggestions: false,
                suggestOnTriggerCharacters: false,
                tabCompletion: "on",
                scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 }
              }}
            />
          </div>
        </div>

        {/* Input/Output Panels */}
        <div className="w-[500px] flex flex-col min-h-0 bg-[#090b10] shrink-0">
          <div className="h-[26%] flex flex-col border-b border-line">
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-line bg-panel/30 px-4 select-none">
              <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase flex items-center gap-1">
                <Code2 size={11} className="text-accent" />
                Custom Stdin
              </span>
            </div>
            <textarea
              className="flex-1 w-full bg-[#07080c] p-4 text-xs font-mono text-slate-300 outline-none resize-none placeholder-slate-600 border-none leading-relaxed"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Provide stdin values here..."
            />
          </div>

          <div className="h-[32%] flex flex-col relative min-h-0 border-b border-line">
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-line bg-panel/30 px-4 select-none">
              <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase flex items-center gap-1">
                <Cpu size={11} className="text-accent" />
                Console Output
              </span>
              {output && (
                <button 
                  onClick={copyOutputToClipboard}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-white/5 hover:text-white"
                  title="Copy output"
                >
                  <Clipboard size={11} />
                </button>
              )}
            </div>

            {executionStats && (
              <div className="flex items-center gap-4 bg-[#0a0d14] px-4 py-2 border-b border-line/45 text-[9px] font-mono text-slate-500 shrink-0 select-none">
                <span className="flex items-center gap-1">
                  Status: 
                  <span className={`font-bold ${executionStats.exitCode === 0 ? "text-accent" : "text-red-400"}`}>
                    {executionStats.exitCode === 0 ? "Success (0)" : `Failed (${executionStats.exitCode})`}
                  </span>
                </span>
                <span className="h-3 w-[1px] bg-line/60" />
                <span>Time: <span className="font-bold text-slate-300">{executionStats.executionTimeMs}ms</span></span>
              </div>
            )}

            <div className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed select-text bg-[#07080c] scrollbar-thin">
              {output ? (
                <div className="space-y-1">
                  {output.split("\n").map((line, idx) => {
                    const isError = line.startsWith("[stderr]") || line.toLowerCase().includes("error") || line.toLowerCase().includes("exception") || line.toLowerCase().includes("failed");
                    return (
                      <div 
                        key={idx} 
                        className={isError ? "text-red-400 bg-red-950/20 px-2 py-0.5 rounded border border-red-900/10 font-bold" : "text-slate-300"}
                      >
                        {line}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-slate-500 italic text-[11px]">
                  Standby compiler. Click "Run Code" to compile.
                </div>
              )}
            </div>
          </div>

          <div className="h-[42%] flex min-h-0 flex-col bg-[#080a0f]">
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-line bg-panel/30 px-4 select-none">
              <span className="text-[9px] font-extrabold tracking-wider text-slate-300 uppercase flex items-center gap-1">
                <Sparkles size={11} className="text-accent" />
                DSA AI Coach
              </span>
              <span className="text-[9px] font-bold text-slate-500">{aiPanelTask || "inline + actions"}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 shrink-0">
              {AI_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.task}
                    onClick={() => runAiAction(action)}
                    disabled={aiLoading}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-[#10151c] text-[10px] font-black uppercase tracking-wide text-slate-300 transition hover:border-accent/50 hover:bg-accent/10 hover:text-white disabled:opacity-40"
                  >
                    <Icon size={12} />
                    {action.label}
                  </button>
                );
              })}
            </div>

            <div className="px-3 pb-2 shrink-0">
              <textarea
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                className="h-16 w-full resize-none rounded-xl border border-line bg-[#05070b] px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-accent/60"
                placeholder="Ask anything: why WA, generate tests, explain recurrence, fix TLE..."
              />
            </div>

            <div className="flex-1 min-h-0 overflow-auto border-y border-line/70 bg-[#05070b] p-3 font-mono text-[11px] leading-relaxed text-slate-300">
              {aiPanelResult ? (
                <pre className="whitespace-pre-wrap">{aiPanelResult}</pre>
              ) : (
                <div className="space-y-2 text-slate-500">
                  <p>Inline AI suggests code as you type. Press Tab to accept.</p>
                  <p>Use these actions for hints, bug fixes, complexity, edge cases, and optimization.</p>
                </div>
              )}
            </div>

            <div className="flex h-12 shrink-0 items-center gap-2 px-3">
              <button
                onClick={() => runAiAction({ task: "ask", label: "Ask", prompt: aiQuestion || "Help with this DSA code." })}
                disabled={aiLoading || !aiQuestion.trim()}
                className="flex-1 h-8 rounded-lg bg-accent px-3 text-[10px] font-black uppercase text-rail transition disabled:opacity-40"
              >
                {aiLoading ? "Thinking..." : "Ask AI"}
              </button>
              <button
                onClick={applyAiPanelResult}
                disabled={!aiPanelResult || aiPanelResult === "Thinking..."}
                className="h-8 rounded-lg border border-line bg-[#10151c] px-3 text-[10px] font-black uppercase text-slate-300 transition hover:text-white disabled:opacity-40"
              >
                Apply
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(aiPanelResult || "").then(() => toast.success("AI answer copied"))}
                disabled={!aiPanelResult || aiPanelResult === "Thinking..."}
                className="h-8 rounded-lg border border-line bg-[#10151c] px-3 text-[10px] font-black uppercase text-slate-300 transition hover:text-white disabled:opacity-40"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-rail">
        <div className="text-slate-400 font-semibold">Loading playground...</div>
      </div>
    }>
      <PlaygroundInner />
    </Suspense>
  );
}
