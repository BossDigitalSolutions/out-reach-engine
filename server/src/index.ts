import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import leadsRoutes from './routes/leads';
import scraperRoutes from './routes/scraper';
import emailsRoutes from './routes/emails';
import templatesRoutes from './routes/templates';
import demosRoutes from './routes/demos';
import analyticsRoutes from './routes/analytics';
import settingsRoutes from './routes/settings';
import revenueRoutes from './routes/revenue';
import whatsAppRoutes from './routes/whatsapp';
import ghlRoutes from './routes/ghl';
import teamRoutes from './routes/team';
import activityLogRoutes from './routes/activityLog';
import sessionsRoutes from './routes/sessions';
import twoFactorRoutes from './routes/twoFactor';
import { startScheduler } from './services/scheduler';

dotenv.config();

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        process.env.CLIENT_URL,
        'http://localhost:5173',
      ].filter(Boolean);
      if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limit: 100 requests per 15 min per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  })
);

// Login: 5 attempts per 15 min
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// Email sending: 50 per hour
const emailSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: { error: 'Email send rate limit reached. Try again in an hour.' },
});

// WhatsApp sending: 50 per hour
const whatsappSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: { error: 'WhatsApp send rate limit reached. Try again in an hour.' },
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/emails/:id/send-now', emailSendLimiter);
app.use('/api/emails', emailsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/demos', demosRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/whatsapp/send', whatsappSendLimiter);
app.use('/api/whatsapp', whatsAppRoutes);
app.use('/api/ghl', ghlRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/activity-log', activityLogRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/2fa', twoFactorRoutes);

// Unsubscribe route (public)
app.get('/unsubscribe/:token', async (req, res) => {
  try {
    const email = await prisma.email.findUnique({
      where: { unsubscribeToken: req.params.token },
      include: { lead: true },
    });
    if (!email) {
      return res.status(404).send('<h1>Invalid unsubscribe link</h1>');
    }
    await prisma.lead.update({
      where: { id: email.leadId },
      data: { unsubscribed: true },
    });
    res.send(
      '<h1>You have been unsubscribed.</h1><p>You will no longer receive emails from us.</p>'
    );
  } catch (err) {
    res.status(500).send('<h1>Something went wrong. Please try again.</h1>');
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function main() {
  await prisma.$connect();
  console.log('Database connected');
  startScheduler();
  app.listen(PORT, () => {
    console.log(`OutreachEngine server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
