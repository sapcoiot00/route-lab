import React, { useState } from "react";
import { 
  Folder, 
  Trash2, 
  History, 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  Database,
  Zap,
  Clock
} from "lucide-react";
import { Collection, Environment, HistoryItem, RequestItem } from "../types";

interface HistorySidebarProps {
  collections: Collection[];
  environments: Environment[];
  history: HistoryItem[];
  activeEnvId: string;
  onSelectRequest: (request: RequestItem) => void;
  onAddCollection: (name: string) => void;
  onDeleteCollection: (id: string) => void;
  onAddRequestToCollection: (collectionId: string, name: string) => void;
  onDeleteRequestFromCollection: (collectionId: string, requestId: string) => void;
  
  onSelectEnv: (envId: string) => void;
  onAddEnv: (name: string) => void;
  onDeleteEnv: (id: string) => void;
  onUpdateEnvVars: (envId: string, vars: { key: string; value: string; enabled: boolean }[]) => void;
  
  onClearHistory: () => void;
}

export default function HistorySidebar({
  collections,
  environments,
  history,
  activeEnvId,
  onSelectRequest,
  onAddCollection,
  onDeleteCollection,
  onAddRequestToCollection,
  onDeleteRequestFromCollection,
  onSelectEnv,
  onAddEnv,
  onDeleteEnv,
  onUpdateEnvVars,
  onClearHistory,
}: HistorySidebarProps) {
  const [sidebarTab, setSidebarTab] = useState<"collections" | "history" | "environments">("collections");
  
  // Local form input state helper builders
  const [newCollName, setNewCollName] = useState("");
  const [showAddColl, setShowAddColl] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  
  const [newReqName, setNewReqName] = useState<Record<string, string>>({});
  const [expandedColl, setExpandedColl] = useState<Record<string, boolean>>({ "coll-placeholder": true });
  
  const [newEnvName, setNewEnvName] = useState("");
  const [showAddEnv, setShowAddEnv] = useState(false);

  const activeEnv = environments.find((e) => e.id === activeEnvId) || environments[0];
  const normalizedCollectionSearch = collectionSearch.trim().toLowerCase();
  const normalizedHistorySearch = historySearch.trim().toLowerCase();
  const visibleCollections = collections
    .map((collection) => ({
      ...collection,
      requests: normalizedCollectionSearch
        ? collection.requests.filter((request) =>
            `${request.name} ${request.method} ${request.url}`.toLowerCase().includes(normalizedCollectionSearch)
          )
        : collection.requests,
    }))
    .filter((collection) =>
      !normalizedCollectionSearch ||
      collection.name.toLowerCase().includes(normalizedCollectionSearch) ||
      collection.requests.length > 0
    );
  const visibleHistory = history.filter((log) =>
    normalizedHistorySearch
      ? `${log.method} ${log.status} ${log.url}`.toLowerCase().includes(normalizedHistorySearch)
      : true
  );

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollName.trim()) return;
    onAddCollection(newCollName.trim());
    setNewCollName("");
    setShowAddColl(false);
  };

  const handleCreateEnv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnvName.trim()) return;
    onAddEnv(newEnvName.trim());
    setNewEnvName("");
    setShowAddEnv(false);
  };

  const handleAddRequest = (collId: string) => {
    const name = newReqName[collId] || "";
    if (!name.trim()) return;
    onAddRequestToCollection(collId, name.trim());
    setNewReqName(prev => ({ ...prev, [collId]: "" }));
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-emerald-400 bg-emerald-950/45 border-emerald-900";
    if (status >= 300 && status < 400) return "text-sky-400 bg-sky-950/45 border-sky-900";
    if (status >= 400 && status < 500) return "text-amber-400 bg-amber-950/45 border-amber-900";
    if (status >= 500) return "text-rose-400 bg-rose-950/45 border-rose-900";
    return "text-slate-400 bg-slate-900/40 border-slate-800";
  };

  const getMethodBadge = (m: string) => {
    const methods: Record<string, string> = {
      GET: "text-emerald-400 font-bold text-[10px]",
      POST: "text-amber-400 font-bold text-[10px]",
      PUT: "text-blue-400 font-bold text-[10px]",
      DELETE: "text-rose-400 font-bold text-[10px]",
      PATCH: "text-purple-400 font-bold text-[10px]",
      HEAD: "text-orange-300 font-bold text-[10px]",
      OPTIONS: "text-teal-400 font-bold text-[10px]"
    };
    return methods[m] || "text-slate-400 font-bold text-[10px]";
  };

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950 text-zinc-300 font-sans select-none" id="sidebar-main">
      {/* Sidebar Navigation Tabs */}
      <div className="flex border-b border-zinc-900 p-1.5 gap-1 bg-zinc-900/25" id="sidebar-tabs">
        <button
          onClick={() => setSidebarTab("collections")}
          className={`flex-1 py-1 px-1.5 text-[11px] rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 ${
            sidebarTab === "collections" 
              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/5 backdrop-blur-md" 
              : "text-slate-400 hover:text-slate-250 hover:bg-slate-800/20"
          }`}
          id="tab-collections"
        >
          <Folder className="w-3 h-3" />
          Collections
        </button>
        <button
          onClick={() => setSidebarTab("history")}
          className={`flex-1 py-1 px-1.5 text-[11px] rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 ${
            sidebarTab === "history" 
              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/5 backdrop-blur-md" 
              : "text-slate-400 hover:text-slate-250 hover:bg-slate-800/20"
          }`}
          id="tab-history"
        >
          <History className="w-3 h-3" />
          History
        </button>
        <button
          onClick={() => setSidebarTab("environments")}
          className={`flex-1 py-1 px-1.5 text-[11px] rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 ${
            sidebarTab === "environments" 
              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/5 backdrop-blur-md" 
              : "text-slate-400 hover:text-slate-250 hover:bg-slate-800/20"
          }`}
          id="tab-environments"
        >
          <Database className="w-3 h-3" />
          Variables
        </button>
      </div>

      {/* Main Tab Area */}
      <div className="flex-1 overflow-y-auto p-2.5" id="sidebar-content">
        
        {/* COLLECTIONS ACTIVE TAB */}
        {sidebarTab === "collections" && (
          <div className="space-y-3" id="collections-view">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-cyan-300/80">Client Collections</h3>
              <button 
                onClick={() => setShowAddColl(!showAddColl)}
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
                title="Create New Folder"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <input
                value={collectionSearch}
                onChange={(event) => setCollectionSearch(event.target.value)}
                placeholder="Search collections"
                className="w-full rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-cyan-600"
              />
            </div>

            {showAddColl && (
              <form onSubmit={handleCreateCollection} className="p-2.5 bg-slate-900/60 border border-slate-800/80 rounded-md space-y-2 backdrop-blur-md">
                <input
                  type="text"
                  placeholder="Collection Name..."
                  value={newCollName}
                  onChange={(e) => setNewCollName(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 bg-slate-950/60 border border-slate-850 rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
                <div className="flex justify-end gap-1.5 text-[10px]">
                  <button 
                    type="button" 
                    onClick={() => setShowAddColl(false)}
                    className="px-2 py-1 cursor-pointer hover:bg-slate-800 rounded text-slate-400"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-2.5 py-1 cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium shadow-sm transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            {visibleCollections.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No matching collections. Click + to add a new folder.
              </div>
            ) : (
              <div className="space-y-2" id="collections-list">
                {visibleCollections.map((coll) => {
                  const isExpanded = expandedColl[coll.id];
                  return (
                     <div key={coll.id} className="border border-zinc-900 rounded-md overflow-hidden bg-zinc-950/40">
                      {/* Collection Folder Header */}
                      <div className="flex items-center justify-between p-1.5 bg-zinc-900/45 hover:bg-zinc-900/70 transition-colors">
                        <button
                          onClick={() => setExpandedColl(prev => ({ ...prev, [coll.id]: !isExpanded }))}
                          className="flex items-center gap-1.5 justify-start text-left flex-1 font-semibold text-xs text-slate-350"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <Folder className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="truncate max-w-[130px]">{coll.name}</span>
                        </button>

                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => {
                              const name = prompt("Enter Request Name:");
                              if (name?.trim()) onAddRequestToCollection(coll.id, name.trim());
                            }}
                            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                            title="Add Request"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onDeleteCollection(coll.id)}
                            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-450"
                            title="Delete Collection"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Collection Requests Sub-List */}
                      {isExpanded && (
                        <div className="p-1.5 space-y-1 bg-slate-950/20 border-t border-slate-900/50">
                          {coll.requests.length === 0 ? (
                            <div className="text-[11px] text-slate-500 py-2.5 px-6 italic">No requests. Click + to add.</div>
                          ) : (
                            coll.requests.map((req) => (
                              <div 
                                key={req.id} 
                                className="group flex items-center justify-between p-1.5 rounded hover:bg-slate-800/50 cursor-pointer text-xs"
                              >
                                <button
                                  onClick={() => onSelectRequest(req)}
                                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                                >
                                  <span className={`w-8 shrink-0 font-bold text-[10px] text-right uppercase ${getMethodBadge(req.method)}`}>
                                    {req.method}
                                  </span>
                                  <span className="truncate max-w-[140px] text-slate-450 text-[11px] font-medium leading-none group-hover:text-white transition-colors">
                                    {req.name}
                                  </span>
                                </button>
                                
                                <button
                                  onClick={() => onDeleteRequestFromCollection(coll.id, req.id)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-700/60 text-slate-500 hover:text-rose-400 transition-all duration-150"
                                  title="Delete Request"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* HISTORY ACTIVE TAB */}
        {sidebarTab === "history" && (
          <div className="space-y-3" id="history-view">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Proxy History</h3>
              {history.length > 0 && (
                <button 
                  onClick={onClearHistory}
                  className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors font-medium flex items-center gap-1 border border-rose-950 px-1.5 py-0.5 rounded bg-rose-950/20"
                >
                  <Trash2 className="w-3 h-3" /> Clear Logs
                </button>
              )}
            </div>
            <input
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder="Search history by URL, method, status"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-cyan-600"
            />

            {visibleHistory.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <Clock className="w-6 h-6 text-slate-700 mx-auto" />
                <p className="text-xs text-slate-500">No matching history yet. Send a request to populate this timeline.</p>
              </div>
            ) : (
              <div className="space-y-1.5" id="history-list">
                {visibleHistory.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => onSelectRequest(log.requestDetails)}
                    className="flex flex-col p-2 border border-slate-800/80 bg-slate-950/40 hover:bg-slate-800/40 rounded-md cursor-pointer transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${getMethodBadge(log.method)} bg-slate-900 border border-slate-800`}>
                          {log.method}
                        </span>
                        <span className={`text-[9px] px-1 py-0.2 border rounded-md font-bold leading-normal ${getStatusColor(log.status)}`}>
                          {log.status || "FAIL"}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500">
                        {log.responseTimeMs}ms
                      </span>
                    </div>

                    <div className="text-[11px] font-mono break-all text-slate-300 leading-normal line-clamp-2">
                      {log.url}
                    </div>

                    <div className="text-[9px] text-slate-500 text-right">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ENVIRONMENTS ACTIVE TAB */}
        {sidebarTab === "environments" && (
          <div className="space-y-3" id="environments-view">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-cyan-300/80">Client Variables</h3>
              <button 
                onClick={() => setShowAddEnv(!showAddEnv)}
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
                title="Create New variable profile"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {showAddEnv && (
              <form onSubmit={handleCreateEnv} className="p-2.5 bg-slate-900/60 border border-slate-800/80 rounded-md space-y-2 backdrop-blur-md">
                <input
                  type="text"
                  placeholder="Profile Name (e.g., Prod environment)..."
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 bg-slate-950/60 border border-slate-850 rounded text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500/50"
                />
                <div className="flex justify-end gap-1.5 text-[10px]">
                  <button 
                    type="button" 
                    onClick={() => setShowAddEnv(false)}
                    className="px-2 py-1 cursor-pointer hover:bg-slate-800 rounded text-slate-400"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-2.5 py-1 cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium shadow-sm transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            {/* Environment Profiler */}
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Active Variable Profile</label>
                <select
                  value={activeEnvId}
                  onChange={(e) => onSelectEnv(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 bg-slate-950/60 border border-slate-900/80 rounded-md text-slate-350 focus:outline-none focus:border-indigo-500/50"
                >
                  {environments.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                {environments.length > 1 && (
                  <button
                    onClick={() => onDeleteEnv(activeEnvId)}
                    className="text-[10px] text-rose-400 hover:text-rose-300 mt-1 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Remove profile
                  </button>
                )}
              </div>

              {/* Current Variables List Table */}
              <div className="p-3 border border-slate-900 bg-slate-950/20 backdrop-blur-md rounded-md space-y-3">
                <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                  <span className="text-[11px] font-bold text-slate-400">Settings: {activeEnv?.name}</span>
                  <button
                    onClick={() => {
                      const updated = [...(activeEnv?.variables || [])];
                      updated.push({ key: "new_var", value: "value", enabled: true });
                      onUpdateEnvVars(activeEnvId, updated);
                    }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3 h-3" /> Add Row
                  </button>
                </div>

                {(activeEnv?.variables || []).length === 0 ? (
                  <div className="text-[10px] text-slate-500 italic text-center py-2">
                    No variables. Add a row to substitute variables like <code className="text-indigo-400/80 font-mono">{"{{baseUrl}}"}</code>.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {(activeEnv?.variables || []).map((v, idx) => (
                      <div key={idx} className="flex gap-1.5 items-center">
                        <input
                          type="checkbox"
                          checked={v.enabled}
                          onChange={(e) => {
                            const updated = [...(activeEnv.variables)];
                            updated[idx] = { ...updated[idx], enabled: e.target.checked };
                            onUpdateEnvVars(activeEnvId, updated);
                          }}
                          className="rounded border-slate-800 bg-slate-950 text-indigo-500 focus:ring-0"
                        />
                        <input
                          type="text"
                          value={v.key}
                          placeholder="key"
                          onChange={(e) => {
                            const updated = [...(activeEnv.variables)];
                            updated[idx] = { ...updated[idx], key: e.target.value };
                            onUpdateEnvVars(activeEnvId, updated);
                          }}
                          className="flex-1 w-1/2 text-[11px] font-mono px-1.5 py-1 bg-slate-950 border border-slate-900 rounded placeholder-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500/40"
                        />
                        <input
                          type="text"
                          value={v.value}
                          placeholder="value"
                          onChange={(e) => {
                            const updated = [...(activeEnv.variables)];
                            updated[idx] = { ...updated[idx], value: e.target.value };
                            onUpdateEnvVars(activeEnvId, updated);
                          }}
                          className="flex-1 w-1/2 text-[11px] font-mono px-1.5 py-1 bg-slate-950 border border-slate-900 rounded placeholder-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500/40"
                        />
                        <button
                          onClick={() => {
                            const updated = (activeEnv.variables || []).filter((_, i) => i !== idx);
                            onUpdateEnvVars(activeEnvId, updated);
                          }}
                          className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-all duration-150"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-slate-500 mt-2 bg-slate-950/50 p-2 border border-slate-900 rounded">
                  <div className="flex gap-1 text-indigo-400 font-bold mb-0.5 items-center">
                    <Zap className="w-3 h-3 shrink-0 text-indigo-400" /> Variable Syntax Guide
                  </div>
                  Define secrets or endpoints, then use <code className="text-yellow-400 font-mono">{"{{variable}}"}</code> in URLs or request payloads.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
