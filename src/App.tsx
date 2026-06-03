import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  GripHorizontal,
  GripVertical,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
  Server,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import HistorySidebar from "./components/HistorySidebar";
import RequestBuilder from "./components/RequestBuilder";
import ResponseViewer from "./components/ResponseViewer";
import { Collection, Environment, HistoryItem, RequestItem, ResponseState, UserProfile, WorkspaceProject } from "./types";
import {
  buildFinalUrl,
  buildHeaderObject,
  createDefaultRequest,
  createId,
  INITIAL_COLLECTIONS,
  INITIAL_ENVIRONMENTS,
  readStorage,
  resolveVariables,
  STORAGE_KEYS,
} from "./utils";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 420;
const REQUEST_MIN_HEIGHT = 118;
const REQUEST_DEFAULT_HEIGHT = 288;
const REQUEST_MAX_HEIGHT = 390;
const LAYOUT_STORAGE_KEYS = {
  sidebarWidth: "api_workbench_sidebar_width",
  requestHeight: "api_workbench_request_height",
} as const;

export default function App() {
  const [collections, setCollections] = useState<Collection[]>(() =>
    readStorage(STORAGE_KEYS.collections, INITIAL_COLLECTIONS)
  );
  const [environments, setEnvironments] = useState<Environment[]>(() =>
    readStorage(STORAGE_KEYS.environments, INITIAL_ENVIRONMENTS)
  );
  const [activeEnvId, setActiveEnvId] = useState(() =>
    readStorage(STORAGE_KEYS.activeEnvId, INITIAL_ENVIRONMENTS[0].id)
  );
  const [history, setHistory] = useState<HistoryItem[]>(() =>
    readStorage(STORAGE_KEYS.history, [])
  );
  const [activeRequest, setActiveRequest] = useState<RequestItem>(() =>
    createDefaultRequest("New draft request")
  );
  const [activeResponse, setActiveResponse] = useState<ResponseState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [projectLoading, setProjectLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRequestOpen, setIsRequestOpen] = useState(true);
  const [isResponseOpen, setIsResponseOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clamp(readStorage(LAYOUT_STORAGE_KEYS.sidebarWidth, SIDEBAR_DEFAULT_WIDTH), SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH)
  );
  const [requestHeight, setRequestHeight] = useState(() =>
    clamp(readStorage(LAYOUT_STORAGE_KEYS.requestHeight, REQUEST_DEFAULT_HEIGHT), REQUEST_MIN_HEIGHT, REQUEST_MAX_HEIGHT)
  );
  const [activeResize, setActiveResize] = useState<"sidebar" | "vertical" | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((payload) => {
        if (alive) setCurrentUser(payload.user || null);
      })
      .catch(() => {
        if (alive) setCurrentUser(null);
      })
      .finally(() => {
        if (alive) setAuthLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setProjects([]);
      setActiveProjectId("");
      return;
    }

    let alive = true;
    setProjectLoading(true);
    fetch("/api/projects")
      .then((response) => response.json())
      .then((payload) => {
        if (!alive) return;
        const nextProjects: WorkspaceProject[] = payload.projects || [];
        setProjects(nextProjects);
        if (nextProjects.length > 0) {
          setActiveProjectId((current) =>
            nextProjects.some((project) => project.id === current) ? current : nextProjects[0].id
          );
        }
      })
      .finally(() => {
        if (alive) setProjectLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [currentUser]);

  useEffect(() => {
    const activeProject = projects.find((project) => project.id === activeProjectId);
    if (!activeProject) return;

    setCollections(activeProject.collections);
    setEnvironments(activeProject.environments.length ? activeProject.environments : INITIAL_ENVIRONMENTS);
    setActiveEnvId(activeProject.activeEnvId || activeProject.environments[0]?.id || INITIAL_ENVIRONMENTS[0].id);
    setActiveResponse(null);
  }, [activeProjectId, projects]);

  useEffect(() => {
    if (!currentUser || !activeProjectId || projectLoading) return;

    const timeout = window.setTimeout(async () => {
      await fetch(`/api/projects/${activeProjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collections, environments, activeEnvId }),
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [activeEnvId, activeProjectId, collections, currentUser, environments, projectLoading]);

  useEffect(() => {
    if (currentUser || authLoading) return;
    localStorage.setItem(STORAGE_KEYS.collections, JSON.stringify(collections));
  }, [authLoading, collections, currentUser]);

  useEffect(() => {
    if (currentUser || authLoading) return;
    localStorage.setItem(STORAGE_KEYS.environments, JSON.stringify(environments));
  }, [authLoading, currentUser, environments]);

  useEffect(() => {
    if (currentUser || authLoading) return;
    localStorage.setItem(STORAGE_KEYS.activeEnvId, JSON.stringify(activeEnvId));
  }, [activeEnvId, authLoading, currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEYS.sidebarWidth, JSON.stringify(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEYS.requestHeight, JSON.stringify(requestHeight));
  }, [requestHeight]);

  useEffect(() => {
    if (!activeResize) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (activeResize === "sidebar") {
        setSidebarWidth(clamp(event.clientX, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH));
        return;
      }

      const bounds = workspaceRef.current?.getBoundingClientRect();
      if (!bounds) return;
      setRequestHeight(clamp(event.clientY - bounds.top, REQUEST_MIN_HEIGHT, bounds.height - 168));
    };

    const handlePointerUp = () => setActiveResize(null);
    document.body.classList.add("is-resizing");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.classList.remove("is-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeResize]);

  const selectedEnv = useMemo(
    () => environments.find((env) => env.id === activeEnvId) || environments[0],
    [activeEnvId, environments]
  );
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [activeProjectId, projects]
  );
  const currentMember = activeProject?.members.find((member) =>
    currentUser && (member.id === currentUser.id || member.email.toLowerCase() === currentUser.email.toLowerCase())
  );
  const activeVariables = selectedEnv?.variables || [];
  const requestCount = collections.reduce((sum, collection) => sum + collection.requests.length, 0);
  const isSavedRequest = collections.some((collection) =>
    collection.requests.some((request) => request.id === activeRequest.id)
  );

  const handleSelectRequest = (request: RequestItem) => {
    setActiveRequest({ ...request });
    setActiveResponse(null);
  };

  const handleAddCollection = (name: string) => {
    setCollections((prev) => [...prev, { id: createId("coll"), name, requests: [] }]);
  };

  const handleDeleteCollection = (id: string) => {
    setCollections((prev) => prev.filter((collection) => collection.id !== id));
  };

  const handleAddRequestToCollection = (collectionId: string, name: string) => {
    const freshRequest = createDefaultRequest(name);
    setCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId
          ? { ...collection, requests: [...collection.requests, freshRequest] }
          : collection
      )
    );
    setActiveRequest(freshRequest);
    setActiveResponse(null);
  };

  const handleDeleteRequestFromCollection = (collectionId: string, requestId: string) => {
    setCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId
          ? { ...collection, requests: collection.requests.filter((request) => request.id !== requestId) }
          : collection
      )
    );

    if (activeRequest.id === requestId) {
      setActiveRequest(createDefaultRequest("New draft request"));
      setActiveResponse(null);
    }
  };

  const handleSaveRequest = () => {
    setCollections((prev) => {
      const exists = prev.some((collection) =>
        collection.requests.some((request) => request.id === activeRequest.id)
      );

      if (exists) {
        return prev.map((collection) => ({
          ...collection,
          requests: collection.requests.map((request) =>
            request.id === activeRequest.id ? { ...activeRequest } : request
          ),
        }));
      }

      if (prev.length === 0) {
        return [{ id: createId("coll"), name: "My API Workspace", requests: [{ ...activeRequest }] }];
      }

      return prev.map((collection, index) =>
        index === 0 ? { ...collection, requests: [{ ...activeRequest }, ...collection.requests] } : collection
      );
    });

    setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  };

  const handleNewDraft = () => {
    setActiveRequest(createDefaultRequest("New draft request"));
    setActiveResponse(null);
  };

  const handleExportWorkspace = () => {
    const payload = JSON.stringify({ collections, environments }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "api-workspace.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateProject = async () => {
    const name = prompt("Project name:");
    if (!name?.trim()) return;

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        collections,
        environments,
        activeEnvId,
      }),
    });
    if (!response.ok) return;
    const payload = await response.json();
    setProjects((prev) => [payload.project, ...prev]);
    setActiveProjectId(payload.project.id);
  };

  const handleInviteMember = async () => {
    if (!activeProject || !inviteEmail.trim()) return;

    const response = await fetch(`/api/projects/${activeProject.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: "editor" }),
    });
    if (!response.ok) return;
    const payload = await response.json();
    setProjects((prev) => prev.map((project) => (project.id === payload.project.id ? payload.project : project)));
    setInviteEmail("");
    setShowInvite(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setProjects([]);
    setActiveProjectId("");
    window.location.reload();
  };

  const handleAddEnv = (name: string) => {
    const newEnv: Environment = { id: createId("env"), name, variables: [] };
    setEnvironments((prev) => [...prev, newEnv]);
    setActiveEnvId(newEnv.id);
  };

  const handleDeleteEnv = (id: string) => {
    if (environments.length <= 1) return;
    setEnvironments((prev) => prev.filter((env) => env.id !== id));
    setActiveEnvId(environments.find((env) => env.id !== id)?.id || "");
  };

  const handleUpdateEnvVars = (envId: string, vars: Environment["variables"]) => {
    setEnvironments((prev) =>
      prev.map((env) => (env.id === envId ? { ...env, variables: vars } : env))
    );
  };

  const handleSendRequest = async () => {
    setIsLoading(true);
    setActiveResponse(null);

    const finalUrl = resolveVariables(buildFinalUrl(activeRequest.url, activeRequest.params), activeVariables);
    const finalHeaders = buildHeaderObject(activeRequest.headers, activeVariables);
    const finalBody = activeRequest.bodyType !== "none"
      ? resolveVariables(activeRequest.body, activeVariables)
      : undefined;

    try {
      const proxyResponse = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: finalUrl,
          method: activeRequest.method,
          headers: finalHeaders,
          body: finalBody,
        }),
      });

      if (!proxyResponse.ok) {
        throw new Error(`Proxy service returned ${proxyResponse.status}. Check the target URL or local server.`);
      }

      const responseState: ResponseState = await proxyResponse.json();
      setActiveResponse(responseState);

      setHistory((prev) => [
        {
          id: createId("hist"),
          timestamp: new Date().toISOString(),
          method: activeRequest.method,
          url: activeRequest.url,
          status: responseState.status,
          responseTimeMs: responseState.responseTimeMs,
          success: responseState.success,
          requestDetails: { ...activeRequest },
        },
        ...prev,
      ].slice(0, 75));
    } catch (error: any) {
      setActiveResponse({
        success: false,
        status: 0,
        statusText: "Error",
        headers: {},
        data: null,
        responseTimeMs: 0,
        size: 0,
        error: error.message || "Failed to contact the target server.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100 font-sans select-none" id="applet-viewport">
      <header className="relative z-10 flex items-center justify-between px-4 py-2 glass-header" id="header-bar">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-500/10 p-1.5 text-cyan-300 shadow-sm" id="brand-logo">
            <Zap className="h-4 w-4 fill-current text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold uppercase tracking-wider text-zinc-100 font-display">API Workbench</h1>
              <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
                CLIENT
              </span>
            </div>
            <p className="text-[10px] font-medium text-zinc-500">Browser client for composing and inspecting API calls</p>
          </div>
        </div>

        <div className="flex items-center gap-2" id="header-tools">
          <div className="hidden items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200 lg:flex">
            <Server className="h-3.5 w-3.5" />
            Backend Proxy
            <span className="font-mono text-amber-100/70">/api/proxy</span>
          </div>
          {currentUser ? (
            <div className="hidden items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1 md:flex">
              <Users className="h-3.5 w-3.5 text-cyan-300" />
              <select
                value={activeProjectId}
                onChange={(event) => setActiveProjectId(event.target.value)}
                className="max-w-[150px] bg-transparent text-[11px] font-semibold text-zinc-200 outline-none"
                disabled={projectLoading || projects.length === 0}
              >
                {projects.length === 0 ? (
                  <option value="">No projects</option>
                ) : (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))
                )}
              </select>
              <button
                onClick={handleCreateProject}
                className="rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/15"
              >
                New Project
              </button>
              {activeProject && currentMember?.role === "owner" && (
                <button
                  onClick={() => setShowInvite((current) => !current)}
                  className="flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300 hover:text-cyan-200"
                >
                  <UserPlus className="h-3 w-3" />
                  Invite
                </button>
              )}
            </div>
          ) : (
            <a
              href="/api/auth/google/start"
              className="hidden rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/15 md:inline-flex"
            >
              Sign in with Google
            </a>
          )}
          <button
            onClick={handleNewDraft}
            className="hidden items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-zinc-300 hover:border-cyan-700 hover:text-cyan-200 sm:flex"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
          <button
            onClick={handleSaveRequest}
            className="flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/15"
          >
            <Save className="h-3.5 w-3.5" />
            {isSavedRequest ? "Update" : "Save"}
          </button>
          <button
            onClick={handleExportWorkspace}
            className="hidden items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white md:flex"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <div className="hidden items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1 backdrop-blur-md lg:flex">
            <Database className="h-3.5 w-3.5 text-zinc-400" />
            <span className="mr-1.5 text-[11px] font-medium text-zinc-400">Variables:</span>
            <span className="max-w-[150px] truncate font-mono text-[10.5px] text-cyan-300">
              {selectedEnv ? `${selectedEnv.name} (${selectedEnv.variables.length})` : "None"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Ready
          </div>
          {currentUser && (
            <button
              onClick={handleLogout}
              className="hidden items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300 hover:text-white sm:flex"
              title={currentUser.email}
            >
              {currentUser.picture ? (
                <img src={currentUser.picture} alt="" className="h-4 w-4 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="h-4 w-4 rounded-full bg-cyan-500/20" />
              )}
              Logout
            </button>
          )}
        </div>
      </header>

      {showInvite && activeProject && (
        <div className="relative z-10 flex items-center justify-end gap-2 border-b border-zinc-900 bg-zinc-950 px-4 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Invite editor to {activeProject.name}
          </span>
          <input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="teammate@example.com"
            className="w-56 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 outline-none focus:border-cyan-600"
          />
          <button
            onClick={handleInviteMember}
            className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/15"
          >
            Add
          </button>
        </div>
      )}

      <main className="relative z-10 flex w-full flex-1 overflow-hidden bg-zinc-950" id="workspace-main">
        {isSidebarOpen && (
          <>
            <div style={{ width: sidebarWidth }} className="min-w-[220px] max-w-[420px] shrink-0">
              <HistorySidebar
                collections={collections}
                environments={environments}
                history={history}
                activeEnvId={activeEnvId}
                onSelectRequest={handleSelectRequest}
                onAddCollection={handleAddCollection}
                onDeleteCollection={handleDeleteCollection}
                onAddRequestToCollection={handleAddRequestToCollection}
                onDeleteRequestFromCollection={handleDeleteRequestFromCollection}
                onSelectEnv={setActiveEnvId}
                onAddEnv={handleAddEnv}
                onDeleteEnv={handleDeleteEnv}
                onUpdateEnvVars={handleUpdateEnvVars}
                onClearHistory={() => setHistory([])}
              />
            </div>
            <button
              type="button"
              aria-label="Resize sidebar"
              title="Drag to resize sidebar"
              onPointerDown={(event) => {
                event.preventDefault();
                setActiveResize("sidebar");
              }}
              className="group flex w-2 shrink-0 cursor-col-resize items-center justify-center border-r border-zinc-900 bg-zinc-950 hover:bg-cyan-950/30"
            >
              <GripVertical className="h-4 w-4 text-zinc-700 group-hover:text-cyan-300" />
            </button>
          </>
        )}

        <div ref={workspaceRef} className="flex min-w-0 flex-1 flex-col overflow-hidden" id="workspace-viewer-stream">
          <div className="flex items-center justify-between border-b border-zinc-900 bg-zinc-950/95 px-2.5 py-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSidebarOpen((current) => !current)}
                className="icon-button"
                title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsRequestOpen((current) => !current)}
                className="icon-button"
                title={isRequestOpen ? "Collapse request builder" : "Expand request builder"}
              >
                {isRequestOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsResponseOpen((current) => !current)}
                className="icon-button"
                title={isResponseOpen ? "Collapse response viewer" : "Expand response viewer"}
              >
                {isResponseOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>
            <div className="hidden items-center gap-2 text-[10px] font-medium uppercase tracking-wide md:flex">
              <span className="flex items-center gap-1 text-cyan-300/80">
                <Monitor className="h-3 w-3" />
                Client Workspace
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="flex items-center gap-1 text-amber-300/80">
                <Server className="h-3 w-3" />
                Backend Proxy
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="text-zinc-500">{isSidebarOpen ? `${sidebarWidth}px nav` : "nav hidden"}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="text-zinc-500">{isRequestOpen && isResponseOpen ? `${requestHeight}px composer` : "single pane"}</span>
            </div>
          </div>

          {isRequestOpen ? (
            <section
              className="min-h-[118px] overflow-y-auto"
              style={{ height: isResponseOpen ? requestHeight : "100%" }}
            >
              <RequestBuilder
                request={activeRequest}
                onChangeRequest={setActiveRequest}
                onSendRequest={handleSendRequest}
                isLoading={isLoading}
              />
            </section>
          ) : (
            <button
              type="button"
              onClick={() => setIsRequestOpen(true)}
              className="flex items-center justify-between border-b border-zinc-900 bg-zinc-950 px-4 py-2 text-left text-xs font-semibold text-zinc-400 hover:text-cyan-200"
            >
              <span>Request builder collapsed</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          {isRequestOpen && isResponseOpen && (
            <button
              type="button"
              aria-label="Resize request and response panels"
              title="Drag to resize request and response panels"
              onPointerDown={(event) => {
                event.preventDefault();
                setActiveResize("vertical");
              }}
              className="group flex h-2 shrink-0 cursor-row-resize items-center justify-center border-y border-zinc-900 bg-zinc-950 hover:bg-cyan-950/30"
            >
              <GripHorizontal className="h-4 w-4 text-zinc-700 group-hover:text-cyan-300" />
            </button>
          )}

          {isResponseOpen ? (
            <section className="min-h-[168px] flex-1 overflow-hidden">
              <ResponseViewer response={activeResponse} activeRequest={activeRequest} isLoading={isLoading} />
            </section>
          ) : (
            <button
              type="button"
              onClick={() => setIsResponseOpen(true)}
              className="flex items-center justify-between border-t border-zinc-900 bg-zinc-950 px-4 py-2 text-left text-xs font-semibold text-zinc-400 hover:text-cyan-200"
            >
              <span>Response viewer collapsed</span>
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-between border-t border-zinc-900 bg-zinc-950 px-4 py-1 text-[9.5px] font-medium text-zinc-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Client online
          </div>
          <div className="flex items-center gap-1.5 text-amber-300/80">
            <Server className="h-3 w-3" />
            Backend proxy: port 3000
          </div>
          <div className="flex items-center gap-1.5">
            <Database className="h-3 w-3 text-zinc-500" />
            {requestCount} saved requests
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastSavedAt && <span className="text-zinc-500">Saved {lastSavedAt}</span>}
          <span className="text-cyan-300/80">v2.0</span>
        </div>
      </footer>
    </div>
  );
}
