import 'dotenv/config';
import bcrypt from 'bcryptjs';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import Game from './models/Game.js';
import User from './models/User.js';

const app = express();
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' } });
const jwtSecret = process.env.JWT_SECRET || 'change-this-secret-in-production';
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/thai-chess-arena';
let databaseConnection;

const connectDatabase = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  databaseConnection ??= mongoose.connect(mongoUri).catch(err => {
    databaseConnection = undefined;
    throw err;
  });
  return databaseConnection;
};

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(async (_req, _res, next) => {
  try { await connectDatabase(); next(); } catch (err) { next(err); }
});

const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email });
const createToken = (user) => jwt.sign({ sub: user._id.toString(), email: user.email }, jwtSecret, { expiresIn: '7d' });

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้' });
    req.user = user;
    next();
  } catch { res.status(401).json({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }); }
};

const initialBoard = (variant) => {
  const back = variant === 'makruk' ? ['r','n','b','q','k','b','n','r'] : ['r','n','b','q','k','b','n','r'];
  return [back, Array(8).fill('p'), ...Array.from({ length: 4 }, () => Array(8).fill('')), Array(8).fill('P'), back.map(x => x.toUpperCase())];
};
const roomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

app.get('/', (_req, res) => res.json({ name: 'Thai Chess Arena API', status: 'ok', frontend: 'http://localhost:5174' }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
    if (password.length < 6) return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/api/games', async (req, res, next) => {
  try {
    const variant = req.body.variant === 'chess' ? 'chess' : 'makruk';
    const timeControl = [5, 10, 15].includes(Number(req.body.timeControl)) ? Number(req.body.timeControl) : 10;
    let code = roomCode(); while (await Game.exists({ roomCode: code })) code = roomCode();
    const seconds = timeControl * 60;
    const game = await Game.create({ roomCode: code, variant, timeControl, whiteTime: seconds, blackTime: seconds, board: initialBoard(variant) });
    res.status(201).json(game);
  } catch (err) { next(err); }
});
app.get('/api/games/:roomCode', async (req, res, next) => {
  try { const game = await Game.findOne({ roomCode: req.params.roomCode.toUpperCase() }); if (!game) return res.status(404).json({ message: 'ไม่พบห้องเกม' }); res.json(game); } catch (err) { next(err); }
});
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'รูปแบบข้อมูล JSON ไม่ถูกต้อง' });
  }
  next(err);
});
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' }); });

io.on('connection', socket => {
  socket.on('room:join', async ({ roomCode }) => {
    const game = await Game.findOne({ roomCode: roomCode?.toUpperCase() });
    if (!game) return socket.emit('game:error', 'ไม่พบห้องเกม');
    if (!Number.isFinite(game.whiteTime) || !Number.isFinite(game.blackTime)) {
      const seconds = game.timeControl * 60;
      game.whiteTime = seconds;
      game.blackTime = seconds;
    }
    if (game.status === 'playing' && !game.turnStartedAt) game.turnStartedAt = new Date();
    socket.join(game.roomCode); socket.emit('game:sync', game);
    if (game.status === 'waiting') { game.status = 'playing'; game.turnStartedAt = new Date(); await game.save(); io.to(game.roomCode).emit('game:sync', game); }
  });
  socket.on('game:move', async ({ roomCode, board, turn, move }) => {
    const game = await Game.findOne({ roomCode: roomCode?.toUpperCase(), turn });
    if (game && game.turnStartedAt) {
      const elapsed = Math.floor((Date.now() - game.turnStartedAt.getTime()) / 1000);
      const currentTime = game[`${turn}Time`] - elapsed;
      if (currentTime <= 0) { game[`${turn}Time`] = 0; game.status = 'finished'; await game.save(); io.to(game.roomCode).emit('game:sync', game); return; }
      game[`${turn}Time`] = currentTime;
    }
    if (game) { game.board = board; game.turn = turn === 'white' ? 'black' : 'white'; game.turnStartedAt = new Date(); game.moves.push({ ...move, at: new Date() }); await game.save(); }
    if (!game) return socket.emit('game:error', 'ตาเดินไม่ถูกต้องหรือห้องหมดอายุ');
    io.to(game.roomCode).emit('game:sync', game);
  });
});

export { app };
export default app;

if (isMain) {
  connectDatabase()
    .then(() => httpServer.listen(process.env.PORT || 3000, () => console.log('API ready on port 3000')))
    .catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
}
