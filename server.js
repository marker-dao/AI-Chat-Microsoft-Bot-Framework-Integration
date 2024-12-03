const path = require('node:path');

const express = require('express');
const bodyParser = require('body-parser');
const { detectIntent } = require('./dialogflow');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, './public')));

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/webhook', async (request, response) => {
  const { message, sessionId } = request.body;

  if (!message || !sessionId) {
    return response.status(400).json({ error: 'Message and sessionId are required' });
  }

  try {
    const result = await detectIntent(message, sessionId);

    response.json({ response: result });
  } catch (error) {
    console.error(error);

    response.status(500).send('Error processing request');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
