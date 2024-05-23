import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import router from './Routes/routes';
import cors from 'cors'; // Importar cors
import { obtenerProductos } from './Models/ProductosModelo';
import EventEmitter from 'events';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

const productosEmitter = new EventEmitter();
const clientesLongPolling = new Set();

app.use(cors()); // Usar cors
app.use(bodyParser.json());

app.use('/api', router);

app.get('/api/productos', async (req, res) => {
  const productos = await obtenerProductos();
  res.status(200).json(productos);
});

// Short Polling
app.get('/api/short-polling', async (req, res) => {
  console.log("solicitud recibida");
  const productos = await obtenerProductos();
  res.status(200).json(productos);
});

// Long Polling
app.get('/api/long-polling', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');

  const clientId = Date.now();
  clientesLongPolling.add(clientId);

  req.on('close', () => {
    clientesLongPolling.delete(clientId);
    console.log(`Cliente ${clientId} desconectado`);
  });

  productosEmitter.once(`actualizacion-${clientId}`, async () => {
    const productos = await obtenerProductos();
    res.write(`data: ${JSON.stringify(productos)}\n\n`);
  });
});

export const notificarActualizacionProductos = async () => {
  const productos = await obtenerProductos();
  clientesLongPolling.forEach((clientId) => {
    productosEmitter.emit(`actualizacion-${clientId}`, productos);
  });
};

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// WebSocket
wss.on('connection', (ws) => {
  console.log('Cliente conectado');

  ws.on('message', (message) => {
    console.log('Mensaje recibido:', message);
    ws.send('Mensaje recibido');
  });

  ws.on('close', () => {
    console.log('Cliente desconectado');
  });
});

server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
