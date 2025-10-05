const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const token = jwt.sign(
  { id: '3061c9af-b896-447a-a328-d86adb222703', username: 'test' },
  'your-super-secret-jwt-key-change-in-production-2025'
);

async function testAnnotationsApi() {
  try {
    const response = await fetch(
      'http://localhost:3001/api/annotations?novelId=d3181eaa-6798-4e1b-af05-2ec987207347',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);

    const data = await response.text();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

testAnnotationsApi();
