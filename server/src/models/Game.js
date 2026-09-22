import mongoose from 'mongoose';

const gameSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true },
  variant: { type: String, enum: ['makruk', 'chess'], default: 'makruk' },
  timeControl: { type: Number, enum: [5, 10, 15], default: 10 },
  whiteTime: { type: Number, required: true },
  blackTime: { type: Number, required: true },
  turnStartedAt: { type: Date, default: null },
  board: { type: [[String]], required: true },
  turn: { type: String, enum: ['white', 'black'], default: 'white' },
  status: { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' },
  moves: [{ from: String, to: String, piece: String, captured: String, at: Date }]
}, { timestamps: true });

export default mongoose.model('Game', gameSchema);
