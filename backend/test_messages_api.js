const fetch = require('node-fetch');

async function testMessagesAPI() {
  const url = 'http://127.0.0.1:11434/v1/messages';
  const payload = {
    model: 'deepseek/deepseek-chat',
    messages: [
      {
        role: 'user',
        content: 'xin chào.',
      },
    ],
    stream: false,
    max_tokens: 100,
    temperature: 0.7,
  };

  console.log('--- Testing /v1/messages (Non-Stream) ---');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-key', // This will trigger fallback to first account if key doesn't exist
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response JSON:', JSON.stringify(data, null, 2));

    if (data.usage && data.usage.input_tokens > 0) {
      console.log('✅ Token calculation seems to work!');
    } else {
      console.log('❌ Token calculation failed (it is still 0 or missing)');
    }

    if (data.model && data.model.includes('deepseek')) {
      console.log('✅ Model name is correct!');
    } else {
      console.log('❌ Model name is wrong:', data.model);
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testMessagesAPI();
