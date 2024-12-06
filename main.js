import { DirectLine } from 'botframework-directlinejs';

const SECRET = import.meta.env.VITE_DIRECT_LINE_SECRET;
const DIRECT_LINE_DOMAIN = 'https://europe.directline.botframework.com/v3/directline';

const user = {
  id: Date.now(),
  name: 'You',
};

const chatContainer = document.getElementById('chat');
const inputField = document.getElementById('input');
const sendButton = document.getElementById('send');

function appendMessage(text, className) {
  const messageDiv = document.createElement('div');

  messageDiv.className = className;
  messageDiv.textContent = text;

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function fetchDirectLineToken(secret) {
  try {
    const response = await fetch(`${DIRECT_LINE_DOMAIN}/tokens/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch token: ${response.status}`);
    }

    const { token } = await response.json();

    return token;
  } catch (error) {
    console.error('Error fetching Direct Line token:', error);
    throw error;
  }
}

async function initChat() {
  const token = await fetchDirectLineToken(SECRET);

  const directLine = new DirectLine({
    token,
    domain: DIRECT_LINE_DOMAIN,
  });

  directLine.activity$.subscribe(
    activity => {
      if (activity.type === 'message' && activity.from.id !== user.id) {
        appendMessage(activity.text, 'bot');
      }
    },
    error => {
      console.error('Error receiving activities:', error);
      appendMessage('Error receiving messages from the bot.', 'bot');
    }
  );

  directLine.connectionStatus$.subscribe(status => {
    console.log('Connection status:', status);

    switch (status) {
      case 0: // Uninitialized
        console.warn('DirectLine connection is uninitialized.');
        break;
      case 1: // Connecting
        console.log('DirectLine is connecting...');
        break;
      case 2: // Online
        console.log('DirectLine connection is online!');
        break;
      case 3: // ExpiredToken
        console.error('DirectLine token has expired.');
        break;
      case 4: // FailedToConnect
        console.error('DirectLine failed to connect. Please check your token or domain.');
        break;
      case 5: // Ended
        console.warn('DirectLine connection has ended.');
        break;
      default:
        console.warn('Unknown DirectLine connection status:', status);
    }
  });

  return directLine;
}

function handleSendMessage(directLine) {
  const message = inputField.value.trim();

  if (!message) {
    return;
  };

  appendMessage(message, 'user');

  directLine
    .postActivity({
      from: user,
      type: 'message',
      text: message,
    })
    .subscribe(
      () => console.log('Message sent successfully'),
      error => console.error('Error sending message:', error)
    );

  inputField.value = '';
}

async function main() {
  try {
    const directLine = await initChat();

    sendButton.addEventListener('click', () => handleSendMessage(directLine));

    inputField.addEventListener('keypress', event => {
      if (event.key === 'Enter') {
        handleSendMessage(directLine);
      }
    });
  } catch (error) {
    console.error('Error initializing chat:', error);

    appendMessage('Error initializing chat. Please try again later.', 'bot');
  }
}

main();
