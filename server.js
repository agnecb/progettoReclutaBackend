// ok
// configura la porta, crea l'applicazione e ascolta il local host (app.listen)
import 'dotenv/config';

import { createApp } from './app.js';
const PORT = Number(process.env.PORT || 4000); // Uso PORT, ma 4000 è un buon default
const app = createApp();

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
})
