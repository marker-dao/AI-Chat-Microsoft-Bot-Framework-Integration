import { DirectLine } from 'botframework-directlinejs';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

const SECRET = import.meta.env.VITE_DIRECT_LINE_SECRET;
const DIRECT_LINE_DOMAIN = 'https://europe.directline.botframework.com/v3/directline';
const REGENERATION_TEXT = 'Regeneration...';
const CHAT_DISABLED_CLASS = 'dx-chat-disabled';
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const user = { id: 'user', name: 'You' };
const assistant = { id: null, name: 'Virtual Assistant' };

const EN_MESSAGES = {
  'dxChat-emptyListMessage': 'Chat is Empty',
  'dxChat-emptyListPrompt': 'AI Assistant is ready to answer your questions.',
  'dxChat-textareaPlaceholder': 'Ask AI Assistant...',
};

const connectionStatusHandlers = {
  0: () => console.warn('DirectLine connection is uninitialized.'),
  1: () => console.log('DirectLine is connecting...'),
  2: () => console.log('DirectLine connection is online!'),
  3: () => console.error('DirectLine token has expired.'),
  4: () => console.error('DirectLine failed to connect. Please check your token or domain.'),
  5: () => console.warn('DirectLine connection has ended.'),
};

const handleConnectionStatus = (status) => {
  const handler = connectionStatusHandlers[status];

  handler();
};

const fetchDirectLineToken = async (secret) => {
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

    console.log('Token received successfully!');

    return token;
  } catch (error) {
    console.error('Error fetching Direct Line token:', error);

    throw error;
  }
};

const initChatService = async () => {
  const token = await fetchDirectLineToken(SECRET);

  const directLine = new DirectLine({
    token,
    domain: DIRECT_LINE_DOMAIN,
  });

  return directLine;
};

const subscribeToChatActivities = (
  chatService,
  instance,
  textArea,
  toggleDisabledState,
  renderAssistantMessage,
) => {
  const handleMessage = (activity) => {
    const fromAssistant = activity.from.id !== user.id;

    if (activity.type === 'message' && fromAssistant) {
      instance.option({ typingUsers: [] });
      renderAssistantMessage(activity.text);
      toggleDisabledState(false, instance, textArea);
    }
  };

  const handleError = (error) => {
    console.error('Error receiving activities:', error);

    renderAssistantMessage('Error receiving messages from the assistant.');
  };

  chatService.activity$.subscribe(handleMessage, handleError);
  chatService.connectionStatus$.subscribe(handleConnectionStatus);
};

const toggleDisabledState = (disabled, instance, textArea) => {
  instance.element().toggleClass(CHAT_DISABLED_CLASS, disabled);

  disabled ? textArea?.blur() : textArea?.focus();
};

const postMessage = (
  chatService,
  instance,
  textArea,
  message,
  toggleDisabledState,
  renderAssistantMessage,
) => {
  toggleDisabledState(true, instance, textArea);

  instance.option({ typingUsers: [assistant] });

  const activity = {
    from: user,
    type: 'message',
    text: message.text,
  };

  chatService
    .postActivity(activity)
    .subscribe(
      () => console.log('Message sent successfully'),
      (error) => {
        console.error('Error sending message:', error);

        instance.option({ typingUsers: [] });
        renderAssistantMessage(`Error sending message: ${error}`);
        toggleDisabledState(false, instance, textArea);
      }
    );
};

const renderAssistantMessage = (dataSource, text) => {
  const message = {
    id: Date.now(),
    timestamp: new Date(),
    author: assistant,
    text,
  };

  dataSource.store().push([{ type: 'insert', data: message }]);
};

const emailToLink = (string) => {
  const result = string.replace(EMAIL_REGEX, (email) => {
    return `<a href="mailto:${email}">${email}</a>`;
  })

  return result;
};

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeStringify);

const convertToHtml = (value) => {
  const precessedValue = markdownProcessor
    .processSync(value)
    .toString();

  const valueWithEmailLinks = emailToLink(precessedValue);

  return valueWithEmailLinks;
};

const onCopyButtonClick = (component, text) => {
  navigator.clipboard?.writeText(text);

  component.option({ icon: 'check' });

  setTimeout(() => {
    component.option({ icon: 'copy' });
  }, 2500);
};

const renderMessageContent = (message, element) => {
  $('<div>')
    .addClass('dx-chat-messagebubble-text')
    .html(convertToHtml(message.text))
    .appendTo(element);

  const $buttonContainer = $('<div>')
    .addClass('dx-bubble-button-container');

  $('<div>')
    .dxButton({
      icon: 'copy',
      stylingMode: 'text',
      hint: 'Copy',
      onClick: ({ component }) => {
        onCopyButtonClick(component, message.text);
      },
    })
    .appendTo($buttonContainer);

  $buttonContainer.appendTo(element);
};

const createCustomStore = (store) =>
  new DevExpress.data.CustomStore({
    key: 'id',
    load: () => Promise.resolve([...store]),
    insert: (message) => new Promise((resolve) => {
      setTimeout(() => {
        store.push(message);

        resolve();
      }, 0);
    }),
  });

$(async () => {
  try {
    const store = [];

    DevExpress.localization.loadMessages({ en: EN_MESSAGES });

    const customStore = createCustomStore(store);
    const dataSource = new DevExpress.data.DataSource({
      store: customStore,
      paginate: false,
    });

    const chatService = await initChatService();

    const chatOptions = {
      user,
      height: 710,
      dataSource,
      reloadOnChange: false,
      showAvatar: false,
      showDayHeaders: false,
      onMessageEntered: (e) => {
        const { message } = e;

        dataSource.store().push([{ type: 'insert', data: { id: Date.now(), ...message } }]);

        postMessage(
          chatService,
          instance,
          textArea,
          message,
          toggleDisabledState,
          (text) => renderAssistantMessage(dataSource, text),
        );
      },
      messageTemplate: (data, element) => {
        const { message } = data;

        if (message.text === REGENERATION_TEXT) {
          element.text(REGENERATION_TEXT);
          return;
        }

        renderMessageContent(message, element);
      },
    };

    const instance = $('#dx-ai-chat').dxChat(chatOptions).dxChat('instance');
    const textArea = instance._messageBox._textArea.element();

    subscribeToChatActivities(
      chatService,
      instance,
      textArea,
      toggleDisabledState,
      (text) => renderAssistantMessage(dataSource, text),
    );
  } catch (error) {
    console.error('Failed to initialize chat:', error);
  }
});
