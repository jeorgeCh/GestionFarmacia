const express = require('express');
const cors = require('cors'); // Importar cors
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

const app = express();

// Usar cors
app.use(cors()); 

app.use(express.json());

// Este endpoint recibirá la solicitud de impresión desde tu aplicación web
app.post('/imprimir-ticket', async (req, res) => {
  console.log('Solicitud de impresión recibida:', req.body);

  // Aquí es donde configuramos la impresora.
  // DEBES cambiar "PrinterName" por el nombre real de tu impresora en el sistema operativo.
  let printer = new ThermalPrinter({
    type: PrinterTypes.EPSON, // Tipo de impresora, EPSON es un estándar común. Prueba con STAR si no funciona.
    interface: 'printer:PrinterName', // Conexión a la impresora por su nombre.
    characterSet: 'SLOVENIA', // Juego de caracteres para español
    removeSpecialCharacters: false,
    lineCharacter: "-",
  });

  try {
    const { items, total } = req.body;

    // Validar que tenemos los datos necesarios
    if (!items || !total) {
      throw new Error('Faltan los datos de items o el total.');
    }

    // --- INICIO DEL TICKET ---
    printer.alignCenter();
    printer.println("Droguería Pro Management");
    printer.println("Fecha: " + new Date().toLocaleString());
    printer.println("--------------------------------");

    printer.alignLeft();
    items.forEach(item => {
      // Asegúrate de que los nombres de las propiedades coincidan con los que envías desde el frontend
      printer.tableCustom([
        { text: item.name, align: "LEFT", width: 0.5 },
        { text: `$${item.price}`, align: "RIGHT", width: 0.25 },
        { text: `x${item.quantity}`, align: "RIGHT", width: 0.25 },
      ]);
    });

    printer.println("--------------------------------");
    printer.alignRight();
    printer.bold(true);
    printer.println(`TOTAL: $${total}`);
    printer.bold(false);
    printer.newLine();
    // --- FIN DEL TICKET ---
    
    // Comando para abrir la caja registradora (depende del modelo de impresora)
    printer.openCashDrawer();

    // Ejecutar la impresión
    await printer.execute();
    console.log("Impresión completada exitosamente.");
    res.status(200).send({ message: 'Ticket impreso y caja abierta correctamente.' });

  } catch (error) {
    console.error("Error al imprimir:", error);
    res.status(500).send({ message: 'Error en el servicio de impresión.', error: error.message });
  }
});

const PUERTO = 4000;
app.listen(PUERTO, () => {
  console.log(`Servicio de impresión escuchando en http://localhost:${PUERTO}`);
});
