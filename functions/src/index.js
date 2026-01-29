const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'soportebitacora57@gmail.com',
        pass: 'fksz uzis keds lfya' 
    }
});

exports.enviarBienvenidaB2B = functions.https.onCall(async (data, context) => {
    // Si ves este mensaje en los logs, ya ganamos
    console.log("🚀 VERSIÓN JS PURA CARGADA - Datos:", data);

    const { email, password, empresa } = data;

    // Mensajes de error NUEVOS y ESPECÍFICOS
    if (!email) throw new functions.https.HttpsError('invalid-argument', '❌ Falta el EMAIL');
    if (!password) throw new functions.https.HttpsError('invalid-argument', '❌ Falta la PASSWORD');
    if (!empresa) throw new functions.https.HttpsError('invalid-argument', '❌ Falta la EMPRESA');

    const mailOptions = {
        from: '"Soporte Bitácora 57" <soportebitacora57@gmail.com>',
        to: email,
        subject: 'Bienvenido a Bitácora 57',
        html: `<h2>Bienvenido ${empresa}</h2><p>Usuario: ${email}<br>Pass: ${password}</p>`
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'Error enviando correo: ' + error.message);
    }
});
