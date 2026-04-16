import { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

// --- Types ---
interface LogEntry {
  level: "error" | "warn" | "info";
  message: string;
  timestamp: string;
}

interface FailedRequest {
  url: string;
  status: number;
  method: string;
  timestamp: string;
}

interface ErrorMetadata {
  error_message: string;
  error_stack?: string;
  page_url: string;
  user_agent: string;
  timestamp: string;
  recent_logs: LogEntry[];
  failed_requests: FailedRequest[];
}

interface ErrorCaptureContextType {
  captureError: (error: Error, context?: string) => void;
}

const ErrorCaptureContext = createContext<ErrorCaptureContextType | undefined>(undefined);

// --- Constants ---
const MAX_LOG_BUFFER = 30;
const RATE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_TITLE_LENGTH = 120;
const MAX_STACK_LENGTH = 2000;

// --- Helpers ---
function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}

function getErrorFingerprint(message: string, source?: string): string {
  return `${message}::${source || "unknown"}`;
}

function formatDescription(
  errorMessage: string,
  pageUrl: string,
  userName: string,
  userEmail: string,
  workspaceName: string,
  stack?: string,
  recentLogs?: LogEntry[],
  failedRequests?: FailedRequest[]
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  let desc = `🔴 Erro automático detectado\n\n`;
  desc += `Página: ${pageUrl}\n`;
  desc += `Usuário: ${userName} (${userEmail})\n`;
  desc += `Workspace: ${workspaceName}\n`;
  desc += `Navegador: ${navigator.userAgent.slice(0, 100)}\n`;
  desc += `Data/Hora: ${dateStr} às ${timeStr}\n\n`;
  desc += `Erro: ${errorMessage}\n`;

  if (stack) {
    desc += `\nStack Trace:\n${truncate(stack, MAX_STACK_LENGTH)}\n`;
  }

  if (recentLogs && recentLogs.length > 0) {
    desc += `\nÚltimos logs do console:\n`;
    recentLogs.slice(-10).forEach((log) => {
      const time = new Date(log.timestamp).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      desc += `[${log.level.toUpperCase()}] ${time} - ${truncate(log.message, 200)}\n`;
    });
  }

  if (failedRequests && failedRequests.length > 0) {
    desc += `\nRequisições com falha:\n`;
    failedRequests.slice(-5).forEach((req) => {
      desc += `${req.method} ${req.url} → ${req.status}\n`;
    });
  }

  return desc;
}

