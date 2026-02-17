// Centralized external service configuration
// All external URLs should be configured here via environment variables

export const SATFLOW_BASE_URL = process.env.SATFLOW_API_URL
    || "https://us-central1-satflow-d3744.cloudfunctions.net/api/v1";
