export interface ToolParameter {
    name: string;
    type: "string" | "number" | "boolean";
    description: string;
    required: boolean;
}

export interface AgentTool {
    id: string;
    name: string;
    description: string;
    url: string;
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    headers: { key: string; value: string }[];
    parameters: ToolParameter[];
}

export interface ToolExecutionLog {
    id: string;
    tool_id: string;
    tool_name: string;
    timestamp: any; // Firestore Timestamp
    request: {
        url: string;
        method: string;
        headers: any;
        body: any;
    };
    response: {
        status: number;
        data: any;
        error?: string;
    };
    duration_ms: number;
    success: boolean;
}
