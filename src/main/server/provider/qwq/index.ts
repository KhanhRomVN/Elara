import { getModels, chatCompletionStream, isModelSupported } from './chat';

export default {
  name: 'QWQ',
  provider_id: 'qwq',
  getModels,
  chatCompletionStream,
  isModelSupported,
};
