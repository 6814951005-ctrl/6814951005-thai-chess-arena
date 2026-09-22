import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './styles.css';
import './game.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
const pieceSymbols = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟', K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' };
const pieceNames = { k: 'ขุนดำ', q: 'เม็ดดำ', r: 'เรือดำ', b: 'โคนดำ', n: 'ม้าดำ', p: 'เบี้ยดำ', K: 'ขุนขาว', Q: 'เม็ดขาว', R: 'เรือขาว', B: 'โคนขาว', N: 'ม้าขาว', P: 'เบี้ยขาว' };

const isWhite = (piece) => piece === piece.toUpperCase();
const pathClear = (board, fromRow, fromColumn, toRow, toColumn) => {
  const rowStep = Math.sign(toRow - fromRow);
  const columnStep = Math.sign(toColumn - fromColumn);
  let row = fromRow + rowStep;
  let column = fromColumn + columnStep;
  while (row !== toRow || column !== toColumn) {
    if (board[row][column]) return false;
    row += rowStep;
    column += columnStep;
  }
  return true;
};
const legalMove = (board, fromRow, fromColumn, toRow, toColumn, variant) => {
  const piece = board[fromRow][fromColumn];
  const target = board[toRow][toColumn];
  if (!piece || (target && isWhite(piece) === isWhite(target))) return false;
  const rowDistance = Math.abs(toRow - fromRow);
  const columnDistance = Math.abs(toColumn - fromColumn);
  const type = piece.toLowerCase();
  if (type === 'n') return (rowDistance === 2 && columnDistance === 1) || (rowDistance === 1 && columnDistance === 2);
  if (type === 'k') return rowDistance <= 1 && columnDistance <= 1 && rowDistance + columnDistance > 0;
  if (type === 'r') return (fromRow === toRow || fromColumn === toColumn) && pathClear(board, fromRow, fromColumn, toRow, toColumn);
  if (type === 'b') return rowDistance === columnDistance && pathClear(board, fromRow, fromColumn, toRow, toColumn);
  if (type === 'q') return (rowDistance === columnDistance || fromRow === toRow || fromColumn === toColumn) && pathClear(board, fromRow, fromColumn, toRow, toColumn);
  if (type === 'p') {
    const direction = isWhite(piece) ? -1 : 1;
    const startRow = isWhite(piece) ? 6 : 1;
    if (columnDistance === 0 && !target && toRow - fromRow === direction) return true;
    if (columnDistance === 1 && rowDistance === 1 && target && toRow - fromRow === direction) return true;
    return variant === 'chess' && columnDistance === 0 && !target && fromRow === startRow && toRow - fromRow === direction * 2 && !board[fromRow + direction][fromColumn];
  }
  return false;
};

