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
