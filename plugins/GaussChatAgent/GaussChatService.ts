import { AgentConfig } from '../LogAnalysisAgent/protocol';
import { sendToAgent } from '../LogAnalysisAgent/services/agentApiService';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export async function sendChatMessage(
  text: string,
  config: AgentConfig,
  onPartialUpdate?: (content: string) => void,
  onRawUpdate?: (raw: string) => void
): Promise<string> {
  // Gauss Chat용 가상 AgentRequest 생성
  const dummyRequest: any = {
    analysis_type: 'chat',
    mission_name: 'Gauss Chat Session',
    iteration: 1,
    max_iterations: 1,
    context: {
      log_stats: { file_name: 'chat_session', total_lines: 0, filtered_lines: 0 },
      initial_hints: text // 가우스 input_value로 바로 전달됨
    }
  };

  const response = await sendToAgent(dummyRequest, config, undefined, onPartialUpdate, onRawUpdate);
  return response.thought || response.final_report || '';
}
