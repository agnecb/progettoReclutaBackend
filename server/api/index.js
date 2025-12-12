// ok
// Mega router con all'interno i sotto router
// --> i file js contengono la logica delle routes, poi vengono montate qui nel router e verranno esposte queste routes
import { Router } from 'express';

// Importazione dei sotto-router (che implementeremo nei prossimi passi)
import authRouter from './auth.js'; 
import healthRouter from './health.js';
import usersRouter from './users.js';
import postsRouter from './posts.js';
import commentsRouter from './comments.js';
import likesRouter from './likes.js';
import passport from 'passport';
import { initializePassport } from '../auth/passport.js';

initializePassport(passport);

// Crea il router principale chiamato "API" che verrà montato su /api in app.js
export const api = Router();
api.use(passport.initialize());

// --- Montaggio dei Sotto-Router ---
// 1. Health Check (GET /healthz)
// Nota: Montato direttamente sulla radice /api, senza prefisso.
api.use(healthRouter); 

// 2. Autenticazione (/auth)
api.use('/auth', authRouter);

// 3. Utenti (/users)
api.use('/users', usersRouter);

// 4. Post (/posts)
api.use('/posts', postsRouter);

// 5. Commenti (/comments)
api.use('/comments', commentsRouter);

// 6. Like (/likes)
api.use('/likes', likesRouter);

export default api;