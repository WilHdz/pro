import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import router from './Routes/routes';
import cors from 'cors'; 
import { obtenerProductos, crearProducto } from './Models/ProductosModelo'; // Importa las funciones relacionadas con los productos
import { obtenerTransacciones, crearTransaccion } from './Models/TransaccionesModelo'; // Importa las funciones relacionadas con las transacciones
import EventEmitter from 'events';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

const productosEmitter = new EventEmitter();
const clientesLongPolling = new Set();

app.use(cors()); 
app.use(bodyParser.json());

app.use('/api', router);

// Rutas para productos

// Obtener todos los productos
app.get('/api/productos', async (req, res) => {
  const productos = await obtenerProductos();
  res.status(200).json(productos);
});

// Crear un nuevo producto
app.post('/api/productos', async (req, res) => {
  const { nombre, descripcion, precio, cantidad } = req.body;
  try {
    await crearProducto({ nombre, descripcion, precio, cantidad });
    res.status(201).json({ message: 'Producto creado exitosamente' });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// Rutas para transacciones

// Obtener todas las transacciones
app.get('/api/transacciones', async (req, res) => {
  const transacciones = await obtenerTransacciones();
  res.status(200).json(transacciones);
});

// Crear una nueva transacción
app.post('/api/transacciones', async (req, res) => {
  const { tipo, id_producto, cantidad } = req.body;
  try {
    await crearTransaccion({ tipo, id_producto, cantidad });
    res.status(201).json({ message: 'Transacción creada exitosamente' });
  } catch (error) {
    console.error('Error al crear transacción:', error);
    res.status(500).json({ error: 'Error al crear transacción' });
  }
});

// Short Polling
app.get('/api/short-polling', async (req, res) => {
  console.log("solicitud recibida short-polling");
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

server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

wss.on('connection', (ws) => {
  console.log('Cliente conectado');

  ws.on('message', (data) => {
    const dataJson = JSON.parse(data.toString());

    switch (dataJson.action) {
      case 'getProductos':
        obtenerProductos().then(productos => {
          ws.send(JSON.stringify({ event: 'getProductos', data: productos }));
        }).catch(error => {
          console.error('Error al obtener productos:', error);
          ws.send(JSON.stringify({ error: 'Error al obtener productos' }));
        });
        break;
      case 'createProducto':
        const { nombre, descripcion, precio, cantidad } = dataJson.data;
        crearProducto({ nombre, descripcion, precio, cantidad }).then(() => {
          obtenerProductos().then(productos => {
            ws.send(JSON.stringify({ event: 'productoCreado', data: productos }));
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ event: 'productoCreado', data: productos }));
              }
            });
          }).catch(error => {
            console.error('Error al obtener productos:', error);
            ws.send(JSON.stringify({ error: 'Error al obtener productos' }));
          });
        }).catch(error => {
          console.error('Error al crear producto:', error);
          ws.send(JSON.stringify({ error: 'Error al crear producto' }));
        });
        break;
      default:
        ws.send(JSON.stringify({ error: 'Acción no válida' }));
    }
  });

  ws.on('close', () => {
    console.log('Cliente desconectado');
  });
});
