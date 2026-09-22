# Thai Chess Arena

แอปเล่นหมากรุกไทย (Makruk) และหมากรุกสากลแบบสองคนออนไลน์

## เริ่มใช้งาน

1. ติดตั้ง Node.js 20+ และ MongoDB
2. คัดลอก `server/.env.example` เป็น `server/.env` แล้วตั้งค่า `MONGODB_URI`
3. รัน `npm install`
4. รัน `npm run dev`

หน้าเว็บ: `http://localhost:5173` · API: `http://localhost:5000`

ผู้เล่นคนแรกสร้างห้องและส่งรหัสห้องให้คู่แข่ง จากนั้นการเดินหมากจะซิงก์แบบเรียลไทม์ผ่าน Socket.IO
