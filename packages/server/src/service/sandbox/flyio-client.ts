// Type-safe Fly.io API client based on their OpenAPI specification

// Define proper TypeScript types based on the OpenAPI spec
export interface App {
  id?: string;
  name?: string;
  organization?: {
    name?: string;
    slug?: string;
  };
  status?: string;
}

export interface Machine {
  id?: string;
  name?: string;
  state?: string;
  region?: string;
  instance_id?: string;
  private_ip?: string;
  config?: {
    image?: string;
    env?: Record<string, string>;
    services?: Array<{
      ports?: Array<{
        port?: number;
        handlers?: string[];
      }>;
      protocol?: string;
      internal_port?: number;
    }>;
    auto_destroy?: boolean;
    restart?: {
      policy?: string;
    };
  };
  image_ref?: {
    registry?: string;
    repository?: string;
    tag?: string;
    digest?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface CreateMachineRequest {
  config?: {
    image?: string;
    env?: Record<string, string>;
    services?: Array<{
      autostart?: boolean;
      autostop?: "off" | "stop" | "suspend";
      ports?: Array<{
        port?: number;
        handlers?: string[];
      }>;
      protocol?: string;
      internal_port?: number;
    }>;
    auto_destroy?: boolean;
    restart?: {
      policy?: string;
    };
    guest?: {
      cpu_kind?: "shared" | "performance";
      cpus?: number;
      memory_mb?: number;
    };
  };
  name?: string;
  region?: string;
  lease_ttl?: number;
  stop_config?: {
    signal?: string;
    timeout?: number;
  };
}

export interface CreateAppRequest {
  app_name?: string;
  enable_subdomains?: boolean;
  network?: string;
  org_slug?: string;
}

export interface ListAppsResponse {
  apps?: Array<{
    id?: string;
    name?: string;
    machine_count?: number;
    network?: string;
  }>;
  total_apps?: number;
}

export interface MachineExecRequest {
  cmd?: string;
  command?: string[];
  container?: string;
  stdin?: string;
  timeout?: number;
}

export interface Volume {
  id?: string;
  name?: string;
  region?: string;
  size_gb?: number;
  state?: string;
  attached_machine_id?: string;
  created_at?: string;
  encrypted?: boolean;
  fstype?: string;
  host_status?: "ok" | "unknown" | "unreachable";
  zone?: string;
}

export interface CreateVolumeRequest {
  name?: string;
  region?: string;
  size_gb?: number;
  encrypted?: boolean;
  fstype?: string;
  snapshot_id?: string;
  source_volume_id?: string;
  require_unique_zone?: boolean;
  unique_zone_app_wide?: boolean;
}

export interface ErrorResponse {
  error?: string;
  status?: number;
}

export interface StopRequest {
  signal?: string;
}

export interface UpdateMachineRequest {
  config?: Machine["config"];
  current_version?: string;
  lease_ttl?: number;
  lsvd?: boolean;
  min_secrets_version?: number;
  name?: string;
  region?: string;
  skip_launch?: boolean;
  skip_secrets?: boolean;
  skip_service_registration?: boolean;
}

export interface UpdateVolumeRequest {
  auto_backup_enabled?: boolean;
  snapshot_retention?: number;
}

export interface ExtendVolumeRequest {
  size_gb?: number;
}

export interface ExtendVolumeResponse {
  needs_restart?: boolean;
  volume?: Volume;
}

export interface ExecResponse {
  exit_code?: number;
  stdout?: string;
  stderr?: string;
}

type IPType = "v4" | "v6" | "shared_v4" | "shared_v6";

interface AllocateIpResponse {
  data?: {
    allocateIpAddress: {
      ipAddress: null;
    };
  };
  errors?: { message: string }[];
}

// Type-safe client class for Fly.io API
export class FlyioClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(apiToken: string, baseUrl = "https://api.machines.dev/v1") {
    this.baseUrl = baseUrl;
    this.headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Fly.io API error: ${response.status} ${error}`);
    }

    return response.json() as T;
  }

  // Fly.io only have a GraphQL endpoint for IP allocation, so we handle that separately
  async allocateIp({
    appId,
    type = "shared_v4",
  }: {
    appId: string;
    type?: IPType;
  }): Promise<void> {
    const query = `
    mutation AllocateIP($input: AllocateIPAddressInput!) {
      allocateIpAddress(input: $input) {
        ipAddress {
          address
          type
          region
        }
      }
    }
  `;

    const res = await fetch("https://api.fly.io/graphql", {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        query,
        variables: {
          input: {
            appId,
            type,
          },
        },
      }),
    });

    const result = (await res.json()) as AllocateIpResponse;

    if (result.errors?.length) {
      throw new Error(
        `Fly API error: ${result.errors.map((e) => e.message).join(", ")}`,
      );
    }

    // The API always returns ipAddress as null, but the operation succeeds
    // if there are no errors in the response
    return;
  }

  // Apps endpoints
  async listApps(orgSlug: string): Promise<ListAppsResponse> {
    return this.request(`/apps?org_slug=${orgSlug}`);
  }

  async createApp(request: CreateAppRequest): Promise<App> {
    return this.request("/apps", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getApp(appName: string): Promise<App> {
    return this.request(`/apps/${appName}`);
  }

  async deleteApp(appName: string): Promise<void> {
    await this.request(`/apps/${appName}`, {
      method: "DELETE",
    });
  }

  // Machines endpoints
  async listMachines(
    appName: string,
    options?: {
      includeDeleted?: boolean;
      region?: string;
      state?: string;
      summary?: boolean;
    },
  ): Promise<Machine[]> {
    const params = new URLSearchParams();
    if (options?.includeDeleted) params.set("include_deleted", "true");
    if (options?.region) params.set("region", options.region);
    if (options?.state) params.set("state", options.state);
    if (options?.summary) params.set("summary", "true");

    const query = params.toString();
    const path = `/apps/${appName}/machines${query ? `?${query}` : ""}`;
    return this.request(path);
  }

  async createMachine(
    appName: string,
    request: CreateMachineRequest,
  ): Promise<Machine> {
    return this.request(`/apps/${appName}/machines`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async updateMachine(
    appName: string,
    machineId: string,
    request: UpdateMachineRequest,
  ): Promise<Machine> {
    return this.request(`/apps/${appName}/machines/${machineId}`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async deleteMachine(
    appName: string,
    machineId: string,
    force?: boolean,
  ): Promise<void> {
    const params = force ? "?force=true" : "";
    await this.request(`/apps/${appName}/machines/${machineId}${params}`, {
      method: "DELETE",
    });
  }

  async startMachine(appName: string, machineId: string): Promise<void> {
    await this.request(`/apps/${appName}/machines/${machineId}/start`, {
      method: "POST",
    });
  }

  async stopMachine(
    appName: string,
    machineId: string,
    request?: StopRequest,
  ): Promise<void> {
    await this.request(`/apps/${appName}/machines/${machineId}/stop`, {
      method: "POST",
      body: request ? JSON.stringify(request) : undefined,
    });
  }

  async restartMachine(
    appName: string,
    machineId: string,
    options?: {
      timeout?: string;
      signal?: string;
    },
  ): Promise<void> {
    const params = new URLSearchParams();
    if (options?.timeout) params.set("timeout", options.timeout);
    if (options?.signal) params.set("signal", options.signal);

    const query = params.toString();
    const path = `/apps/${appName}/machines/${machineId}/restart${
      query ? `?${query}` : ""
    }`;
    await this.request(path, {
      method: "POST",
    });
  }

  async suspendMachine(appName: string, machineId: string): Promise<void> {
    await this.request(`/apps/${appName}/machines/${machineId}/suspend`, {
      method: "POST",
    });
  }

  async execInMachine(
    appName: string,
    machineId: string,
    request: MachineExecRequest,
  ): Promise<ExecResponse> {
    return this.request(`/apps/${appName}/machines/${machineId}/exec`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async waitForMachineState(
    appName: string,
    machineId: string,
    options?: {
      instanceId?: string;
      timeout?: number;
      state?: "started" | "stopped" | "suspended" | "destroyed";
    },
  ): Promise<void> {
    const params = new URLSearchParams();
    if (options?.instanceId) params.set("instance_id", options.instanceId);
    if (options?.timeout) params.set("timeout", options.timeout.toString());
    if (options?.state) params.set("state", options.state);

    const query = params.toString();
    const path = `/apps/${appName}/machines/${machineId}/wait${
      query ? `?${query}` : ""
    }`;
    await this.request(path);
  }

  // Volumes endpoints
  async listVolumes(appName: string, summary?: boolean): Promise<Volume[]> {
    const params = summary ? "?summary=true" : "";
    return this.request(`/apps/${appName}/volumes${params}`);
  }

  async createVolume(
    appName: string,
    request: CreateVolumeRequest,
  ): Promise<Volume> {
    return this.request(`/apps/${appName}/volumes`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getVolume(appName: string, volumeId: string): Promise<Volume> {
    return this.request(`/apps/${appName}/volumes/${volumeId}`);
  }

  async updateVolume(
    appName: string,
    volumeId: string,
    request: UpdateVolumeRequest,
  ): Promise<Volume> {
    return this.request(`/apps/${appName}/volumes/${volumeId}`, {
      method: "PUT",
      body: JSON.stringify(request),
    });
  }

  async deleteVolume(appName: string, volumeId: string): Promise<Volume> {
    return this.request(`/apps/${appName}/volumes/${volumeId}`, {
      method: "DELETE",
    });
  }

  async extendVolume(
    appName: string,
    volumeId: string,
    request: ExtendVolumeRequest,
  ): Promise<ExtendVolumeResponse> {
    return this.request(`/apps/${appName}/volumes/${volumeId}/extend`, {
      method: "PUT",
      body: JSON.stringify(request),
    });
  }
}

// Helper function to create an authenticated client
export function createAuthenticatedFlyioClient(apiToken: string): FlyioClient {
  return new FlyioClient(apiToken);
}

// Export the client class as the default export
export default FlyioClient;
