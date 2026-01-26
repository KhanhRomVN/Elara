export const DASHBOARD_MOCK_DATA = {
  day: Array.from({ length: 24 }).map((_, i) => ({
    date: `${String(i).padStart(2, '0')}:00`,
    requests: Math.floor(Math.random() * 50) + 10,
    tokens: Math.floor(Math.random() * 50000) + 10000,
    providers: [
      { name: 'openai', requests: Math.floor(Math.random() * 20), website: 'openai.com' },
      { name: 'anthropic', requests: Math.floor(Math.random() * 15), website: 'anthropic.com' },
      { name: 'google', requests: Math.floor(Math.random() * 15), website: 'google.com' },
    ],
  })),
  week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
    date: day,
    requests: Math.floor(Math.random() * 300) + 100,
    tokens: Math.floor(Math.random() * 300000) + 100000,
    providers: [
      { name: 'openai', requests: Math.floor(Math.random() * 150), website: 'openai.com' },
      { name: 'anthropic', requests: Math.floor(Math.random() * 100), website: 'anthropic.com' },
    ],
  })),
  month: Array.from({ length: 6 }).map((_, i) => ({
    date: `Jan ${i * 5 + 1}`,
    requests: Math.floor(Math.random() * 1500) + 500,
    tokens: Math.floor(Math.random() * 1500000) + 500000,
    providers: [
      { name: 'openai', requests: Math.floor(Math.random() * 800), website: 'openai.com' },
      { name: 'google', requests: Math.floor(Math.random() * 700), website: 'google.com' },
    ],
  })),
  year: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'].map((month) => ({
    date: month,
    requests: Math.floor(Math.random() * 20000) + 5000,
    tokens: Math.floor(Math.random() * 20000000) + 5000000,
    providers: [
      { name: 'openai', requests: Math.floor(Math.random() * 10000), website: 'openai.com' },
      { name: 'anthropic', requests: Math.floor(Math.random() * 10000), website: 'anthropic.com' },
    ],
  })),
};
