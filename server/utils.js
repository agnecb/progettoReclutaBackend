// FUNZIONI DI UTILITÀ RIUSABILI (DRY)

/**
 * Valida la presenza dei campi obbligatori nel corpo della richiesta (req.body).
 * Implementa il pattern 'requireFields' richiesto.
 * @param {object} obj - L'oggetto da validare (es. req.body).
 * @param {string[]} fields - Array dei nomi dei campi obbligatori.
 * @throws {Error} con status 400 se un campo è mancante/vuoto.
 */
const requireFields = (obj, fields) => {
    const missing = fields.filter(f => obj?.[f] == null || obj[f] === '');
    if (missing.length) {
        const err = new Error(`Missing fields: ${missing.join(', ')}`);
        err.status = 400; // Imposta lo stato HTTP per il middleware di gestione errori
        throw err;
    }
};

/**
 * Calcola i parametri di paginazione (limit e offset) da req.query.
 * Implementa il pattern 'paginated' richiesto con max 100.
 * @param {object} req - L'oggetto richiesta (con query params).
 * @returns {{limit: number, offset: number}}
 */
const paginated = (req) => {
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset ?? '0', 10), 0);
    return { limit, offset };
}

export { requireFields, paginated };