export type CampaignStatus = 'draft' | 'running' | 'completed' | 'paused';

export interface CampaignColumn {
    id: string; // e.g. "col_1"
    key: string; // e.g. "nombre" (sanitized for variable use)
    label: string; // e.g. "Nombre del Cliente"
}

export interface CampaignRow {
    id: string;
    campaign_id: string;
    data: Record<string, string>; // { "col_1": "Juan", "col_2": "500€" }
    status: 'pending' | 'calling' | 'completed' | 'failed';
    call_id?: string; // Reference to Retell Call ID
    last_error?: string;
}

export interface Campaign {
    id: string;
    subworkspace_id: string;
    name: string;
    status: CampaignStatus;
    created_at: any; // Firestore Timestamp
    updated_at: any;

    // Schema definition
    columns: CampaignColumn[];

    // Prompt Configuration
    prompt_template: string;

    // Visual Customization
    icon?: string;
    color?: string;

    // Analysis Configuration
    analysis_config?: AnalysisConfig;
}

export interface AnalysisField {
    id: string; // unique internal id
    name: string; // key for Retell
    description: string; // instruction for AI
    type: 'string' | 'boolean' | 'number' | 'enum';
    options?: string[]; // for enum
    isArchived?: boolean;
}

export interface AnalysisConfig {
    enable_transcription: boolean;
    standard_fields: {
        satisfaction_score: boolean; // 0-10
        sentiment: boolean; // Positive/Neutral/Negative
        summary: boolean;
        user_sentiment: boolean;
        call_successful: boolean; // Did it achieve the goal?
    };
    custom_fields: AnalysisField[];
}
