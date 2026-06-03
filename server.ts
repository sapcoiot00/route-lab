import express from "express";
import fs from "fs/promises";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const AUTH_COOKIE = "api_workbench_session";
const OAUTH_STATE_COOKIE = "api_workbench_oauth_state";

type Role = "owner" | "editor" | "viewer";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
}

interface ProjectMember extends UserProfile {
  role: Role;
}

interface WorkspaceProject {
  id: string;
  name: string;
  ownerId: string;
  members: ProjectMember[];
  collections: any[];
  environments: any[];
  activeEnvId: string;
  updatedAt: string;
  createdAt: string;
}

const sessions = new Map<string, UserProfile>();

// Increase request payload limit for proxying large requests
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function getBaseUrl(req: express.Request) {
  const configured = process.env.APP_URL;
  if (configured && configured !== "MY_APP_URL") return configured.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

function parseCookies(req: express.Request): Record<string, string> {
  const cookieHeader = req.headers.cookie || "";
  return cookieHeader.split(";").reduce<Record<string, string>>((cookies, part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) return cookies;
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

function setCookie(res: express.Response, name: string, value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`);
}

function clearCookie(res: express.Response, name: string) {
  res.append("Set-Cookie", `${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function getCurrentUser(req: express.Request): UserProfile | null {
  const sessionId = parseCookies(req)[AUTH_COOKIE];
  return sessionId ? sessions.get(sessionId) || null : null;
}

function requireUser(req: express.Request, res: express.Response): UserProfile | null {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in with Google to continue." });
    return null;
  }
  return user;
}

async function readProjects(): Promise<WorkspaceProject[]> {
  try {
    return JSON.parse(await fs.readFile(PROJECTS_FILE, "utf8"));
  } catch (error: any) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeProjects(projects: WorkspaceProject[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

function canEdit(project: WorkspaceProject, user: UserProfile) {
  return project.members.some((member) =>
    (member.id === user.id || member.email.toLowerCase() === user.email.toLowerCase()) &&
    (member.role === "owner" || member.role === "editor")
  );
}

function canView(project: WorkspaceProject, user: UserProfile) {
  return project.members.some((member) =>
    member.id === user.id || member.email.toLowerCase() === user.email.toLowerCase()
  );
}

function stripUnsafeProject(project: WorkspaceProject) {
  return project;
}

function hydratePendingMembership(project: WorkspaceProject, user: UserProfile) {
  const member = project.members.find((entry) => entry.email.toLowerCase() === user.email.toLowerCase());
  if (member && member.id.startsWith("pending:")) {
    member.id = user.id;
    member.name = user.name;
    member.picture = user.picture;
  }
}

app.get("/api/auth/me", (req, res) => {
  res.json({ user: getCurrentUser(req) });
});

app.get("/api/auth/google/start", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send("GOOGLE_CLIENT_ID is not configured.");
  }

  const state = crypto.randomBytes(16).toString("hex");
  setCookie(res, OAUTH_STATE_COOKIE, state, 600);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${getBaseUrl(req)}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get("/api/auth/google/callback", async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const { code, state } = req.query;
  const savedState = parseCookies(req)[OAUTH_STATE_COOKIE];

  if (!clientId || !clientSecret) {
    return res.status(500).send("Google OAuth credentials are not configured.");
  }

  if (!code || typeof code !== "string" || !state || state !== savedState) {
    return res.status(400).send("Invalid Google OAuth callback state.");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${getBaseUrl(req)}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Google token exchange failed with ${tokenResponse.status}`);
    }

    const tokenJson: any = await tokenResponse.json();
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });

    if (!profileResponse.ok) {
      throw new Error(`Google profile lookup failed with ${profileResponse.status}`);
    }

    const profile: any = await profileResponse.json();
    const user: UserProfile = {
      id: profile.sub,
      email: profile.email,
      name: profile.name || profile.email,
      picture: profile.picture || "",
    };
    const sessionId = crypto.randomBytes(24).toString("hex");
    sessions.set(sessionId, user);
    clearCookie(res, OAUTH_STATE_COOKIE);
    setCookie(res, AUTH_COOKIE, sessionId, 60 * 60 * 24 * 14);
    res.redirect("/");
  } catch (error: any) {
    res.status(500).send(error.message || "Google sign-in failed.");
  }
});

app.post("/api/auth/logout", (req, res) => {
  const sessionId = parseCookies(req)[AUTH_COOKIE];
  if (sessionId) sessions.delete(sessionId);
  clearCookie(res, AUTH_COOKIE);
  res.json({ ok: true });
});

app.get("/api/projects", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const projects = await readProjects();
  let changed = false;
  projects.forEach((project) => {
    const before = JSON.stringify(project.members);
    hydratePendingMembership(project, user);
    if (before !== JSON.stringify(project.members)) changed = true;
  });
  if (changed) await writeProjects(projects);
  const visibleProjects = projects.filter((project) => canView(project, user)).map(stripUnsafeProject);
  res.json({ projects: visibleProjects });
});

app.post("/api/projects", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const now = new Date().toISOString();
  const project: WorkspaceProject = {
    id: makeId("proj"),
    name: String(req.body.name || "Untitled Project").trim() || "Untitled Project",
    ownerId: user.id,
    members: [{ ...user, role: "owner" }],
    collections: Array.isArray(req.body.collections) ? req.body.collections : [],
    environments: Array.isArray(req.body.environments) ? req.body.environments : [],
    activeEnvId: typeof req.body.activeEnvId === "string" ? req.body.activeEnvId : "",
    createdAt: now,
    updatedAt: now,
  };

  const projects = await readProjects();
  projects.push(project);
  await writeProjects(projects);
  res.status(201).json({ project });
});

app.put("/api/projects/:projectId", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const projects = await readProjects();
  const projectIndex = projects.findIndex((project) => project.id === req.params.projectId);
  const project = projects[projectIndex];

  if (!project || !canView(project, user)) {
    return res.status(404).json({ error: "Project not found." });
  }
  if (!canEdit(project, user)) {
    return res.status(403).json({ error: "You need editor access to update this project." });
  }

  projects[projectIndex] = {
    ...project,
    name: typeof req.body.name === "string" && req.body.name.trim() ? req.body.name.trim() : project.name,
    collections: Array.isArray(req.body.collections) ? req.body.collections : project.collections,
    environments: Array.isArray(req.body.environments) ? req.body.environments : project.environments,
    activeEnvId: typeof req.body.activeEnvId === "string" ? req.body.activeEnvId : project.activeEnvId,
    updatedAt: new Date().toISOString(),
  };

  await writeProjects(projects);
  res.json({ project: projects[projectIndex] });
});

app.post("/api/projects/:projectId/members", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const email = String(req.body.email || "").trim().toLowerCase();
  const role: Role = req.body.role === "viewer" ? "viewer" : "editor";
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "A valid teammate email is required." });
  }

  const projects = await readProjects();
  const projectIndex = projects.findIndex((project) => project.id === req.params.projectId);
  const project = projects[projectIndex];
  if (!project || !canView(project, user)) {
    return res.status(404).json({ error: "Project not found." });
  }
  if (!project.members.some((member) =>
    (member.id === user.id || member.email.toLowerCase() === user.email.toLowerCase()) && member.role === "owner"
  )) {
    return res.status(403).json({ error: "Only project owners can invite teammates." });
  }

  const existingMember = project.members.find((member) => member.email.toLowerCase() === email);
  if (existingMember) {
    existingMember.role = existingMember.role === "owner" ? "owner" : role;
  } else {
    project.members.push({
      id: `pending:${email}`,
      email,
      name: email,
      picture: "",
      role,
    });
  }
  project.updatedAt = new Date().toISOString();

  await writeProjects(projects);
  res.json({ project });
});

// Lazy init for Google Gen AI as specified by guidelines
let genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured. Please add it to your environment secrets.");
    }
    genAI = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAI;
}

// 1. API Request Proxy Endpoint to bypass browser CORS restrictions
app.post("/api/proxy", async (req, res) => {
  const { url, method, headers, body } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required for proxying." });
  }

  // Ensure absolute URL
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return res.status(400).json({ success: false, error: "URL must start with http:// or https://" });
  }

  const startTime = Date.now();

  try {
    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: headers || {},
    };

    // Body forwarding for non-GET requests
    if (body !== undefined && body !== null && method !== "GET" && method !== "HEAD") {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;

    // Read response content carefully
    const contentType = response.headers.get("content-type") || "";
    let responseData: any;
    let byteLength = 0;

    if (contentType.includes("application/json")) {
      const text = await response.text();
      byteLength = Buffer.byteLength(text, "utf8");
      try {
        responseData = JSON.parse(text);
      } catch (e) {
        responseData = text;
      }
    } else if (contentType.includes("image/")) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      byteLength = buffer.length;
      responseData = `data:${contentType};base64,${buffer.toString("base64")}`;
    } else {
      const text = await response.text();
      byteLength = Buffer.byteLength(text, "utf8");
      responseData = text;
    }

    // Format headers to send back to client
    const respHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      respHeaders[key] = val;
    });

    res.json({
      success: true,
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
      data: responseData,
      responseTimeMs: duration,
      size: byteLength,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    res.json({
      success: false,
      error: error.message || "Failed to establish API connection",
      responseTimeMs: duration,
      status: 0,
      statusText: "Error",
      headers: {},
      data: null,
      size: 0,
    });
  }
});

// 2. AI endpoints for Postman interactive workflow
app.post("/api/ai/suggest-body", async (req, res) => {
  const { prompt, url, method } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Instruction prompt is required" });
  }

  try {
    const ai = getGenAI();
    const systemPrompt = `You are an expert backend engineer and API architect. Generate a highly realistic JSON payload based on the user's instructions. Keep it clean and valid JSON.
The request context is:
Target URL: ${url || "Not specified"}
HTTP Method: ${method || "POST"}

Provide ONLY the valid JSON string. Do not include markdown wraps (like \`\`\`json) or extra conversational words. Return only the JSON content.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
      },
    });

    const text = response.text || "";
    // Sanitize in case model included markdown backticks anyway
    let cleanText = text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }

    res.json({ success: true, body: cleanText });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "AI payload generation failed" });
  }
});

app.post("/api/ai/explain-response", async (req, res) => {
  const { responseData, statusCode, statusText, url, method } = req.body;

  try {
    const ai = getGenAI();
    const contents = `Analyze and explain this REST API Response.
Request Details:
- Method: ${method || "GET"}
- URL: ${url}

Response Status: ${statusCode} (${statusText})
Body Context:
${typeof responseData === "object" ? JSON.stringify(responseData, null, 2) : String(responseData || "").slice(0, 5000)}

Provide:
1. A summary of what this response contains/registers.
2. An assessment of whether it succeeded or failed, and what the status code implies.
3. Highlight any critical or useful fields in the payload.
4. Suggestions for next API steps or debugging (if error).
Keep your formatting strictly structured with bullet points. Do not mention system-internal files or paths.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: "You are an API debug assistant. Help the developer comprehend and inspect API values instantly.",
        temperature: 0.2,
      },
    });

    res.json({ success: true, explanation: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "AI explanation failed" });
  }
});

app.post("/api/ai/generate-code", async (req, res) => {
  const { url, method, headers, body, language } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required for code generation" });
  }

  const targetLang = language || "javascript";

  try {
    const ai = getGenAI();
    const contents = `Generate a code snippet to perform an HTTP request using the specified details:
Language/Library: ${targetLang}
HTTP Method: ${method || "GET"}
URL: ${url}
Headers: ${JSON.stringify(headers || {})}
Body: ${typeof body === "string" ? body : JSON.stringify(body || "")}

Provide ONLY the code snippet. Make it clean, readable, and properly formatted. Don't add markdown wrap, just return the raw string containing the code itself.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: "You are a code snippet generator. Provide clean, copy-pasteable, error-free API execution code. No wrappers, no intro, no outro, just the exact code.",
        temperature: 0.1,
      },
    });

    res.json({ success: true, code: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "AI code generation failed" });
  }
});

app.post("/api/ai/generate-test", async (req, res) => {
  const { url, method, reqBody, resStatus, resBody } = req.body;

  try {
    const ai = getGenAI();
    const contents = `Create API test assertions based on this transaction.
Request: ${method || "GET"} ${url}
Request Body: ${typeof reqBody === "object" ? JSON.stringify(reqBody) : String(reqBody || "")}
Response Status: ${resStatus || 200}
Response Body: ${typeof resBody === "object" ? JSON.stringify(resBody) : String(resBody || "")}

Please write 3 - 5 clean, standard assertion statements validating high-value keys, status code compliance, or structure.
Format the output as a clean code snippet (e.g. using Jest/Supertest or standard Chai/Postman-style assertions). Provide only the clean test script.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: "You are an automated API testing framework. Output elegant, useful, error-free test script assertions.",
        temperature: 0.1,
      },
    });

    res.json({ success: true, testScript: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "AI test generation failed" });
  }
});

// 3. Vite development vs statically served production middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Proxy Server] Postman Backend running on port ${PORT}`);
  });
}

startServer();
