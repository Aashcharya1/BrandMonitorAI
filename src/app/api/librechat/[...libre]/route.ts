"use server";

import { NextRequest, NextResponse } from "next/server";

const LIBRECHAT_URL = process.env.LIBRECHAT_URL || "http://localhost:3080";

export async function GET(req: NextRequest, ctx: { params: { libre: string[] } }) {
  const { libre } = await ctx.params;
  return proxy(req, libre.join("/"));
}

export async function POST(req: NextRequest, ctx: { params: { libre: string[] } }) {
  const { libre } = await ctx.params;
  return proxy(req, libre.join("/"));
}

async function proxy(req: NextRequest, path: string) {
  try {
    const url = `${LIBRECHAT_URL}/api/${path}`;
    const backendUrl = process.env.NEXT_PUBLIC_MONITOR_API_URL || "http://localhost:8000";
    const tokenEndpoint = `${backendUrl}/api/v1/librechat/token`;
    const healthEndpoint = `${backendUrl}/health`;
    
    let token: string;
    
    // First, check if backend is available
    try {
      const healthController = new AbortController();
      const healthTimeout = setTimeout(() => healthController.abort(), 3000);
      
      const healthRes = await fetch(healthEndpoint, {
        signal: healthController.signal,
      });
      
      clearTimeout(healthTimeout);
      
      if (!healthRes.ok) {
        console.warn(`Backend health check failed: ${healthRes.status}`);
      }
    } catch (healthError) {
      console.error("Backend health check failed:", healthError);
      return NextResponse.json(
        { 
          error: "Backend unavailable", 
          message: `Cannot connect to backend service at ${backendUrl}. Please ensure:\n1. The backend server is running (check Terminal 5)\n2. Run: cd orchestration-backend/api && python main.py\n3. Verify: http://localhost:8000/health`,
          troubleshooting: "See README.md section 'Running the Application' for setup instructions"
        },
        { status: 503 }
      );
    }
    
    // Try to get token from backend
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      // Create timeout controller
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const tokenRes = await fetch(tokenEndpoint, {
        headers: {
          cookie: req.headers.get("cookie") || "",
        },
        signal: controller.signal,
      });
      
      if (timeoutId) clearTimeout(timeoutId);
      
      if (!tokenRes.ok) {
        const errorText = await tokenRes.text().catch(() => "");
        console.error(`Token endpoint failed: ${tokenRes.status} - ${errorText}`);
        
        if (tokenRes.status === 404) {
          // Verify the endpoint exists by checking backend routes
          let verificationInfo = "";
          try {
            const verifyController = new AbortController();
            const verifyTimeout = setTimeout(() => verifyController.abort(), 2000);
            const verifyRes = await fetch(`${backendUrl}/docs`, { signal: verifyController.signal });
            clearTimeout(verifyTimeout);
            if (verifyRes.ok) {
              verificationInfo = `\n\nTo verify the endpoint exists, check: ${backendUrl}/docs (Swagger UI)`;
            }
          } catch {
            // Ignore verification errors
          }
          
          return NextResponse.json(
            { 
              error: "Endpoint not found", 
              message: `The /api/v1/librechat/token endpoint was not found (404).\n\n**Solution:** Restart your backend server:\n\n1. Stop the current backend (Ctrl+C in the terminal where it's running)\n2. Navigate to: cd orchestration-backend/api\n3. Activate virtual environment: .\\venv\\Scripts\\activate (Windows) or source venv/bin/activate (Linux/Mac)\n4. Start the server: python main.py\n   OR: uvicorn main:app --host 0.0.0.0 --port 8000 --reload\n5. Wait for "Application startup complete" message\n6. Verify endpoint: ${backendUrl}/api/v1/librechat/token${verificationInfo}`,
              details: errorText || "Endpoint may not be registered. Backend needs restart to load updated code.",
              backend_url: backendUrl,
              endpoint_url: tokenEndpoint
            },
            { status: 404 }
          );
        }
        
        // In development, provide a fallback token if backend is not available
        if (process.env.NODE_ENV === "development" && tokenRes.status === 500) {
          console.warn("Backend token endpoint unavailable, using development fallback");
          // Generate a simple fallback token for development
          // Note: This may not work with LibreChat if it validates tokens
          token = process.env.DEV_LIBRECHAT_TOKEN || "dev-token-fallback";
        } else {
          return NextResponse.json(
            { 
              error: "Unauthorized", 
              message: `Failed to get authentication token from backend (${tokenRes.status}). Please ensure the backend service is running at ${backendUrl}`,
              details: errorText || "Backend service may be unavailable"
            },
            { status: 401 }
          );
        }
      } else {
        try {
          const tokenData = await tokenRes.json();
          token = tokenData.token;
          if (!token) {
            throw new Error("Token not found in response");
          }
        } catch (error) {
          console.error("Failed to parse token response:", error);
          return NextResponse.json(
            { error: "Invalid token response", message: "Failed to parse authentication token from backend" },
            { status: 500 }
          );
        }
      }
    } catch (fetchError) {
      if (timeoutId) clearTimeout(timeoutId);
      
      // Handle network errors (backend not reachable)
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("Token endpoint timeout");
        return NextResponse.json(
          { 
            error: "Backend timeout", 
            message: `Backend service at ${backendUrl} is not responding. Please ensure it is running.` 
          },
          { status: 503 }
        );
      }
      
      console.error("Failed to fetch token:", fetchError);
      return NextResponse.json(
        { 
          error: "Backend unavailable", 
          message: `Cannot connect to backend service at ${backendUrl}. Please ensure it is running.`,
          details: fetchError instanceof Error ? fetchError.message : "Unknown error"
        },
        { status: 503 }
      );
    }
    
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      if (!["host", "connection", "content-length"].includes(key)) headers[key] = value;
    });
    headers["authorization"] = `Bearer ${token}`;
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
      body: req.method !== "GET" ? await req.arrayBuffer() : undefined,
    };
    
    const libreRes = await fetch(url, fetchOptions);
    const libreData = await libreRes.arrayBuffer();
    
    // Ensure we have content
    if (libreData.byteLength === 0) {
      return NextResponse.json(
        { error: "Empty response", message: "LibreChat service returned an empty response" },
        { status: 502 }
      );
    }
    
    const res = new NextResponse(libreData, { status: libreRes.status });
    libreRes.headers.forEach((v, k) => res.headers.set(k, v));
    return res;
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: "Proxy error", message: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
}
