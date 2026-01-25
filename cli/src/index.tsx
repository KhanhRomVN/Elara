import React from 'react';
import { render } from 'ink';
import AgentInterface from './components/AgentInterface.js';

export function execute() {
  render(<AgentInterface />);
}

// Tự động chạy khi được gọi trực tiếp (ví dụ qua tsx)
if (import.meta.url.endsWith('index.tsx')) {
  execute();
}
