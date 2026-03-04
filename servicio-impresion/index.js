const express = require('express');
const cors = require('cors');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/imprimir-ticket', async (req, res) => {
  console.log('Solicitud de impresión recibida:', req.body);

  // Configuración de la impresora
  let printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'printer:POS-80C', // <--- CAMBIA "POS-80C" por el nombre real de tu impresora
    characterSet: 'LATIN_2',
    removeSpecialCharacters: false,
    lineCharacter: '=',
    width: 42, // Ancho del papel en caracteres (ajusta según tu impresora, 42 o 48 es común para 80mm)
  });

  try {
    const {
      transactionId,
      items,
      total,
      paymentMethod,
      cashReceived,
      change,
      date
    } = req.body;

    if (!items || !total || !transactionId) {
      throw new Error('Faltan datos esenciales para generar el ticket.');
    }

    // --- DISEÑO DEL TICKET ---
    printer.alignCenter();
    printer.bold(true);
    printer.println("Droguería Pro Management");
    printer.bold(false);
    printer.println("NIT: 123.456.789-0");
    printer.println("Dirección: Calle Falsa 123");
    printer.println("Tel: 300-123-4567");
    printer.println(`Ticket #${transactionId}`);
    printer.println(`Fecha: ${date}`);
    printer.drawLine();

    printer.alignLeft();
    printer.tableCustom([
        { text: "Cant.", align: "LEFT", width: 0.1 },
        { text: "Producto", align: "LEFT", width: 0.6, bold: true },
        { text: "Total", align: "RIGHT", width: 0.3 }
    ]);
    printer.drawLine();

    items.forEach(item => {
        const itemName = `${item.quantity}x ${item.name} ${item.saleMode === 'caja' ? '(Caja)' : ''}`;
        printer.tableCustom([
            { text: "", align: "LEFT", width: 0.1 }, // Empty space for alignment
            { text: itemName, align: "LEFT", width: 0.6 },
            { text: `$${item.total.toLocaleString()}`, align: "RIGHT", width: 0.3 }
        ]);
    });

    printer.drawLine();

    printer.alignRight();
    printer.bold(true);
    printer.setTextSize(1,1);
    printer.println(`TOTAL: $${total.toLocaleString()}`);
    printer.setTextSize(0,0);
    printer.bold(false);

    if (paymentMethod === 'efectivo') {
        printer.println(`Paga con: $${cashReceived.toLocaleString()}`);
        printer.println(`Cambio: $${change.toLocaleString()}`);
    } else {
        printer.println(`Método: ${paymentMethod}`);
    }
    printer.drawLine();

    printer.alignCenter();
    printer.println("¡Gracias por su compra!");
    printer.cut();
    //printer.openCashDrawer(); // Descomenta si tu impresora abre la caja registradora

    // --- VISTA PREVIA EN CONSOLA ---
    // En lugar de imprimir, mostraremos el buffer en la consola.
    // Esto te permite ver cómo se verá la factura sin necesidad de una impresora física.
    const buffer = await printer.getBuffer();
    console.log("--- VISTA PREVIA DE FACTURA ---");
    console.log(buffer.toString());
    console.log("-------------------------------");


    // --- IMPRESIÓN REAL (COMENTADO) ---
    // Cuando estés listo para imprimir de verdad, comenta la sección de "VISTA PREVIA"
    // y descomenta la siguiente línea:
    // await printer.execute();

    res.status(200).send({ message: 'Vista previa de la factura generada en la consola del servidor.' });

  } catch (error) {
    console.error("Error al procesar el ticket:", error);
    res.status(500).send({ message: 'Error en el servicio de impresión.', error: error.message });
  }
});

const PUERTO = 4000;
app.listen(PUERTO, () => {
  console.log(`Servicio de impresión escuchando en http://localhost:${PUERTO}`);
});