import type {
  AnalysisId,
  AnalysisRecord,
  ShareToken,
  SubmitVideoMetadata,
} from "@/backend";
import type { Principal } from "@icp-sdk/core/principal";

interface AuthResponse {
  user_id: string;
  username: string;
}

function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_PYTHON_BACKEND_URL as string | undefined;
  return v?.trim() || "http://127.0.0.1:8001";
}

function getUserIdHeader(principal: Principal | null | undefined): string {
  return principal?.toString() ?? "2vxsx-fae";
}

function mapRecord(record: AnalysisRecord): AnalysisRecord {
  return record;
}

export class PythonBackend {
  private currentUserId: string | null = null;

  constructor(private principal: Principal | null) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": this.currentUserId || getUserIdHeader(this.principal),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed: ${res.status}`);
    }
    return (await res.json()) as T;
  }

  async login(username: string, password: string): Promise<string> {
    const payload = {
      username: String(username),
      password: String(password),
    };

    const resp = await this.req<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    this.currentUserId = resp.user_id;
    return resp.user_id;
  }

  async register(username: string, password: string): Promise<string> {
    const resp = await this.req<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
      }),
    });
    this.currentUserId = resp.user_id;
    return resp.user_id;
  }

  async registerWithEmail(
    username: string,
    password: string,
    email?: string,
  ): Promise<string> {
    const resp = await this.req<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        ...(email ? { email } : {}),
      }),
    });
    this.currentUserId = resp.user_id;
    return resp.user_id;
  }

  logout(): void {
    this.currentUserId = null;
  }

  isLoggedIn(): boolean {
    return this.currentUserId !== null;
  }

  async submitVideoAnalysis(
    filename: string,
    fileSize: bigint,
    metadata: SubmitVideoMetadata,
    file?: File,
  ): Promise<AnalysisId> {
    if (file) {
      // Upload with FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("filename", filename);
      formData.append("fileSize", String(Number(fileSize)));
      if (metadata.frameCount) {
        formData.append("frameCount", String(Number(metadata.frameCount)));
      }
      if (metadata.frameRate) {
        formData.append("frameRate", String(metadata.frameRate));
      }
      if (metadata.resolution) {
        formData.append("resolution", metadata.resolution);
      }

      const res = await fetch(`${getApiBaseUrl()}/analysis/submit`, {
        method: "POST",
        headers: {
          "X-User-Id": this.currentUserId || getUserIdHeader(this.principal),
        },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }
      return await res.json();
    }

    // Fallback to JSON-only submission (for backward compatibility)
    return this.req<AnalysisId>("/analysis/submit", {
      method: "POST",
      body: JSON.stringify({
        filename,
        fileSize: Number(fileSize),
        metadata: {
          frameCount: metadata.frameCount
            ? Number(metadata.frameCount)
            : undefined,
          frameRate: metadata.frameRate,
          resolution: metadata.resolution,
        },
      }),
    });
  }

  async getAnalysisResult(id: AnalysisId): Promise<AnalysisRecord | null> {
    const v = await this.req<AnalysisRecord | null>(`/analysis/${id}`);
    return v ? mapRecord(v) : null;
  }

  async getUserHistory(): Promise<Array<AnalysisRecord>> {
    const data = await this.req<Array<AnalysisRecord>>("/analysis/history");
    return data.map(mapRecord);
  }

  async deleteAnalysisRecord(id: AnalysisId): Promise<boolean> {
    return this.req<boolean>(`/analysis/${id}`, {
      method: "DELETE",
    });
  }

  async generateShareToken(id: AnalysisId): Promise<string> {
    return this.req<string>(`/analysis/${id}/share-token`, {
      method: "POST",
    });
  }

  async getSharedAnalysis(token: ShareToken): Promise<AnalysisRecord | null> {
    const v = await this.req<AnalysisRecord | null>(`/analysis/shared/${token}`);
    return v ? mapRecord(v) : null;
  }
}
