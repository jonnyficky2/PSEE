import type { AgentRole } from '../types/index.js';

export type DataSensitivity = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';

export interface RouteSelection {
  providerId: string;
  modelId: string;
  tier: 'TIER_0_LOCAL' | 'TIER_1_FREE_CLOUD' | 'TIER_2_PAID';
  reason: string;
}

export interface RouteRequest {
  taskId: string;
  role: AgentRole;
  dataSensitivity?: DataSensitivity;
  availableLocalModels: string[];
  availableGatewayModels: string[];
  allowPaid?: boolean;
}

export class FreeFirstPolicyEngine {
  selectRoute(request: RouteRequest): RouteSelection {
    const sensitivity = request.dataSensitivity || 'INTERNAL';

    // Rule 1: SECRET data must NEVER leave the local machine
    if (sensitivity === 'SECRET') {
      const localCodeModel = request.availableLocalModels.find((m) =>
        m.includes('coder') || m.includes('qwen')
      ) || request.availableLocalModels[0];

      if (!localCodeModel) {
        throw new Error(
          'SECURITY VIOLATION: Task contains SECRET data but no local Ollama models are available.'
        );
      }

      return {
        providerId: 'ollama',
        modelId: localCodeModel,
        tier: 'TIER_0_LOCAL',
        reason: 'Strict data privacy policy: SECRET data is routed exclusively to local inference.',
      };
    }

    // Rule 2: Coding & Testing roles prefer local code models if available
    if (request.role === 'coder' || request.role === 'tester') {
      const localCoder = request.availableLocalModels.find((m) =>
        m.includes('qwen2.5-coder:7b') || m.includes('coder')
      );
      if (localCoder) {
        return {
          providerId: 'ollama',
          modelId: localCoder,
          tier: 'TIER_0_LOCAL',
          reason: 'Free-First policy: using local high-performance code model (zero cost).',
        };
      }
    }

    // Rule 3: Planning, Architecture, Review prefer high-context free cloud models
    if (request.role === 'planner' || request.role === 'architect' || request.role === 'reviewer') {
      const preferredGateway = request.availableGatewayModels.find((m) =>
        m === 'ag/gemini-3.8-flash-low' || m.includes('gemini-3.8-flash')
      );
      if (preferredGateway) {
        return {
          providerId: '9router',
          modelId: preferredGateway,
          tier: 'TIER_1_FREE_CLOUD',
          reason: 'High reasoning context task routed to verified free gateway model.',
        };
      }
    }

    // Rule 4: Fallback to any verified free gateway model
    if (request.availableGatewayModels.length > 0) {
      const fallback = request.availableGatewayModels.find((m) =>
        m.startsWith('ag/') || m.startsWith('gh/') || m.startsWith('cx/')
      ) || request.availableGatewayModels[0];

      return {
        providerId: '9router',
        modelId: fallback,
        tier: 'TIER_1_FREE_CLOUD',
        reason: 'Free-First fallback: using available free cloud gateway model.',
      };
    }

    // Rule 5: Fallback to local Ollama if gateway has no models
    if (request.availableLocalModels.length > 0) {
      return {
        providerId: 'ollama',
        modelId: request.availableLocalModels[0],
        tier: 'TIER_0_LOCAL',
        reason: 'Local fallback: gateway unavailable, using local Ollama model.',
      };
    }

    throw new Error('ROUTING_EXHAUSTED: No active local or free gateway models are available.');
  }
}
