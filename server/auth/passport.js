import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { supabase } from '../db/index.js'; // Importiamo il client Supabase

// La chiave segreta per la firma del JWT
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Funzione che inizializza la strategia JWT per Passport.
 * @param {object} passport - L'istanza di Passport passata da app.js.
 */
export const initializePassport = (passport) => {
    // 1. Configurazione della strategia JWT
    passport.use(new JwtStrategy({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Estrae il token da Authorization: Bearer <token>
        secretOrKey: JWT_SECRET // Chiave segreta per verificare la firma
    }, async (payload, done) => {
        // La funzione 'verify' viene eseguita dopo che il token è stato decodificato con successo.
        try {
            // --- Logica di Blocco OTP Pending ---
            // Se il payload del token indica che l'utente è in uno stato di attesa OTP
            // (ovvero è un temp_token), neghiamo l'accesso alle route protette standard.
            if (payload.step === 'otp_pending') {
                // done(errore, utente, info) -> utente=false per accesso negato
                return done(null, false, { message: 'Token temporaneo non valido per questa operazione' });
            }

            // --- Verifica Utente nel Database ---
            // Se non è otp_pending, cerchiamo l'utente nel DB usando l'ID nel payload.
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', payload.id) // ID nel payload = 'userId'
                .single();

            if (error || !data) {
                // Utente non trovato (potrebbe essere stato cancellato o il token è fraudolento)
                return done(null, false, { message: 'Utente non trovato' });
            }

            // Autenticazione riuscita: passiamo l'oggetto utente a Express (req.user = data)
            return done(null, data);

        } catch (err) {
            // Errore durante l'accesso al DB o altra eccezione
            return done(err, false);
        }
    }));
};

/**
 * Middleware riutilizzabile per l'autenticazione JWT su tutte le route protette.
 * (Passport.authenticate restituisce una funzione middleware)
 */
export const authenticateJWT = passport.authenticate('jwt', { session: false });
export default passport;