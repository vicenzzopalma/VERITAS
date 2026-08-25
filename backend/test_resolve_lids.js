const { default: makeWASocket, useMultiFileAuthState, Browsers, makeInMemoryStore } = require('whaileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

async function test() {
  const sessionDir = path.resolve(__dirname, '..', '.wwebjs_auth', 'session-whatsapp-4');
  console.log('Session Dir exists:', fs.existsSync(sessionDir));

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.appropriate('Desktop')
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection } = update;
    if (connection === 'open') {
      console.log('Connection open on test socket!');

      const lidsToTest = [
        '100678328430660@lid',
        '196624324255947@lid',
        '226083018379466@lid',
        '195554374115487@lid'
      ];

      console.log('Testing onWhatsApp with LIDs...');
      try {
        const onWaRes = await sock.onWhatsApp(...lidsToTest);
        console.log('onWhatsApp result:', JSON.stringify(onWaRes, null, 2));
      } catch (e) {
        console.error('onWhatsApp error:', e.message);
      }

      console.log('Testing interactiveQuery for LIDs...');
      try {
        const { getBinaryNodeChild, getBinaryNodeChildren } = require('whaileys/lib/WABinary');
        const iqRes = await (sock).query({
          tag: 'iq',
          attrs: {
            to: 's.whatsapp.net',
            type: 'get',
            xmlns: 'usync'
          },
          content: [
            {
              tag: 'usync',
              attrs: {
                sid: sock.generateMessageTag(),
                mode: 'query',
                last: 'true',
                index: '0',
                context: 'interactive'
              },
              content: [
                {
                  tag: 'query',
                  attrs: {},
                  content: [
                    { tag: 'contact', attrs: {} },
                    { tag: 'lid', attrs: {} }
                  ]
                },
                {
                  tag: 'list',
                  attrs: {},
                  content: lidsToTest.map(lid => ({
                    tag: 'user',
                    attrs: { jid: lid },
                    content: []
                  }))
                }
              ]
            }
          ]
        });

        const usyncNode = getBinaryNodeChild(iqRes, 'usync');
        const listNode = getBinaryNodeChild(usyncNode, 'list');
        const users = getBinaryNodeChildren(listNode, 'user');
        console.log('usync users response count:', users.length);
        users.forEach(u => {
          const contact = getBinaryNodeChild(u, 'contact');
          const lid = getBinaryNodeChild(u, 'lid');
          console.log('User node:', u.attrs, 'contact:', contact ? contact.attrs : null, 'lid:', lid ? lid.attrs : null);
        });
      } catch (err) {
        console.error('interactiveQuery error:', err);
      }

      process.exit(0);
    }
  });
}

test().catch(console.error);
