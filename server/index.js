const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors()); // Permite que Liannah y Lucía se conecten
app.use(express.json()); // Permite recibir datos JSON

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('API Global Solutions: ACTIVA');
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));