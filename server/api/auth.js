// ok?

/*
Ogni endpoint usa:
 - supabase per leggere/scrivere utenti
 - bcrypt per hash password
 - jwt per generare token
 - speakeasy per OTP

*/
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import speakeasy from 'speakeasy';
import { supabase } from '../db/index.js';

// creo il router per gestire le varie rotte
const router = Router();
// secret del JWT
const JWT_SECRET = process.env.JWT_SECRET || 'CYUfyitxrI576UFYDi6ukyfjcdY';
const JWT_EXPIRES_IN = '24h';

// middleware per verificare il token
const authenticateJWT = passport.authenticate('jwt', { session: false });

// registrazione utente
router.post('/register', async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
        }

        // Verifica se l'utente esiste già (evito duplicati) --> query su supabase
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .or(`email.eq.${email},username.eq.${username}`)   // ← CORRETTO
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'Email o username già in uso' });
        }


        // Hash della password con salt esplicito: genera salt, concatena password e salt e bcrypt fa l'hash
        const salt = await bcrypt.genSalt(10); // numero iterazioni
        const hashedPassword = await bcrypt.hash(password, salt);

        // Genera un OTP secret per questo utente (tramite libreria speakeasy)
        const otpSecret = speakeasy.generateSecret({ length: 20 });


        // Crea il nuovo utente (salvando anche il salt)
        const { data, error } = await supabase
            .from('users')
            .insert({
                username,
                email,
                password_hash: hashedPassword,
                salt, // AGGIUNTO IL SALT
                otp_secret: otpSecret.base32,
                bio: null
            })
            .select('*')
            .single();
        if (error) throw error;

        // Genera token JWT
        const token = jwt.sign({ id: data.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        // risposta con otp_secret e salt inclusi
        return res.status(201).json({
            user: {
                id: data.id,
                username: data.username,
                email: data.email
            },
            token,
            otp_secret: otpSecret.base32
        });
    } catch (err) {
        next(err);
    }
});


// STEP 1: Login con username e password
router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username e password sono richiesti' });
        }

        // Recuperiamo utente da supabase
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        // Verifica password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        // Se l'utente ha OTP configurato  → richiediamo verifica OTP 
        if (user.otp_secret) {
            // Genera un token temporaneo per il secondo step
            const tempToken = jwt.sign(
                {
                    id: user.id,
                    step: 'otp_pending',
                    username: user.username
                },
                JWT_SECRET,
                { expiresIn: '5m' } // token temporaneo valido 5 minuti
            );

            return res.json({
                success: false,
                requires_otp: true,
                temp_token: tempToken,
                message: 'Inserisci il codice OTP per completare il login'
            });
        }

        // Se l'utente NON ha OTP, genera direttamente il token finale
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                username: user.username
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN } // token temporaneo valido 5 minuti
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username
            }
        });
    } catch (err) {
        next(err);
    }
})

// STEP 2: Verifica OTP e completamento login
router.post('/verify-otp', async (req, res, next) => {
    try {
        const { temp_token, otp_token } = req.body;

        if (!temp_token || !otp_token) {
            return res.status(400).json({ error: 'Token temporaneo e codice OTP sono richiesti' });
        }

        // Verifica il token temporaneo
        let decoded;
        try {
            decoded = jwt.verify(temp_token, JWT_SECRET);

            // Verifica che sia un tokn temporaneo per OTP
            if (decoded.step != 'otp_pending') {
                return res.status(401).json({ error: 'Token non valido' });
            }
        } catch (err) {
            return res.status(401).json({ error: 'Token temporaneo scaduto o non valido' });

        }
        // Ottieni l'utente
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', decoded.id)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Utente non trovato' });
        }


        // Verifica il codice OTP tramite speakeasy
        const isValidOTP = speakeasy.totp.verify({
            secret: user.otp_secret,
            encoding: 'base32',
            token: otp_token,
            window: 2 // permette una finestra di +-2 intervalli di tolleranza (60 secondi prima/dopo)
        });

        if (!isValidOTP) {
            return res.status(401).json({ error: 'Codice OTP non valido' });
        }

        // OTP OK --> Genera il token JWT finale
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                username: user.username
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            },
        });
    } catch (err) {
        next(err);
    }
})


// Logout: invalida la sessione (JWT lato client)
router.post('/logout', async (req, res, next) => {
    try {
        return res.json({
            success: true,
            message: 'Logout effettuato. Il token va eliminato lato client.'
        });
    } catch (err) {
        next(err);
    }
});


// Ottieni informazioni OTP per configurazione (risponde con secret e url otp)
router.get('/otp/setup', authenticateJWT, async (req, res, next) => {
    try {
        // Ottieni l'utente con il suo otp_secret
        const { data: user, error } = await supabase
            .from('users')
            .select('otp_secret, email')
            .eq('id', req.user.id)
            .single();

        if (error) throw error;

        let otpSecret = user.otp_secret;

        // Se non esiste, crea un nuovo secret e salvalo
        if (!otpSecret) {
            const secret = speakeasy.generateSecret({ length: 20 });
            otpSecret = secret.base32;

            const { error: updateErr } = await supabase
                .from('users')
                .update({ otp_secret: otpSecret })
                .eq('id', req.user.id);

            if (updateErr) throw updateErr;
        }

        // Genera URL per Google Authenticator
        const otpauth_url = speakeasy.otpauthURL({
            secret: otpSecret,
            label: `ProgettoRecluta:${user.email}`,
            issuer: 'ProgettoRecluta',
            encoding: 'base32',
            algorithm: 'sha1'
        });

        return res.json({
            success: true,
            secret: otpSecret,
            otpauth_url
        });

    } catch (err) {
        next(err);
    }
});

// Verifica stato OTP (quando funziona come middleware verifica che l'OTP secret sia ancora valido)
router.get('/otp/status', authenticateJWT, async (req, res, next) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('otp_secret')
            .eq('id', req.user.id)
            .single();

        if (error) throw error;

        res.json({
            success: true,
            otp_enabled: !!user.otp_secret,
            message: 'Stato OTP recuperato con successo'
        });

    } catch (err) {
        next(err);
    }
});


// Verifica token JWT (ritorna l'utente loggato)
router.get('/me', authenticateJWT, async (req, res, next) => {
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            has_otp: !!req.user.otp_secret,
            bio: req.user.bio
        }
    });
});

export default router;