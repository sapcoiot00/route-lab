import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Clock, 
  Database, 
  AlertTriangle, 
  CodeXml, 
  Copy, 
  RotateCw, 
  BookmarkCheck,
  Server,
  Search
} from "lucide-react";
import { ResponseState, RequestItem } from "../types";
import { formatBytes, formatJson, generateCodeSnippet } from "../utils";

interface ResponseViewerProps {
  response: ResponseState | null;
  activeRequest: RequestItem;
  isLoading: boolean;
}

export default function ResponseViewer({
  response,
  activeRequest,
  isLoading,
}: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<"body" | "headers" | "ai-explain" | "code-snippet" | "tests">("body");
  const [snippetLang, setSnippetLang] = useState<"curl" | "fetch" | "axios" | "python" | "go">("curl");
  const [bodySearch, setBodySearch] = useState("");
  
  // AI State Helpers
  const [copied, setCopied] = useState(false);
  const [snippetCode, setSnippetCode] = useState("");

  const [explainText, setExplainText] = useState("");
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState("");

  const [testScriptText, setTestScriptText] = useState("");
  const [testScriptLoading, setTestScriptLoading] = useState(false);
  const [testScriptError, setTestScriptError] = useState("");

  // Reset states when the request changes
  useEffect(() => {
    setSnippetCode("");
    setExplainText("");
    setTestScriptText("");
  }, [activeRequest.id, response]);

  useEffect(() => {
    if (activeTab === "code-snippet") {
      setSnippetCode(generateCodeSnippet(activeRequest, snippetLang));
    }
  }, [snippetLang, activeTab, activeRequest.id]);

  // Explain using Gemini
  const handleExplainResponse = async () => {
    if (!response) return;
    setExplainLoading(true);
    setExplainError("");
    setExplainText("");

    try {
      const resp = await fetch("/api/ai/explain-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseData: response.data,
          statusCode: response.status,
          statusText: response.statusText,
          url: activeRequest.url,
          method: activeRequest.method,
        }),
      });

      if (!resp.ok) throw new Error("Status failed: " + resp.status);
      const data = await resp.json();
      if (data.success && data.explanation) {
        setExplainText(data.explanation);
      } else {
        throw new Error(data.error || "Failed to analyze");
      }
    } catch (err: any) {
      setExplainError(err.message || "Unable to contact explanation helper");
    } finally {
      setExplainLoading(false);
    }
  };

  // Generate Automated Test Asserts
  const handleGenerateTests = async () => {
    if (!response) return;
    setTestScriptLoading(true);
    setTestScriptError("");
    setTestScriptText("");

    try {
      const resp = await fetch("/api/ai/generate-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: activeRequest.url,
          method: activeRequest.method,
          reqBody: activeRequest.bodyType !== "none" ? activeRequest.body : "",
          resStatus: response.status,
          resBody: response.data,
        }),
      });

      if (!resp.ok) throw new Error("Status code response error: " + resp.status);
      const data = await resp.json();
      if (data.success && data.testScript) {
        setTestScriptText(data.testScript);
      } else {
        throw new Error(data.error || "Assertions failed to synthesize");
      }
    } catch (err: any) {
      setTestScriptError(err.message || "Unable to generate assertions");
    } finally {
      setTestScriptLoading(false);
    }
  };

  // Fire handlers automatically if selected they correspond
  useEffect(() => {
    if (activeTab === "ai-explain" && response && !explainText && !explainLoading) {
      handleExplainResponse();
    }
    if (activeTab === "tests" && response && !testScriptText && !testScriptLoading) {
      handleGenerateTests();
    }
  }, [activeTab, response?.data]);

  const handleCopyClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const responseBodyText = response ? formatJson(response.data ?? response.error ?? "") : "";
  const searchMatches = bodySearch.trim()
    ? responseBodyText.toLowerCase().includes(bodySearch.trim().toLowerCase())
    : true;

  // Styling helper for HTTP Status families
  const getStatusBadgeStyles = (status: number) => {
    if (status >= 200 && status < 300) return "bg-emerald-900/40 text-emerald-400 border-emerald-500/30";
    if (status >= 300 && status < 400) return "bg-sky-950 text-sky-400 border-sky-850";
    if (status >= 400 && status < 500) return "bg-amber-950 text-amber-400 border-amber-850";
    if (status >= 500) return "bg-rose-950 text-rose-400 border-rose-800";
    return "bg-slate-900 border-slate-800 text-slate-400";
  };

  const getLatencyColor = (ms: number) => {
    if (ms < 200) return "text-emerald-400";
    if (ms < 700) return "text-amber-400";
    return "text-rose-400";
  };

  // Helper for rendering line breaks & bullet items in LLM text easily
  const formatMarkdownToJSX = (rawMarkdown: string) => {
    if (!rawMarkdown) return null;
    return rawMarkdown.split("\n").map((line, ix) => {
      let trimmed = line.trim();
      if (trimmed.startsWith("###")) {
        return <h4 key={ix} className="text-xs font-bold text-indigo-455 mt-2.5 pb-1 border-b border-slate-900/40">{trimmed.replace("###", "")}</h4>;
      }
      if (trimmed.startsWith("##")) {
        return <h3 key={ix} className="text-sm font-bold text-purple-300 mt-3 pt-2">{trimmed.replace("##", "")}</h3>;
      }
      if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
        return (
          <li key={ix} className="text-[11px] text-slate-350 list-disc ml-4 leading-normal mt-1">
            {trimmed.substring(1).trim()}
          </li>
        );
      }
      if (trimmed.startsWith("1.") || trimmed.startsWith("2.") || trimmed.startsWith("3.") || trimmed.startsWith("4.")) {
        return (
          <div key={ix} className="text-[11.5px] text-slate-300 pl-2 leading-relaxed font-medium mt-1">
            {trimmed}
          </div>
        );
      }
      return <p key={ix} className="text-[11px] text-slate-300 leading-normal mt-1 min-h-[12px]">{line}</p>;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950 border-t border-zinc-900 font-sans" id="response-viewer-panel">
      
      {/* 1. Header Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-zinc-900/30 border-b border-zinc-900" id="response-metrics-header">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
            <Server className="h-3 w-3" />
            Backend Response
          </span>
          
          {response && (
            <div className="flex items-center gap-2">
              {/* HTTP Status Code */}
              <span className={`px-2 py-0.5 border text-[11px] font-bold rounded-md flex items-center gap-1.5 ${getStatusBadgeStyles(response.status)}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${response.status >= 200 && response.status < 300 ? "bg-emerald-450" : "bg-rose-450"}`}></span>
                {response.status || "FAIL"} {response.statusText}
              </span>

              {/* Latency Speed */}
              <span className="bg-slate-950/60 px-2 py-0.5 border border-slate-900 rounded text-[10px] font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span className={getLatencyColor(response.responseTimeMs)}>{response.responseTimeMs} ms</span>
              </span>

              {/* Size byteLength */}
              {response.size > 0 && (
                <span className="bg-slate-950/60 px-2 py-0.5 border border-slate-900 rounded text-[10px] font-mono text-slate-300">
                  {formatBytes(response.size)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tab triggers */}
        <div className="flex flex-wrap items-center gap-1" id="response-tabs">
          <button
            onClick={() => setActiveTab("body")}
            className={`px-2.5 py-0.5 text-[11px] rounded transition-all font-semibold cursor-pointer border ${
              activeTab === "body" ? "bg-indigo-950/20 text-indigo-400 border-indigo-905/30" : "text-slate-400 hover:text-slate-200 border-transparent"
            }`}
            id="res-tab-body"
          >
            Pretty Body
          </button>
          
          {response && (
            <>
              <button
                onClick={() => setActiveTab("headers")}
                className={`px-2.5 py-0.5 text-[11px] rounded transition-all font-semibold cursor-pointer border ${
                  activeTab === "headers" ? "bg-indigo-950/20 text-indigo-400 border-indigo-905/30" : "text-slate-400 hover:text-slate-200 border-transparent"
                }`}
                id="res-tab-headers"
              >
                Headers
              </button>
              <button
                onClick={() => setActiveTab("ai-explain")}
                className={`px-2.5 py-0.5 rounded transition-all font-semibold flex items-center gap-1 cursor-pointer border ${
                  activeTab === "ai-explain" ? "bg-purple-950/35 text-purple-200 border-purple-900/30" : "text-slate-400 hover:text-slate-200 border-transparent"
                }`}
                id="res-tab-ai"
              >
                <Sparkles className="w-3 h-3 text-purple-300" />
                Explain Response
              </button>
              <button
                onClick={() => setActiveTab("tests")}
                className={`px-2.5 py-0.5 rounded transition-all font-semibold flex items-center gap-1 cursor-pointer border ${
                  activeTab === "tests" ? "bg-slate-900/60 text-yellow-300 border-yellow-950/30" : "text-slate-400 hover:text-slate-200 border-transparent"
                }`}
                id="res-tab-tests"
              >
                <BookmarkCheck className="w-3 h-3 text-yellow-450" />
                Tests
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab("code-snippet")}
            className={`px-2.5 py-0.5 rounded transition-all font-semibold flex items-center gap-1 cursor-pointer border ${
              activeTab === "code-snippet" ? "bg-indigo-950/20 text-indigo-400 border-indigo-905/30" : "text-slate-400 hover:text-slate-200 border-transparent"
            }`}
            id="res-tab-code"
          >
            <CodeXml className="w-3 h-3" />
            Snippet Code
          </button>
        </div>
      </div>

      {/* 2. Log Loading and Empty States */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3" id="response-tab-container">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3.5" id="response-loader-screen">
            <RotateCw className="w-8 h-8 text-indigo-550 animate-spin" />
            <p className="text-xs text-slate-500 font-mono tracking-wide">Piping connection request to central dev proxy server...</p>
          </div>
        )}

        {!isLoading && !response && activeTab !== "code-snippet" && (
          <div className="flex flex-col items-center justify-center py-14 text-center space-y-2">
            <Database className="w-10 h-10 text-slate-800/80" />
            <span className="text-xs text-slate-500 leading-normal font-medium">Empty Transaction Stream</span>
            <p className="text-[11px] text-slate-600 max-w-xs">Enter a valid URL and click Send Request to begin parsing server content.</p>
          </div>
        )}

        {!isLoading && (
          <>
            {/* RESPONSE BODY TAB CONTENTS */}
            {activeTab === "body" && response && (
              <div className="space-y-3" id="response-body-view">
                {response.error && (
                  <div className="rounded-md border border-rose-900/60 bg-rose-950/20 p-3 text-xs text-rose-300">
                    {response.error}
                  </div>
                )}
                
                {/* 1. Image Viewer support for image proxy */}
                {typeof response.data === "string" && response.data.startsWith("data:image/") ? (
                  <div className="flex flex-col items-center p-4 border border-slate-900 rounded bg-slate-900/20 space-y-2">
                    <span className="text-[10px] font-sans font-bold text-indigo-400">Binary Image Payload Decoded</span>
                    <img 
                      src={response.data} 
                      alt="Proxy Decoded Result" 
                      className="max-h-64 object-contain rounded-md border border-slate-800 shadow-md"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  /* 2. Text/JSON Payload container */
                  <div className="relative">
                    <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/95 p-2 backdrop-blur">
                      <div className="flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-zinc-500" />
                        <input
                          value={bodySearch}
                          onChange={(event) => setBodySearch(event.target.value)}
                          placeholder="Search response"
                          className="w-48 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-cyan-600"
                        />
                        {bodySearch && (
                          <span className={`text-[10px] ${searchMatches ? "text-emerald-300" : "text-amber-300"}`}>
                            {searchMatches ? "match" : "no match"}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleCopyClipboard(responseBodyText)}
                        className="bg-zinc-900 text-[10px] text-zinc-300 hover:bg-zinc-800 transition-all font-semibold px-2 py-1 border border-zinc-800 rounded flex items-center gap-1 cursor-pointer"
                      >
                        {copied ? "Copied" : <><Copy className="w-2.5 h-2.5" /> Copy</>}
                      </button>
                    </div>

                    <pre className="w-full bg-slate-950/60 p-4 rounded-md border border-slate-900/50 font-mono text-xs text-indigo-300 overflow-x-auto whitespace-pre leading-relaxed select-text shadow-inner">
                      {responseBodyText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* HEADERS TAB CONTENTS */}
            {activeTab === "headers" && response && (
              <div className="relative space-y-3" id="response-headers-view">
                <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Server Response Headers ({Object.keys(response.headers).length})</span>
                </div>

                <div className="border border-slate-900 rounded overflow-hidden">
                  <table className="w-full text-xs font-mono text-slate-300">
                    <thead className="bg-slate-900/40 text-left text-slate-500 font-sans border-b border-slate-900">
                      <tr>
                        <th className="p-2 w-1/3">Key</th>
                        <th className="p-2">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/50">
                      {Object.entries(response.headers).map(([key, val]) => (
                        <tr key={key} className="hover:bg-slate-900/30">
                          <td className="p-2 font-bold text-indigo-400/90 break-all select-all">{key}</td>
                          <td className="p-2 text-slate-300 break-all select-all">{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* EXPLAIN TAB CONTENTS */}
            {activeTab === "ai-explain" && (
              <div className="space-y-3.5" id="response-ai-explain-view">
                <div className="flex select-none items-center justify-between border-b border-slate-900 pb-1.5">
                  <div className="flex items-center gap-1.5 text-purple-400 font-bold text-[11px] uppercase">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gemini API Debug Explanation</span>
                  </div>
                  {explainText && (
                    <button
                      onClick={handleExplainResponse}
                      className="text-[10px] text-slate-400 hover:text-slate-200 border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-2.5 h-2.5" /> Recalculate
                    </button>
                  )}
                </div>

                {explainLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-2">
                    <RotateCw className="w-5 h-5 text-purple-400 animate-spin" />
                    <span className="text-[11px] font-mono text-slate-500">Gemini models parsing variables & responses...</span>
                  </div>
                ) : explainError ? (
                  <div className="p-3 border border-rose-950/20 bg-rose-950/10 rounded-md text-rose-400 text-xs flex gap-2 items-center">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{explainError}</span>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none text-slate-350 bg-slate-900/10 border border-purple-950/25 p-4 rounded-md space-y-2">
                    {formatMarkdownToJSX(explainText)}
                  </div>
                )}
              </div>
            )}

            {/* TESTS KEY TAB CONTENTS */}
            {activeTab === "tests" && (
              <div className="space-y-3.5" id="response-tests-view">
                <div className="flex select-none items-center justify-between border-b border-slate-900 pb-1.5">
                  <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-[11px] uppercase">
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>Gemini Generated Unit Tests</span>
                  </div>
                  {testScriptText && (
                    <button
                      onClick={handleGenerateTests}
                      className="text-[10px] text-slate-400 hover:text-slate-200 border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-2.5 h-2.5" /> Regenerate
                    </button>
                  )}
                </div>

                {testScriptLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-2">
                    <RotateCw className="w-5 h-5 text-yellow-400 animate-spin" />
                    <span className="text-[11px] font-mono text-slate-500">Synthesizing testing scripts...</span>
                  </div>
                ) : testScriptError ? (
                  <div className="p-3 border border-rose-950/20 bg-rose-950/10 rounded-md text-rose-450 text-xs flex gap-2 items-center">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{testScriptError}</span>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        onClick={() => handleCopyClipboard(testScriptText)}
                        className="bg-slate-900 text-[10px] text-slate-350 hover:bg-slate-800 transition-all font-semibold px-2 py-1 border border-slate-850 rounded flex items-center gap-1 cursor-pointer"
                      >
                        {copied ? "Copied!" : <><Copy className="w-2.5 h-2.5" /> Copy Code</>}
                      </button>
                    </div>
                    <pre className="w-full bg-slate-950 p-4 rounded-md border border-slate-900 font-mono text-xs text-yellow-400 overflow-x-auto whitespace-pre-wrap leading-relaxed select-text shadow-inner">
                      {testScriptText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* GENERATE CODE SNIPPETS TAB CONTENTS */}
            {activeTab === "code-snippet" && (
              <div className="space-y-3.5" id="response-code-snippet-view">
                
                {/* Language selectors */}
                <div className="flex gap-1 border-b border-slate-900 pb-2.5 overflow-x-auto select-none">
                  {[
                    { id: "curl", name: "cURL" },
                    { id: "fetch", name: "Fetch (JS)" },
                    { id: "axios", name: "Axios (JS)" },
                    { id: "python", name: "Python (requests)" },
                    { id: "go", name: "Go Lang" }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSnippetLang(item.id as any)}
                      className={`px-3 py-1 cursor-pointer text-xs rounded transition-all font-semibold border ${
                        snippetLang === item.id 
                          ? "bg-indigo-950/20 text-indigo-400 border-indigo-900/60" 
                          : "text-slate-400 hover:text-slate-200 border-transparent"
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <div className="absolute top-2 right-2 z-10">
                    <button
                      onClick={() => handleCopyClipboard(snippetCode)}
                      className="bg-zinc-900 text-[10px] text-zinc-300 hover:bg-zinc-800 transition-all font-semibold px-2 py-1 border border-zinc-800 rounded flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? "Copied!" : <><Copy className="w-2.5 h-2.5" /> Copy Code</>}
                    </button>
                  </div>

                  <pre className="w-full bg-zinc-950/60 p-4 rounded-md border border-zinc-900 font-mono text-xs text-cyan-200 overflow-x-auto whitespace-pre-wrap leading-relaxed select-text shadow-inner">
                    {snippetCode || generateCodeSnippet(activeRequest, snippetLang)}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
