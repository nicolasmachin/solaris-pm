import { apiClient as api } from "./axios";
import type {
  ProposalDefaultsResponse,
  ProposalDefaultsUpdateInput,
} from "../types/proposals-v2";

export const proposalsV2DefaultsApi = {
  get: async (): Promise<ProposalDefaultsResponse> => {
    const { data } = await api.get<ProposalDefaultsResponse>("/api/proposals-v2/defaults");
    return data;
  },
  update: async (input: ProposalDefaultsUpdateInput): Promise<ProposalDefaultsResponse> => {
    const { data } = await api.put<ProposalDefaultsResponse>("/api/proposals-v2/defaults", input);
    return data;
  },
};
