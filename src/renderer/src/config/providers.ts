import claudeIcon from '../assets/provider_icons/claude.svg';
import deepseekIcon from '../assets/provider_icons/deepseek.svg';
import mistralIcon from '../assets/provider_icons/mistral.svg';
import kimiIcon from '../assets/provider_icons/kimi.svg';
import qwenIcon from '../assets/provider_icons/qwen.svg';
import cohereIcon from '../assets/provider_icons/cohere.svg';
import perplexityIcon from '../assets/provider_icons/perplexity.svg';
import groqIcon from '../assets/provider_icons/groq.svg';
import geminiIcon from '../assets/provider_icons/gemini.svg';
import antigravityIcon from '../assets/provider_icons/antigravity.svg';
import huggingChatIcon from '../assets/provider_icons/huggingface.svg';
import lmArenaIcon from '../assets/provider_icons/lmarena.svg';
import stepfunIcon from '../assets/provider_icons/stepfun.svg';

export interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  loginMethod: string;
  browserType: 'Electron Window' | 'Real Browser' | 'Auth Server';
  authMethod: 'Basic' | 'OAuth';
  active: boolean;
  website?: string;
  is_search?: boolean;
}

export const providers: ProviderConfig[] = [
  {
    id: 'Claude',
    name: 'Claude',
    description: 'Smartest Model',
    icon: claudeIcon,
    color: 'bg-orange-500/10 text-orange-500 border-orange-200/20',
    loginMethod: 'Direct / Google',
    browserType: 'Real Browser',
    authMethod: 'Basic',
    active: true,
    website: 'https://anthropic.com',
    is_search: false,
  },
  {
    id: 'DeepSeek',
    name: 'DeepSeek',
    description: 'Open Weight Model',
    icon: deepseekIcon,
    color: 'bg-blue-500/10 text-blue-500 border-blue-200/20',
    loginMethod: 'Google',
    browserType: 'Real Browser',
    authMethod: 'Basic',
    active: true,
    website: 'https://deepseek.com',
    is_search: true,
  },
  {
    id: 'Mistral',
    name: 'Mistral',
    description: 'European AI',
    icon: mistralIcon,
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-200/20',
    loginMethod: 'Direct / Google',
    browserType: 'Real Browser',
    authMethod: 'Basic',
    active: true,
    website: 'https://mistral.ai/',
    is_search: false,
  },
  {
    id: 'Kimi',
    name: 'Kimi',
    description: 'Long Context',
    icon: kimiIcon,
    color: 'bg-indigo-500/10 text-indigo-500 border-indigo-200/20',
    loginMethod: 'Mobile / OTP',
    browserType: 'Real Browser',
    authMethod: 'Basic',
    active: false,
    website: 'https://www.kimi.com/',
    is_search: false,
  },
  {
    id: 'Qwen',
    name: 'Qwen',
    description: 'Alibaba Cloud',
    icon: qwenIcon,
    color: 'bg-purple-500/10 text-purple-500 border-purple-200/20',
    loginMethod: 'Direct',
    browserType: 'Real Browser',
    authMethod: 'Basic',
    active: true,
    website: 'https://qwenlm.ai/',
    is_search: false,
  },
  {
    id: 'Cohere',
    name: 'Cohere',
    description: 'Enterprise AI',
    icon: cohereIcon,
    color: 'bg-teal-500/10 text-teal-500 border-teal-200/20',
    loginMethod: 'Direct',
    browserType: 'Real Browser',
    authMethod: 'Basic',
    active: true,
    website: 'https://cohere.com',
    is_search: false,
  },
  {
    id: 'Perplexity',
    name: 'Perplexity',
    description: 'Search Engine',
    icon: perplexityIcon,
    color: 'bg-cyan-500/10 text-cyan-500 border-cyan-200/20',
    loginMethod: 'Google',
    browserType: 'Real Browser',
    authMethod: 'Basic',
    active: true,
    website: 'https://www.perplexity.ai/',
    is_search: false,
  },
  {
    id: 'Groq',
    name: 'Groq',
    description: 'Fastest Inference',
    icon: groqIcon,
    color: 'bg-orange-600/10 text-orange-600 border-orange-300/20',
    loginMethod: 'Google / Email',
    browserType: 'Real Browser',
    authMethod: 'Basic',
    active: true,
    website: 'https://groq.com',
    is_search: false,
  },
  {
    id: 'Gemini',
    name: 'Gemini',
    description: 'Google Deepmind',
    icon: geminiIcon,
    color: 'bg-sky-500/10 text-sky-500 border-sky-200/20',
    loginMethod: 'Google',
    browserType: 'Real Browser',
    authMethod: 'OAuth',
    active: true,
    website: 'https://ai.google.dev',
    is_search: false,
  },
  {
    id: 'Antigravity',
    name: 'Antigravity',
    description: 'Unified AI Gateway',
    icon: antigravityIcon,
    color: 'bg-purple-500/10 text-purple-500 border-purple-200/20',
    loginMethod: 'Google OAuth',
    browserType: 'Auth Server',
    authMethod: 'OAuth',
    active: true,
    website: 'https://deepmind.google/',
    is_search: false,
  },
  {
    id: 'HuggingChat',
    name: 'HuggingChat',
    description: 'Open AI Community',
    icon: huggingChatIcon,
    color: 'bg-amber-500/10 text-amber-500 border-amber-200/20',
    loginMethod: 'Direct / Google',
    browserType: 'Real Browser',
    authMethod: 'Basic',
    active: true,
    website: 'https://huggingface.co/chat/',
    is_search: false,
  },
  {
    id: 'LMArena',
    name: 'LMArena',
    description: 'LMArena Direct Chat',
    icon: lmArenaIcon,
    color: 'bg-emerald-500/10 text-emerald-500 border-emerald-200/20',
    loginMethod: 'Direct / Google',
    browserType: 'Real Browser',
    authMethod: 'Basic',
    active: false,
    website: 'https://lmarena.ai/',
    is_search: false,
  },
  {
    id: 'StepFun',
    name: 'StepFun',
    description: 'StepFun AI',
    icon: stepfunIcon,
    color: 'bg-blue-600/10 text-blue-600 border-blue-300/20',
    loginMethod: 'Direct / Google',
    browserType: 'Real Browser',
    authMethod: 'Basic',
    active: false,
    website: 'https://stepfun.ai/',
    is_search: false,
  },
];
