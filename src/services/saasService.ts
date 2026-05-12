
export interface SaasUser {
  name: string;
  enterprise: string;
  integral: number;
}

export interface SaasTool {
  name: string;
  integral: number;
}

export interface LaunchData {
  user: SaasUser;
  tool: SaasTool;
}

export interface VerifyData {
  currentIntegral: number;
  requiredIntegral: number;
}

export interface ConsumeData {
  currentIntegral: number;
  consumedIntegral: number;
}

export interface UploadResponse {
  success: boolean;
  url: string;
  images?: { url: string; fileName: string }[];
}

class SaasService {
  private userId: string | null = null;
  private toolId: string | null = null;

  init(userId: string, toolId: string) {
    this.userId = userId;
    this.toolId = toolId;
  }

  get config() {
    return { userId: this.userId, toolId: this.toolId };
  }

  async launch(): Promise<LaunchData | null> {
    if (!this.userId || !this.toolId) return null;
    try {
      const resp = await fetch('/api/tool/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.userId, toolId: this.toolId })
      });
      const json = await resp.json();
      return json.success ? json.data : null;
    } catch (e) {
      console.error('Launch failed', e);
      return null;
    }
  }

  async verify(): Promise<{ success: boolean; message?: string; data?: VerifyData }> {
    if (!this.userId || !this.toolId) return { success: false, message: 'Missing IDs' };
    try {
      const resp = await fetch('/api/tool/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.userId, toolId: this.toolId })
      });
      return await resp.json();
    } catch (e) {
      return { success: false, message: 'Verify request failed' };
    }
  }

  async consume(): Promise<{ success: boolean; data?: ConsumeData }> {
    if (!this.userId || !this.toolId) return { success: false };
    try {
      const resp = await fetch('/api/tool/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.userId, toolId: this.toolId })
      });
      return await resp.json();
    } catch (e) {
      return { success: false };
    }
  }

  async uploadResult(base64: string): Promise<UploadResponse | null> {
    if (!this.userId) return null;
    try {
      const resp = await fetch('/api/upload/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64,
          userId: this.userId,
          source: 'result'
        })
      });
      const json = await resp.json();
      return json.success ? json : null;
    } catch (e) {
      console.error('Upload failed', e);
      return null;
    }
  }
}

export const saasService = new SaasService();
