async function testChat() {
  try {
    const response = await fetch('http://127.0.0.1:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello, are you working?' })
    });
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testChat();
