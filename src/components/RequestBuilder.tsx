import React, { useState, useEffect } from "react";
import { 
  Play, 
  Plus, 
  Trash2, 
  Sparkles, 
  RefreshCcw, 
  CheckCircle,
  CodeXml,
  Lightbulb
} from "lucide-react";
import { RequestItem, HeaderParamPair } from "../types";

interface RequestBuilderProps {
  request: RequestItem;
  onChangeRequest: (updated: RequestItem) => void;
  onSendRequest: () => void;
  isLoading: boolean;
}

export default function RequestBuilder({
  request,
  onChangeRequest,
  onSendRequest,
  isLoading,
}: RequestBuilderProps) {
  const [activeTab, setActiveTab] = useState<"params" | "headers" | "body" | "ai-docs">("params");
  const [aiPromptInput, setAiPromptInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const updateField = <K extends keyof RequestItem>(field: K, value: RequestItem[K]) => {
    onChangeRequest({
      ...request,
      [field]: value,
    });
  };

  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateField("method", e.target.value as any);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateField("url", e.target.value);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateField("name", e.target.value);
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && request.url.trim() && !isLoading) {
        event.preventDefault();
        onSendRequest();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isLoading, onSendRequest, request.url]);

  // 1. Param actions helper
  const handleAddParam = () => {
    const updated = [...request.params, { key: "", value: "", enabled: true }];
    updateField("params", updated);
  };

  const handleUpdateParam = (index: number, field: keyof HeaderParamPair, val: any) => {
    const updated = [...request.params];
    updated[index] = { ...updated[index], [field]: val };
    updateField("params", updated);
  };

  const handleRemoveParam = (index: number) => {
    const updated = request.params.filter((_, idx) => idx !== index);
    updateField("params", updated);
  };

  // 2. Header actions helper
  const handleAddHeader = () => {
    const updated = [...request.headers, { key: "", value: "", enabled: true }];
    updateField("headers", updated);
  };

  const handleUpdateHeader = (index: number, field: keyof HeaderParamPair, val: any) => {
    const updated = [...request.headers];
    updated[index] = { ...updated[index], [field]: val };
    updateField("headers", updated);
  };

  const handleRemoveHeader = (index: number) => {
    const updated = request.headers.filter((_, idx) => idx !== index);
    updateField("headers", updated);
  };

  // 3. Body actions
  const handleBodyTypeChange = (type: RequestItem["bodyType"]) => {
    const needsJsonHeader =
      type === "json" && !request.headers.some((h) => h.key.toLowerCase() === "content-type");

    onChangeRequest({
      ...request,
      bodyType: type,
      headers: needsJsonHeader
        ? [...request.headers, { key: "Content-Type", value: "application/json", enabled: true }]
        : request.headers,
    });
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateField("body", e.target.value);
  };

  // Format active raw JSON body
  const handleFormatJSON = () => {
    try {
      const parsed = JSON.parse(request.body);
      updateField("body", JSON.stringify(parsed, null, 2));
    } catch (err) {
      alert("Invalid JSON format. Please ensure content is valid before formatting.");
    }
  };

  // 4. AISmart payload generator
  const handleAiGeneratePayload = async () => {
    if (!aiPromptInput.trim()) {
      setAiError("Please type a payload description (e.g., 'User registration fields')");
      return;
    }
    setAiLoading(true);
    setAiError("");

    try {
      const response = await fetch("/api/ai/suggest-body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPromptInput.trim(),
          url: request.url,
          method: request.method,
        }),
      });

      if (!response.ok) {
        throw new Error("Local backend model returned " + response.status);
      }

      const result = await response.json();
      if (result.success && result.body) {
        updateField("body", result.body);
        setAiPromptInput("");
        handleBodyTypeChange("json");
      } else {
        throw new Error(result.error || "No response received");
      }
    } catch (error: any) {
      setAiError(error.message || "Failed to contact Gemini key agent");
    } finally {
      setAiLoading(false);
    }
  };

  const getMethodColorClass = (method: string) => {
    switch (method) {
      case "GET": return "bg-emerald-600/30 text-emerald-400 border-emerald-500/50 hover:bg-emerald-600/40";
      case "POST": return "bg-amber-600/30 text-amber-400 border-amber-500/50 hover:bg-amber-600/40";
      case "PUT": return "bg-blue-600/30 text-blue-400 border-blue-500/50 hover:bg-blue-600/40";
      case "DELETE": return "bg-rose-600/30 text-rose-400 border-rose-500/50 hover:bg-rose-600/40";
      case "PATCH": return "bg-purple-600/30 text-purple-400 border-purple-500/50 hover:bg-purple-600/40";
      default: return "bg-slate-700/60 text-slate-300 border-slate-600 hover:bg-slate-700";
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-zinc-950 p-3 font-sans space-y-3" id="request-builder-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="rounded border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-300">
            Client Request
          </span>
          <input
            type="text"
            value={request.name}
            onChange={handleNameChange}
            className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-semibold text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:border-cyan-600"
            placeholder="Request name"
          />
        </div>
        <span className="hidden rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[9px] text-zinc-500 md:inline">
          Ctrl Enter
        </span>
      </div>
      
      {/* 1. Interactive URL Bar Row */}
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center" id="url-bar-container">
        
        {/* Method selector */}
        <select
          value={request.method}
          onChange={handleMethodChange}
          className={`px-2.5 py-2 text-xs font-bold uppercase cursor-pointer rounded-md border text-center transition-all focus:ring-1 focus:ring-indigo-500/20 focus:outline-none shrink-0 ${getMethodColorClass(request.method)}`}
          id="request-method-select"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>

        {/* URL and dynamic variables field */}
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            placeholder="Enter request URL (e.g. https://api.endpoint.com or {{placeholder_url}}/todos/1)"
            value={request.url}
            onChange={handleUrlChange}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 font-mono text-xs text-zinc-100 placeholder-zinc-600 transition-all focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
            id="request-url-input"
          />
        </div>

        {/* Sending execution action */}
        <button
          onClick={onSendRequest}
          disabled={isLoading || !request.url.trim()}
          className="flex items-center justify-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-950/20 transition-all active:scale-95 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500 hover:bg-cyan-500"
          id="send-request-btn"
        >
          {isLoading ? (
            <>
              <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
            <span>Send</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Sub-tab Selection */}
      <div className="flex items-center justify-between border-b border-zinc-900" id="builder-tabs">
        <div className="flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab("params")}
            className={`py-1.5 px-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 leading-none ${
              activeTab === "params"
                ? "border-indigo-400 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
            id="tab-params"
          >
            Params
            {request.params.filter((p) => p.enabled && p.key).length > 0 && (
              <span className="bg-slate-900 border border-slate-800 text-[10px] text-slate-400 px-1.5 py-0.2 rounded-full font-mono">
                {request.params.filter((p) => p.enabled && p.key).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("headers")}
            className={`py-1.5 px-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 leading-none ${
              activeTab === "headers"
                ? "border-indigo-400 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
            id="tab-headers"
          >
            Headers
            {request.headers.filter((h) => h.enabled && h.key).length > 0 && (
              <span className="bg-slate-900 border border-slate-800 text-[10px] text-slate-400 px-1.5 py-0.2 rounded-full font-mono">
                {request.headers.filter((h) => h.enabled && h.key).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("body")}
            className={`py-1.5 px-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 leading-none ${
              activeTab === "body"
                ? "border-indigo-400 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
            id="tab-body"
          >
            Body
            {request.bodyType !== "none" && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("ai-docs")}
            className={`py-1.5 px-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 leading-none ${
              activeTab === "ai-docs"
                ? "border-purple-400 text-purple-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
            id="tab-ai-docs"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            AI Client Docs
          </button>
        </div>

        <span className="text-[10px] text-slate-500 font-mono pr-2 truncate max-w-[150px] md:max-w-xs">
          Local draft
        </span>
      </div>

      {/* 3. Tab Contents Layout */}
      <div className="bg-zinc-950/60 p-3 border border-zinc-900 rounded-md min-h-[132px]" id="builder-tab-container">
        
        {/* PARAMS TAB */}
        {activeTab === "params" && (
          <div className="space-y-3" id="params-content-area">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-400 font-medium">Query Parameters (appended to URL as <code className="text-yellow-550 font-mono">?key=value</code>)</span>
              <button
                onClick={handleAddParam}
                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 border border-indigo-950 bg-indigo-950/20 px-2.5 py-1 rounded cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>

            {request.params.length === 0 ? (
              <div className="text-xs text-slate-500 italic text-center py-6">
                No custom parameters appended. Click Add Row to submit API parameters.
              </div>
            ) : (
              <div className="space-y-2">
                {request.params.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => handleUpdateParam(idx, "enabled", e.target.checked)}
                      className="rounded border-slate-900 bg-slate-950 text-indigo-500 focus:ring-0"
                    />
                    <input
                      type="text"
                      placeholder="key"
                      value={item.key}
                      onChange={(e) => handleUpdateParam(idx, "key", e.target.value)}
                      className="flex-1 text-xs px-2.5 py-1.5 bg-slate-950/40 border border-slate-900 rounded placeholder-slate-700 text-slate-200 focus:outline-none focus:border-indigo-505/45 font-mono"
                    />
                    <span className="text-slate-650 text-xs">=</span>
                    <input
                      type="text"
                      placeholder="value"
                      value={item.value}
                      onChange={(e) => handleUpdateParam(idx, "value", e.target.value)}
                      className="flex-1 text-xs px-2.5 py-1.5 bg-slate-950/40 border border-slate-900 rounded placeholder-slate-700 text-slate-200 focus:outline-none focus:border-indigo-505/45 font-mono"
                    />
                    <button
                      onClick={() => handleRemoveParam(idx)}
                      className="text-slate-650 hover:text-rose-450 p-1 cursor-pointer transition-colors"
                      title="Delete parameter row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HEADERS TAB */}
        {activeTab === "headers" && (
          <div className="space-y-3" id="headers-content-area">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-400 font-medium">Custom Client Request Headers</span>
              <button
                onClick={handleAddHeader}
                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 border border-indigo-950 bg-indigo-950/20 px-2.5 py-1 rounded cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>

            {request.headers.length === 0 ? (
              <div className="text-xs text-slate-500 italic text-center py-6">
                No headers set. Click Add Row to configure metadata parameters or authorization tokens.
              </div>
            ) : (
              <div className="space-y-2">
                {request.headers.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => handleUpdateHeader(idx, "enabled", e.target.checked)}
                      className="rounded border-slate-900 bg-slate-950 text-indigo-500 focus:ring-0"
                    />
                    <input
                      type="text"
                      placeholder="Header Name (e.g. Authorization)"
                      value={item.key}
                      onChange={(e) => handleUpdateHeader(idx, "key", e.target.value)}
                      className="flex-1 text-xs px-2.5 py-1.5 bg-slate-950/40 border border-slate-900 rounded placeholder-slate-700 text-slate-200 focus:outline-none focus:border-indigo-505/45 font-mono"
                    />
                    <span className="text-slate-650 text-xs">:</span>
                    <input
                      type="text"
                      placeholder="Value (e.g. Bearer token_secret)"
                      value={item.value}
                      onChange={(e) => handleUpdateHeader(idx, "value", e.target.value)}
                      className="flex-1 text-xs px-2.5 py-1.5 bg-slate-950/40 border border-slate-900 rounded placeholder-slate-700 text-slate-200 focus:outline-none focus:border-indigo-505/45 font-mono"
                    />
                    <button
                      onClick={() => handleRemoveHeader(idx)}
                      className="text-slate-650 hover:text-rose-455 p-1 cursor-pointer transition-colors"
                      title="Delete header row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BODY TAB */}
        {activeTab === "body" && (
          <div className="space-y-3" id="body-content-area">
            {/* Body Type Selection */}
            <div className="flex items-center gap-5 border-b border-slate-900 pb-2.5">
              <span className="text-[11px] text-slate-400 font-medium shrink-0">Body Format:</span>
              <div className="flex gap-4 text-xs font-medium">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-350 select-none">
                  <input
                    type="radio"
                    name="bodyType"
                    checked={request.bodyType === "none"}
                    onChange={() => handleBodyTypeChange("none")}
                    className="text-indigo-605 focus:ring-0 bg-slate-950 border-slate-800"
                  />
                  none
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-355 select-none">
                  <input
                    type="radio"
                    name="bodyType"
                    checked={request.bodyType === "json"}
                    onChange={() => handleBodyTypeChange("json")}
                    className="text-indigo-605 focus:ring-0 bg-slate-950 border-slate-800"
                  />
                  JSON (application/json)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-355 select-none">
                  <input
                    type="radio"
                    name="bodyType"
                    checked={request.bodyType === "text"}
                    onChange={() => handleBodyTypeChange("text")}
                    className="text-indigo-605 focus:ring-0 bg-slate-950 border-slate-800"
                  />
                  Raw Text
                </label>
              </div>
            </div>

            {request.bodyType === "none" && (
              <div className="text-center py-8 text-slate-500 text-xs italic">
                Active method has empty payload body. Change body format above to transmit arguments.
              </div>
            )}

            {request.bodyType !== "none" && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                
                {/* Visual Editor Textbox */}
                <div className="md:col-span-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Input Stream Payload</span>
                    {request.bodyType === "json" && (
                      <button
                        onClick={handleFormatJSON}
                        className="text-[10px] font-bold text-indigo-400 border border-indigo-950/60 bg-indigo-950/20 px-2 py-0.5 rounded hover:bg-indigo-950/40 cursor-pointer transition-colors"
                      >
                        Auto-Format JSON
                      </button>
                    )}
                  </div>
                  <textarea
                    value={request.body || ""}
                    onChange={handleBodyChange}
                    placeholder={
                      request.bodyType === "json" 
                        ? '{\n  "key": "value"\n}' 
                        : "Type raw text parameters here..."
                    }
                    className="w-full h-40 bg-slate-950/60 border border-slate-900 text-xs px-3 py-2.5 rounded font-mono text-indigo-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 leading-relaxed resize-y transition-all"
                  />
                </div>

                {/* Gemini AI Payload Creator Module */}
                <div className="md:col-span-2 border border-purple-950/30 bg-purple-950/15 backdrop-blur-md rounded-md p-3.5 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-purple-450 fill-purple-400/20" />
                      <span>Copilot JSON Payload Generator</span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 leading-normal">
                      Instruct the Gemini API to formulate beautiful JSON structures matching your variables.
                    </p>
                    <textarea
                      placeholder="e.g., 'A fake user with username, token, bio, and nested arrays for tags'"
                      value={aiPromptInput}
                      onChange={(e) => setAiPromptInput(e.target.value)}
                      className="w-full text-[11px] h-20 bg-slate-950/70 border border-slate-900 p-2 rounded text-slate-200 placeholder-slate-650 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-500/25 resize-none transition-all"
                    />
                  </div>

                  {aiError && (
                    <div className="text-[10px] text-rose-450 bg-rose-950/20 border border-rose-900/40 p-1.5 rounded">
                      {aiError}
                    </div>
                  )}

                  <button
                    onClick={handleAiGeneratePayload}
                    disabled={aiLoading}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 text-xs bg-purple-705 hover:bg-purple-600 text-white rounded font-bold cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed border border-purple-550/20 transition-all shadow-lg shadow-purple-950/25"
                  >
                    {aiLoading ? (
                      <>
                        <RefreshCcw className="w-3 h-3 animate-spin" />
                        <span>Crafting JSON...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-purple-200 fill-white/10" />
                        <span>AI Generate Payload</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}
          </div>
        )}

        {/* AI DOCS TAB */}
        {activeTab === "ai-docs" && (
          <div className="space-y-3" id="ai-docs-content-area">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-xs border-b border-slate-900 pb-1.5">
              <CodeXml className="w-4 h-4" />
              <span>Smart API Instruction Manual Launcher</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                <div className="flex gap-2 items-start text-[11.5px] leading-relaxed text-slate-350">
                  <Lightbulb className="w-4 h-4 text-emerald-450 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-200 block">How are Variables substituted?</span>
                    When executing, any key with <code className="text-indigo-400 bg-indigo-950/30 px-1 rounded">{"{{key}}"}</code> is dynamically evaluated against settings. Try defining <code className="text-indigo-400 bg-indigo-950/30 px-1 rounded">{"{{placeholder_url}}"}</code> and using it in paths.
                  </div>
                </div>
                <div className="flex gap-2 items-start text-[11.5px] leading-relaxed text-slate-350">
                  <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-200 block">Is CORS bypassed?</span>
                    Yes! All requests enter our server-side secure Node.js client first, ignoring strict browser sandbox restrictions. You can communicate with any URL under localhost or external secure networks.
                  </div>
                </div>
              </div>

              <div className="p-3 border border-slate-900 rounded bg-slate-950/50 flex flex-col justify-between">
                <div className="text-[11px] leading-normal space-y-1.5">
                  <span className="font-bold text-slate-300 block">Common Testing Profiles available:</span>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400 font-sans">
                    <li><strong className="text-slate-350">GET</strong> comments for postId filters</li>
                    <li><strong className="text-slate-350">POST</strong> simulated JSON payloads</li>
                    <li><strong className="text-slate-350">GET</strong> dog breeder lists and image sources</li>
                  </ul>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 font-mono">
                  Press the main "Send Request" trigger to execute transactions in real time.
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
