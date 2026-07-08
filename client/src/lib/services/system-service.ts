import { create } from '@bufbuild/protobuf';
import {
  AdminSystemPromptResponseSchema,
  UpdatePromptRequestSchema,
  type AdminSystemPrompt,
} from '@modl-gg/proto/modl/v1/admin_pb.ts';
import { protoFetch, protoSend, requireData } from '@/lib/proto-fetch';
import { tsToIso } from '@/lib/proto-ui';

export interface SystemPrompt {
  id: string;
  prompt: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function mapPrompt(data: AdminSystemPrompt): SystemPrompt {
  return {
    id: data.id,
    prompt: data.prompt,
    isActive: data.isActive,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  };
}

export const systemService = {
  async getSystemPrompt(): Promise<SystemPrompt | null> {
    const response = await protoFetch(AdminSystemPromptResponseSchema, '/v1/admin/system/prompts');
    return response.data ? mapPrompt(response.data) : null;
  },

  async updateSystemPrompt(prompt: string): Promise<SystemPrompt> {
    const response = await protoSend(
      'PUT',
      '/v1/admin/system/prompts',
      UpdatePromptRequestSchema,
      create(UpdatePromptRequestSchema, { prompt }),
      AdminSystemPromptResponseSchema,
    );

    return mapPrompt(requireData(response.data, 'admin update system prompt'));
  },

  async resetSystemPrompt(): Promise<SystemPrompt> {
    const response = await protoFetch(AdminSystemPromptResponseSchema, '/v1/admin/system/prompts/reset', {
      method: 'POST',
    });

    return mapPrompt(requireData(response.data, 'admin reset system prompt'));
  },
};
