const sdk = require('matrix-js-sdk');
global.Olm = require('olm');
const { LocalStorage } = require('node-localstorage');
const localStorage = new LocalStorage('./scratch');
const {
  LocalStorageCryptoStore,
} = require('matrix-js-sdk/lib/crypto/store/localStorage-crypto-store');

const vfile = require('to-vfile');
const unified = require('unified');
const remarkParse = require('remark-parse');
const remarkHtml = require('remark-html');
const emoji = require('remark-emoji');

// hide all matrix client output
console.error = (error) => console.log('❌ error: ', error);
process.stderr.write = () => {};
process.stdout.write = () => {};


function createClient(context, room, message) {
  const server = context.env.MATRIX_SERVER;
  const token = context.env.MATRIX_TOKEN;
  const deviceId = context.env.MATRIX_DEVICE_ID;
  const userId = context.env.MATRIX_USER_ID;

  const client = sdk.createClient({
    baseUrl: server,
    accessToken: token,
    userId,
    deviceId,
    sessionStore: new sdk.WebStorageSessionStore(localStorage),
    cryptoStore: new LocalStorageCryptoStore(localStorage),
  });

  client.on('sync', async function(state, prevState, res) {
    if (state !== 'PREPARED') return;
    client.setGlobalErrorOnUnknownDevices(false);
    try {
      await client.joinRoom(room);
      await client.sendEvent(
        room,
        'm.room.message',
        {
          msgtype: 'm.text',
          format: 'org.matrix.custom.html',
          body: message,
          formatted_body: message,
        },
        '',
      );
    } catch (error) {
      console.error('Job failed: ' + error.message);
    }
    client.stopClient();
    process.exit(0);
  });

  return client;
}

async function markdownToHtml(messageAsMarkdown) {
  const file = await unified()
    .use(emoji)
    .use(remarkParse)
    .use(remarkHtml)
    .process(await vfile({ path: 'test.md', contents: messageAsMarkdown}));
  console.log({file});
  return String(file);
}

async function sendMatrixMessage(contextArg, messageAsMarkdown, roomId) {
  const messageAsHtml = await markdownToHtml(messageAsMarkdown);
  const client = createClient(contextArg, roomId, messageAsHtml);
  await client.initCrypto();
  await client.startClient({ initialSyncLimit: 1 });
}

module.exports = {
  sendMatrixMessage,
};
