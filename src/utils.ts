import { Collection, Environment, HeaderParamPair, RequestItem } from "./types";

export const STORAGE_KEYS = {
  collections: "postman_clone_collections",
  environments: "postman_clone_environments",
  activeEnvId: "postman_clone_active_env_id",
  history: "postman_clone_history",
} as const;

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

// Dynamic search and replace for environment variables e.g. {{baseUrl}}/api
export function resolveVariables(
  text: string,
  variables: { key: string; value: string; enabled: boolean }[]
): string {
  if (!text) return "";
  let resolved = text;
  variables.forEach((variable) => {
    if (variable.enabled && variable.key.trim() !== "") {
      const placeholder = `{{${variable.key.trim()}}}`;
      resolved = resolved.replaceAll(placeholder, variable.value);
    }
  });
  return resolved;
}

export function buildFinalUrl(url: string, params: HeaderParamPair[]): string {
  if (!url.trim()) return "";

  const activeParams = params.filter((param) => param.enabled && param.key.trim());
  if (activeParams.length === 0) return url.trim();

  const queryString = activeParams
    .map((param) => `${encodeURIComponent(param.key.trim())}=${encodeURIComponent(param.value.trim())}`)
    .join("&");

  return `${url.trim()}${url.includes("?") ? "&" : "?"}${queryString}`;
}

export function buildHeaderObject(
  headers: HeaderParamPair[],
  variables: HeaderParamPair[]
): Record<string, string> {
  return headers
    .filter((header) => header.enabled && header.key.trim())
    .reduce<Record<string, string>>((result, header) => {
      result[header.key.trim()] = resolveVariables(header.value, variables);
      return result;
    }, {});
}

// Convert bytes to human readable format
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatJson(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function createDefaultRequest(name = "Untitled request"): RequestItem {
  return {
    id: createId("req"),
    name,
    method: "GET",
    url: "{{placeholder_url}}/todos/1",
    headers: [{ key: "Accept", value: "application/json", enabled: true }],
    params: [],
    bodyType: "none",
    body: "",
  };
}

export function generateCodeSnippet(
  request: RequestItem,
  language: "curl" | "fetch" | "axios" | "python" | "go"
): string {
  const headers = request.headers.filter((header) => header.enabled && header.key.trim());
  const body = request.bodyType !== "none" && request.body.trim() ? request.body : "";
  const url = buildFinalUrl(request.url, request.params);

  if (language === "curl") {
    const headerFlags = headers.map((header) => `  -H "${header.key}: ${header.value}"`).join(" \\\n");
    const bodyFlag = body ? ` \\\n  --data '${body.replaceAll("'", "'\\''")}'` : "";
    return [`curl -X ${request.method} "${url}"`, headerFlags, bodyFlag].filter(Boolean).join(" \\\n");
  }

  if (language === "python") {
    const headerObject = Object.fromEntries(headers.map((header) => [header.key, header.value]));
    return `import requests

response = requests.request(
    "${request.method}",
    "${url}",
    headers=${JSON.stringify(headerObject, null, 4)},
    ${body ? `data='''${body}''',` : ""}
)

print(response.status_code)
print(response.text)`;
  }

  if (language === "axios") {
    return `import axios from "axios";

const response = await axios.request({
  method: "${request.method}",
  url: "${url}",
  headers: ${JSON.stringify(Object.fromEntries(headers.map((header) => [header.key, header.value])), null, 2)},
  ${body ? `data: ${JSON.stringify(body)},` : ""}
});

console.log(response.data);`;
  }

  if (language === "go") {
    return `package main

import (
  "fmt"
  "io"
  "net/http"
  "strings"
)

func main() {
  body := strings.NewReader(${JSON.stringify(body)})
  req, _ := http.NewRequest("${request.method}", "${url}", body)
${headers.map((header) => `  req.Header.Set("${header.key}", "${header.value}")`).join("\n")}

  res, err := http.DefaultClient.Do(req)
  if err != nil {
    panic(err)
  }
  defer res.Body.Close()

  data, _ := io.ReadAll(res.Body)
  fmt.Println(res.Status)
  fmt.Println(string(data))
}`;
  }

  return `const response = await fetch("${url}", {
  method: "${request.method}",
  headers: ${JSON.stringify(Object.fromEntries(headers.map((header) => [header.key, header.value])), null, 2)},
  ${body ? `body: ${JSON.stringify(body)},` : ""}
});

const data = await response.json();
console.log(data);`;
}

// Quick initial static data prepopulation for immediate usability
export const INITIAL_COLLECTIONS: Collection[] = [
  {
    id: "coll-placeholder",
    name: "JSONPlaceholder Specs",
    requests: [
      {
        id: "req-jsonplaceholder-get-todo",
        name: "GET Fetch Single Todo",
        method: "GET",
        url: "{{placeholder_url}}/todos/1",
        headers: [
          { key: "Accept", value: "application/json", enabled: true }
        ],
        params: [],
        bodyType: "none",
        body: ""
      },
      {
        id: "req-jsonplaceholder-post-todo",
        name: "POST Create New Post",
        method: "POST",
        url: "{{placeholder_url}}/posts",
        headers: [
          { key: "Content-Type", value: "application/json", enabled: true }
        ],
        params: [],
        bodyType: "json",
        body: JSON.stringify({
          title: "Building API Tool",
          body: "Bypassing cors via backend developer client proxy.",
          userId: 1
        }, null, 2)
      },
      {
        id: "req-jsonplaceholder-get-comments",
        name: "GET Filter Comments (Params)",
        method: "GET",
        url: "{{placeholder_url}}/comments",
        headers: [],
        params: [
          { key: "postId", value: "1", enabled: true }
        ],
        bodyType: "none",
        body: ""
      }
    ]
  },
  {
    id: "coll-dog-api",
    name: "Dog Breed Image Hub",
    requests: [
      {
        id: "req-dog-random",
        name: "GET Retrieve Random Breed Image",
        method: "GET",
        url: "https://dog.ceo/api/breeds/image/random",
        headers: [{ key: "Accept", value: "application/json", enabled: true }],
        params: [],
        bodyType: "none",
        body: ""
      }
    ]
  },
  {
    id: "coll-httpbin",
    name: "HTTP Testing Tool Suite",
    requests: [
      {
        id: "req-httpbin-get-ip",
        name: "GET Request Client IP Information",
        method: "GET",
        url: "https://httpbin.org/ip",
        headers: [],
        params: [],
        bodyType: "none",
        body: ""
      },
      {
        id: "req-httpbin-status",
        name: "GET Inspect Status Codes",
        method: "GET",
        url: "https://httpbin.org/status/204",
        headers: [],
        params: [],
        bodyType: "none",
        body: ""
      }
    ]
  }
];

// Seed basic environments variables for high end-user convenience
export const INITIAL_ENVIRONMENTS: Environment[] = [
  {
    id: "env-development",
    name: "Default Sandbox Workspace",
    variables: [
      { key: "placeholder_url", value: "https://jsonplaceholder.typicode.com", enabled: true },
      { key: "api_key", value: "sandbox_token_secret_12345", enabled: true }
    ]
  }
];
