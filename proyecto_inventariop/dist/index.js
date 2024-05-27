"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws"));
const dotenv_1 = __importDefault(require("dotenv"));
const routes_1 = __importDefault(require("./Routes/routes"));
const ProductosModelo_1 = require("./Models/ProductosModelo");
const events_1 = __importDefault(require("events"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const wss = new ws_1.default.Server({ server });
const PORT = process.env.PORT || 3000;
const productosEmitter = new events_1.default();
const clientesLongPolling = new Set();
app.use(body_parser_1.default.json());
app.use('/api', routes_1.default);
app.get('/api/productos', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const productos = yield (0, ProductosModelo_1.obtenerProductos)();
    res.status(200).json(productos);
}));
// Short Polling
app.get('/api/short-polling', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("solicitud recibida");
    const productos = yield (0, ProductosModelo_1.obtenerProductos)();
    res.status(200).json(productos);
}));
// Long Polling
app.get('/api/long-polling', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');
    const clientId = Date.now();
    clientesLongPolling.add(clientId);
    req.on('close', () => {
        clientesLongPolling.delete(clientId);
        console.log(`Cliente ${clientId} desconectado`);
    });
    productosEmitter.once(`actualizacion-${clientId}`, () => __awaiter(void 0, void 0, void 0, function* () {
        const productos = yield (0, ProductosModelo_1.obtenerProductos)();
        res.write(`data: ${JSON.stringify(productos)}\n\n`);
    }));
}));
const notificarActualizacionProductos = () => __awaiter(void 0, void 0, void 0, function* () {
    const productos = yield (0, ProductosModelo_1.obtenerProductos)();
    clientesLongPolling.forEach((clientId) => {
        productosEmitter.emit(`actualizacion-${clientId}`, productos);
    });
});
const actualizarProductos = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, ProductosModelo_1.crearProducto)({ nombre: 'Nuevo Producto', precio: 100, cantidad: 5 });
    notificarActualizacionProductos();
});
// actualizarProductos(); // Descomentar esta línea para probar la actualización de productos
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
