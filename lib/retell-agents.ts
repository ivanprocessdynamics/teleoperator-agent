// Retell Agent Slots Configuration
// Each slot is linked to a pre-configured Retell agent
// When a new agent (subworkspace) is created, it gets assigned the next available slot

export interface RetellAgentSlot {
    slot: number;
    agentId: string;
    name: string;
}

// 10 pre-configured Retell agent slots
export const RETELL_AGENT_SLOTS: RetellAgentSlot[] = [
    { slot: 1, agentId: "agent_0a3d3ae5da45959c3e7f723905", name: "Agent Slot 1" },
    { slot: 2, agentId: "agent_24901c2407e09f38d6af1b5f82", name: "Agent Slot 2" },
    { slot: 3, agentId: "agent_de7dbd11552cad58efda3b2ad3", name: "Agent Slot 3" },
    { slot: 4, agentId: "agent_cd38ef46bba21543d6599b61b0", name: "Agent Slot 4" },
    { slot: 5, agentId: "agent_4b232e4090a75c58872e2061e0", name: "Agent Slot 5" },
    { slot: 6, agentId: "agent_d89fbbdd2d67d62eb60f86a7dc", name: "Agent Slot 6" },
    { slot: 7, agentId: "agent_1f429982c42e239d5f2886a2c1", name: "Agent Slot 7" },
    { slot: 8, agentId: "agent_d4374a58d15e7b335392713bf4", name: "Agent Slot 8" },
    { slot: 9, agentId: "agent_1eb224777483f758844f36323e", name: "Agent Slot 9" },
    { slot: 10, agentId: "agent_c23eba4ca9342855a408f0f694", name: "Agent Slot 10" },
];

// Helper function to get a slot by number
export function getSlotByNumber(slotNumber: number): RetellAgentSlot | undefined {
    return RETELL_AGENT_SLOTS.find(s => s.slot === slotNumber);
}

// Helper function to get agent ID by slot number
export function getAgentIdBySlot(slotNumber: number): string | undefined {
    return getSlotByNumber(slotNumber)?.agentId;
}

// Get the prompt space URL for a subworkspace
export function getPromptSpaceUrl(subworkspaceId: string): string {
    return `/api/agent-prompt/${subworkspaceId}`;
}
