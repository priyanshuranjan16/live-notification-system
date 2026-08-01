const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const next = require('next');
const cors = require('cors');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3000;

let cronLogs = [];

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);

  // Setup Socket.IO
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    },
  });

  server.use(cors());
  server.use(express.json());

  // Socket.IO Room Connection
  io.on('connection', (socket) => {
    console.log('Client connected to Socket.IO:', socket.id);

    // Register user in private room
    socket.on('join_user_room', (userId) => {
      if (userId) {
        const room = `user:${userId}`;
        socket.join(room);
        console.log(`Socket ${socket.id} joined room ${room}`);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Background Cron Job (Runs every 30 minutes for follow-up reminders)
  cron.schedule('0 */30 * * * *', async () => {
    try {
      console.log('[CRON WORKER] Running scheduled follow-up reminder check...');
      
      // Find assignments with users
      const assignments = await prisma.assignment.findMany({
        include: {
          user: true,
          company: true,
          contact: true,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      if (assignments.length === 0) {
        const logMsg = `[CRON WORKER ${new Date().toLocaleTimeString()}] No assignments found to generate reminders.`;
        cronLogs.unshift({ timestamp: new Date().toISOString(), message: logMsg, status: 'IDLE' });
        if (cronLogs.length > 20) cronLogs.pop();
        return;
      }

      // Pick a random assignment to generate a periodic reminder
      const randomAssignment = assignments[Math.floor(Math.random() * assignments.length)];
      const targetUser = randomAssignment.user;
      const targetName = randomAssignment.company 
        ? randomAssignment.company.name 
        : randomAssignment.contact ? randomAssignment.contact.name : 'CRM Account';

      const title = '⏰ Scheduled Follow-Up Reminder';
      const message = `Automated system check: Please review your assigned item "${targetName}" (${randomAssignment.role}).`;

      // Save notification to PostgreSQL database
      const newNotification = await prisma.notification.create({
        data: {
          userId: targetUser.id,
          title,
          message,
          type: 'CRON_REMINDER',
        },
      });

      // Target live Socket.IO delivery strictly to assigned user's room
      io.to(`user:${targetUser.id}`).emit('notification:new', newNotification);

      const logMsg = `[CRON WORKER] Reminder sent to ${targetUser.name} for "${targetName}"`;
      console.log(logMsg);
      cronLogs.unshift({
        timestamp: new Date().toISOString(),
        message: logMsg,
        status: 'SUCCESS',
        targetUser: targetUser.name,
        targetItem: targetName,
      });
      if (cronLogs.length > 20) cronLogs.pop();
    } catch (err) {
      console.error('[CRON ERROR]', err);
    }
  });

  // REST API Routes

  // Users
  server.get('/api/users', async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
      });
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/users', async (req, res) => {
    try {
      const { name, email, role } = req.body;
      const newUser = await prisma.user.create({
        data: { name, email, role: role || 'AGENT' },
      });
      res.status(201).json(newUser);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Companies
  server.get('/api/companies', async (req, res) => {
    try {
      const companies = await prisma.company.findMany({
        include: {
          contacts: true,
          assignments: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(companies);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/companies', async (req, res) => {
    try {
      const { name, industry, website } = req.body;
      const company = await prisma.company.create({
        data: { name, industry, website },
      });
      res.status(201).json(company);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  server.delete('/api/companies/:id', async (req, res) => {
    try {
      await prisma.company.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Contacts
  server.get('/api/contacts', async (req, res) => {
    try {
      const contacts = await prisma.contact.findMany({
        include: {
          company: true,
          assignments: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(contacts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  server.post('/api/contacts', async (req, res) => {
    try {
      const { name, email, phone, companyId } = req.body;
      const contact = await prisma.contact.create({
        data: { name, email, phone, companyId: companyId || null },
      });
      res.status(201).json(contact);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  server.delete('/api/contacts/:id', async (req, res) => {
    try {
      await prisma.contact.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Role-Based Assignments (Triggers real-time notification)
  server.post('/api/assignments', async (req, res) => {
    try {
      const { userId, companyId, contactId, role } = req.body;

      if (!userId || (!companyId && !contactId)) {
        return res.status(400).json({ error: 'userId and companyId or contactId are required' });
      }

      // Create Assignment record
      const assignment = await prisma.assignment.create({
        data: {
          userId,
          companyId: companyId || null,
          contactId: contactId || null,
          role: role || 'ACCOUNT_OWNER',
        },
        include: {
          user: true,
          company: true,
          contact: true,
        },
      });

      // Format clean notification title & text
      const targetName = assignment.company 
        ? assignment.company.name 
        : assignment.contact.name;
      const itemType = assignment.company ? 'Company' : 'Contact';
      const formattedRole = (role || 'ACCOUNT_OWNER').replace('_', ' ');

      const notificationTitle = `🎯 New Assignment: ${targetName}`;
      const notificationMessage = `You have been assigned to ${itemType} "${targetName}" as ${formattedRole}.`;

      // Save notification to PostgreSQL DB
      const notification = await prisma.notification.create({
        data: {
          userId,
          title: notificationTitle,
          message: notificationMessage,
          type: 'ASSIGNMENT',
        },
      });

      // REAL-TIME DELIVERY: Emit live notification strictly to target user's socket room
      io.to(`user:${userId}`).emit('notification:new', notification);

      res.status(201).json({ assignment, notification });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Notifications
  server.get('/api/notifications', async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: 'userId parameter is required' });

      const notifications = await prisma.notification.findMany({
        where: { userId: String(userId) },
        orderBy: { createdAt: 'desc' },
      });

      const unreadCount = await prisma.notification.count({
        where: { userId: String(userId), isRead: false },
      });

      res.json({ notifications, unreadCount });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  server.patch('/api/notifications/:id/read', async (req, res) => {
    try {
      const updated = await prisma.notification.update({
        where: { id: req.params.id },
        data: { isRead: true },
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  server.patch('/api/notifications/read-all', async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId is required' });

      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Background Cron status
  server.get('/api/cron/status', (req, res) => {
    res.json({
      status: 'ACTIVE',
      schedule: 'Every 45 seconds',
      logs: cronLogs,
    });
  });

  // Next.js page handler fallback
  server.all('{*path}', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> CRM App with Socket.IO running on http://localhost:${PORT}`);
  });
});