function GameBoard({ initialGame, onBack }) {
  const [game, setGame] = useState(initialGame);
  const [selected, setSelected] = useState(null);
  const [moveError, setMoveError] = useState('');
  const [now, setNow] = useState(Date.now());
  const socket = useState(() => io(SOCKET_URL))[0];

  useEffect(() => {
    socket.emit('room:join', { roomCode: initialGame.roomCode });
    socket.on('game:sync', setGame);
    return () => socket.disconnect();
  }, [socket, initialGame.roomCode]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const secondsLeft = (color) => {
    const base = game[`${color}Time`] ?? game.timeControl * 60;
    if (game.status !== 'playing' || !game.turnStartedAt || game.turn !== color) return Math.max(0, base);
    return Math.max(0, base - Math.floor((now - new Date(game.turnStartedAt).getTime()) / 1000));
  };
  const formatClock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const captured = game.moves.reduce((pieces, move) => {
    if (move.captured) pieces.push(move.captured);
    return pieces;
  }, []);
  const remaining = game.board.flat().filter(Boolean);
  const movePiece = (row, column) => {
    const piece = game.board[row][column];
    if (!selected) {
      if (piece && isWhite(piece) === (game.turn === 'white')) { setMoveError(''); setSelected({ row, column }); }
      else if (piece) setMoveError(`ตอนนี้เป็นตาของ${game.turn === 'white' ? 'ขาว' : 'ดำ'}`);
      return;
    }
    if (selected.row === row && selected.column === column) { setSelected(null); return; }
    if (!legalMove(game.board, selected.row, selected.column, row, column, game.variant)) { setMoveError('การเดินนี้ไม่ถูกต้องตามกติกาของหมาก'); setSelected(null); return; }
    setMoveError('');
    const nextBoard = game.board.map((boardRow) => [...boardRow]);
    const capturedPiece = nextBoard[row][column];
    const movingPiece = nextBoard[selected.row][selected.column];
    nextBoard[row][column] = movingPiece;
    nextBoard[selected.row][selected.column] = '';
    socket.emit('game:move', { roomCode: game.roomCode, board: nextBoard, turn: game.turn, move: { from: `${selected.row},${selected.column}`, to: `${row},${column}`, piece: movingPiece, captured: capturedPiece || '' } });
    setSelected(null);
  };

  const groupedCaptured = ['P', 'N', 'B', 'R', 'Q', 'K', 'p', 'n', 'b', 'r', 'q', 'k'].map((piece) => ({ piece, count: captured.filter((capturedPiece) => capturedPiece === piece).length })).filter(({ count }) => count > 0);
    return <main className="game-shell"><header className="game-header"><button className="back-button" onClick={onBack}>← ล็อบบี้</button><div className="game-title"><span>{game.variant === 'makruk' ? 'หมากรุกไทย' : 'หมากรุกสากล'}</span><strong>ห้อง {game.roomCode}</strong></div><div className="turn-status">ตาเดิน: <b>{game.turn === 'white' ? 'ขาว' : 'ดำ'}</b></div></header><section className="game-layout"><aside className="captured-panel"><p className="card-kicker">หมากที่ถูกกิน</p><h2>สถิติการเล่น</h2><div className="stat-row"><span>บนกระดาน</span><strong>{remaining.length} ตัว</strong></div><div className="stat-row"><span>ถูกกินแล้ว</span><strong>{captured.length} ตัว</strong></div><div className="captured-list">{groupedCaptured.length ? groupedCaptured.map(({ piece, count }) => <span key={piece} title={pieceNames[piece]}>{pieceSymbols[piece]}<small>×{count}</small></span>) : <p>ยังไม่มีหมากถูกกิน</p>}</div></aside><div className="board-wrap"><div className="board-label">คลิกหมาก แล้วคลิกช่องปลายทาง</div><div className="chessboard" role="grid">{game.board.map((row, rowIndex) => row.map((piece, columnIndex) => <button type="button" role="gridcell" aria-label={piece ? pieceNames[piece] : 'ช่องว่าง'} className={`board-square ${(rowIndex + columnIndex) % 2 ? 'dark-square' : 'light-square'} ${selected?.row === rowIndex && selected?.column === columnIndex ? 'selected-square' : ''}`} onClick={() => movePiece(rowIndex, columnIndex)} key={`${rowIndex}-${columnIndex}`}>{piece && <span className={piece === piece.toUpperCase() ? 'white-piece' : 'black-piece'}>{pieceSymbols[piece]}</span>}</button>))}</div></div><aside className="captured-panel side-summary"><p className="card-kicker">เวลาแข่ง</p><div className={`clock ${game.turn === 'white' ? 'active-clock' : ''}`}>ขาว {formatClock(secondsLeft('white'))}</div><div className={`clock ${game.turn === 'black' ? 'active-clock' : ''}`}>ดำ {formatClock(secondsLeft('black'))}</div><p>{game.status === 'playing' ? 'เวลาจะลดตามตาเดิน' : 'รอผู้เล่นเข้าร่วม'}</p><div className="move-count">เดินหมากแล้ว <strong>{game.moves.length}</strong> ครั้ง</div></aside></section></main>;
}

function Lobby({ user, logout }) {
  const [roomCode, setRoomCode] = useState('');
  const [variant, setVariant] = useState('makruk');
  const [timeControl, setTimeControl] = useState(10);
  const [createdRoom, setCreatedRoom] = useState(null);
    const [activeGame, setActiveGame] = useState(null);
  const [error, setError] = useState('');
    if (activeGame) return <GameBoard initialGame={activeGame} onBack={() => setActiveGame(null)} />;

  const createRoom = async () => {
    setError('');
    try {
      const response = await fetch(`${API_URL}/games`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variant, timeControl })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'สร้างห้องไม่สำเร็จ');
      setCreatedRoom(data);
      setActiveGame(data);
    } catch (requestError) { setError(requestError instanceof TypeError ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' : requestError.message); }
  };

  const joinRoom = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const response = await fetch(`${API_URL}/games/${roomCode.trim().toUpperCase()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'ไม่พบห้องเกม');
      setCreatedRoom(data);
      setActiveGame(data);
    } catch (requestError) { setError(requestError instanceof TypeError ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' : requestError.message); }
  };

  return <main className="lobby-shell"><header className="lobby-header"><div className="brand"><div className="mark">♞</div><span>THAI CHESS ARENA</span></div><div className="account"><span>{user.name}</span><button onClick={logout}>ออกจากระบบ</button></div></header><section className="lobby-content"><div><p className="eyebrow">สนามประลองของคุณ</p><h1>พร้อมสำหรับ<br /><em>การเดินหมาก</em> หรือยัง?</h1><p className="muted">สร้างห้องใหม่หรือเข้าร่วมเกมด้วยรหัสจากคู่แข่ง</p></div><div className="room-grid"><article className="room-card featured"><p className="card-kicker">เริ่มเกมใหม่</p><h2>สร้างห้อง</h2><p>เลือกประเภทเกมและเวลาแข่ง แล้วส่งรหัสให้คู่แข่งของคุณ</p><div className="variant-tabs"><button className={variant === 'makruk' ? 'active' : ''} onClick={() => setVariant('makruk')}>หมากรุกไทย</button><button className={variant === 'chess' ? 'active' : ''} onClick={() => setVariant('chess')}>หมากรุกสากล</button></div><div className="time-control"><span>เวลาเดินหมากต่อคน</span><div>{[5, 10, 15].map((minutes) => <button type="button" key={minutes} className={timeControl === minutes ? 'active' : ''} onClick={() => setTimeControl(minutes)}>{minutes} นาที</button>)}</div></div><button className="submit" onClick={createRoom}>สร้างห้องใหม่ <span>→</span></button>{createdRoom && <div className="room-result"><small>รหัสห้องของคุณ · {createdRoom.timeControl} นาที/คน</small><strong>{createdRoom.roomCode}</strong></div>}</article><article className="room-card"><p className="card-kicker">มีรหัสอยู่แล้ว?</p><h2>เข้าร่วมห้อง</h2><p>กรอกรหัสห้องเพื่อดูเกมและเข้าร่วมการแข่งขัน</p><form onSubmit={joinRoom}><input value={roomCode} onChange={(event) => setRoomCode(event.target.value)} placeholder="เช่น A1B2C3" maxLength="6" required /><button className="submit">เข้าร่วมห้อง <span>→</span></button></form></article></div>{error && <p className="error lobby-error" role="alert">{error}</p>}</section></main>;
}

function App() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('thai-chess-user') || 'null'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const responseText = await response.text();
      let data = {};
      if (responseText) {
        try { data = JSON.parse(responseText); }
        catch { throw new Error(`เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON (HTTP ${response.status})`); }
      }
      if (!response.ok) throw new Error(data.message || 'ไม่สามารถดำเนินการได้');
      localStorage.setItem('thai-chess-token', data.token);
      localStorage.setItem('thai-chess-user', JSON.stringify(data.user));
      setUser(data.user);
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาเปิด MongoDB และรัน npm run dev ใหม่'
        : requestError.message);
    }
    finally { setLoading(false); }
  };

  const logout = () => { localStorage.removeItem('thai-chess-token'); localStorage.removeItem('thai-chess-user'); setUser(null); };

  if (user) return <Lobby user={user} logout={logout} />;

  return <main className="shell"><section className="visual"><div className="brand"><div className="mark">♞</div><span>THAI CHESS ARENA</span></div><div className="visual-copy"><p className="eyebrow">เล่นอย่างมีชั้นเชิง</p><h1>ทุกการเดิน<br /><em>มีความหมาย</em></h1><p>เข้าสู่สนามประลองหมากรุกไทยของคุณ</p></div><div className="mini-board" aria-hidden="true">{['♜','♞','♝','♚','♝','♞','♜','♟','♟','♟','♟','♟','♟','♟','♟','♙','♙','♙','♙','♙','♙','♙','♙','♖','♘','♗','♕','♔','♗','♘','♖'].map((piece, index) => <span className={Math.floor(index / 8) % 2 === index % 2 ? 'light' : 'dark'} key={`${piece}-${index}`}>{piece}</span>)}</div></section><section className="auth-panel"><div className="auth-heading"><p className="eyebrow">บัญชีผู้เล่น</p><h2>{mode === 'login' ? 'กลับเข้าสู่เกม' : 'สร้างบัญชีใหม่'}</h2><p className="muted">{mode === 'login' ? 'เข้าสู่ระบบเพื่อจัดการเกมและห้องของคุณ' : 'เริ่มต้นเส้นทางนักวางกลยุทธ์ของคุณ'}</p></div><div className="tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>เข้าสู่ระบบ</button><button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>สมัครสมาชิก</button></div><form onSubmit={submit}>{mode === 'register' && <label>ชื่อผู้เล่น<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="เช่น นที" required /></label>}<label>อีเมล<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" required /></label><label>รหัสผ่าน<input type="password" minLength="6" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="อย่างน้อย 6 ตัวอักษร" required /></label>{error && <p className="error" role="alert">{error}</p>}<button className="submit" disabled={loading}>{loading ? 'กำลังตรวจสอบ...' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี' } <span>→</span></button></form><p className="security">ข้อมูลของคุณได้รับการปกป้องด้วยการเข้ารหัสรหัสผ่าน</p></section></main>;
}

createRoot(document.getElementById('root')).render(<App />);