// --- Provider ---
export function ErrorCaptureProvider({ children }: { children: ReactNode }) {
  const { currentWorkspace, user } = useWorkspace();

  // Buffers (refs to avoid re-renders)
  const logBuffer = useRef<LogEntry[]>([]);
  const failedRequestsBuffer = useRef<FailedRequest[]>([]);
  const rateLimitMap = useRef<Map<string, number>>(new Map());
  const isInitialized = useRef(false);

  // Stable refs for current user/workspace
  const userRef = useRef(user);
  const workspaceRef = useRef(currentWorkspace);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { workspaceRef.current = currentWorkspace; }, [currentWorkspace]);

  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    logBuffer.current.push({
      level,
      message: truncate(String(message), 500),
      timestamp: new Date().toISOString(),
    });
    if (logBuffer.current.length > MAX_LOG_BUFFER) {
      logBuffer.current = logBuffer.current.slice(-MAX_LOG_BUFFER);
    }
  }, []);

  const addFailedRequest = useCallback((url: string, status: number, method: string) => {
    failedRequestsBuffer.current.push({
      url: truncate(url, 200),
      status,
      method,
      timestamp: new Date().toISOString(),
    });
    if (failedRequestsBuffer.current.length > 10) {
      failedRequestsBuffer.current = failedRequestsBuffer.current.slice(-10);
    }
  }, []);

  const isRateLimited = useCallback((fingerprint: string): boolean => {
    const lastSent = rateLimitMap.current.get(fingerprint);
    if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
      return true;
    }
    rateLimitMap.current.set(fingerprint, Date.now());

    // Cleanup old entries
    if (rateLimitMap.current.size > 100) {
      const now = Date.now();
      for (const [key, time] of rateLimitMap.current.entries()) {
        if (now - time > RATE_LIMIT_MS) {
          rateLimitMap.current.delete(key);
        }
      }
    }
    return false;
  }, []);

  const captureError = useCallback(
    async (error: Error, context?: string) => {
      const currentUser = userRef.current;
      const workspace = workspaceRef.current;

      // Don't capture if no user is logged in
      if (!currentUser) return;

      const errorMessage = error.message || String(error);
      const fingerprint = getErrorFingerprint(errorMessage, context || window.location.pathname);

      if (isRateLimited(fingerprint)) return;

      const pageUrl = window.location.pathname + window.location.search;
      const userName = (currentUser as any)?.user_metadata?.full_name || currentUser.email || "Desconhecido";
      const userEmail = currentUser.email || "N/A";
      const workspaceName = workspace?.name || "N/A";

      const metadata: ErrorMetadata = {
        error_message: truncate(errorMessage, 500),
        error_stack: error.stack ? truncate(error.stack, MAX_STACK_LENGTH) : undefined,
        page_url: pageUrl,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        recent_logs: [...logBuffer.current],
        failed_requests: [...failedRequestsBuffer.current],
      };

      const title = truncate(
        `[Auto] Erro em ${pageUrl}: ${errorMessage}`,
        MAX_TITLE_LENGTH
      );

      const description = formatDescription(
        errorMessage,
        pageUrl,
        userName,
        userEmail,
        workspaceName,
        error.stack,
        logBuffer.current,
        failedRequestsBuffer.current
      );

      try {
        await (supabase as any).from("system_requests").insert({
          user_id: currentUser.id,
          type: "auto_bug",
          source: "auto",
          title,
          description,
          status: "pending",
          workspace_id: workspace?.id || null,
          error_metadata: metadata,
        });
      } catch (insertError) {
        // Silently fail — we don't want error reporting to cause more errors
        // Use original console.error to avoid infinite loop
      }
    },
    [isRateLimited]
  );

  // --- Setup interceptors (once) ---
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // 1. Intercept console.error and console.warn
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.error = (...args: any[]) => {
      const message = args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
      addLog("error", message);
      originalConsoleError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      const message = args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
      addLog("warn", message);
      originalConsoleWarn.apply(console, args);
    };

    // 2. Intercept window.onerror (uncaught JS errors)
    const handleWindowError = (event: ErrorEvent) => {
      const error = event.error instanceof Error
        ? event.error
        : new Error(event.message || "Unknown error");
      captureError(error, event.filename);
    };
    window.addEventListener("error", handleWindowError);

    // 3. Intercept unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const error = reason instanceof Error
        ? reason
        : new Error(typeof reason === "string" ? reason : "Unhandled promise rejection");
      captureError(error, "unhandledrejection");
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // 4. Intercept fetch failures (API errors)
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      let response: Response;
      try {
        response = await originalFetch.apply(window, args);
      } catch (networkError) {
        // Network-level failure (no internet, CORS, etc.)
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "unknown";
        const method = (args[1]?.method || "GET").toUpperCase();
        addFailedRequest(url, 0, method);
        throw networkError;
      }

      if (response.status >= 500) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "unknown";
        const method = (args[1]?.method || "GET").toUpperCase();
        addFailedRequest(url, response.status, method);

        // Only auto-report 500+ errors (server errors)
        const error = new Error(`API Error ${response.status}: ${method} ${url}`);
        captureError(error, url);
      } else if (response.status >= 400) {
        // Log 4xx but don't auto-report (these are usually validation errors, auth etc.)
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "unknown";
        const method = (args[1]?.method || "GET").toUpperCase();
        addFailedRequest(url, response.status, method);
      }

      return response;
    };

    // Cleanup
    return () => {
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.fetch = originalFetch;
      isInitialized.current = false;
    };
  }, [addLog, addFailedRequest, captureError]);

  return (
    <ErrorCaptureContext.Provider value={{ captureError }}>
      {children}
    </ErrorCaptureContext.Provider>
  );
}

export function useErrorCapture() {
  const context = useContext(ErrorCaptureContext);
  if (context === undefined) {
    throw new Error("useErrorCapture must be used within an ErrorCaptureProvider");
  }
  return context;
}
