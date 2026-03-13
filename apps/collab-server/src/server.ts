import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

const PORT = parseInt(process.env.PORT ?? '4002', 10);

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws, req) => {
  // The room name (docId) comes from the URL path, e.g. ws://localhost:4002/my-doc-id
  const roomName = req.url?.slice(1)?.split('?')[0] ?? 'default';
  console.log(`[collab-server] client connected to room: ${roomName}`);

  ws.on('close', () => {
    console.log(`[collab-server] client disconnected from room: ${roomName}`);
  });

  // y-websocket handles the Yjs sync protocol
  setupWSConnection(ws, req, { docName: roomName });
});

console.log(`[collab-server] listening on ws://localhost:${PORT}`);
