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
    
    console.log("🚀 VERSIÓN JS PURA CARGADA - Datos:", data);

    const { email, password, empresa } = data;

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

exports.solicitarEliminacionCuenta = functions.https.onCall(async (data, context) => {
    const nombre = typeof data?.nombre === 'string' ? data.nombre.trim().slice(0, 120) : '';
    const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase().slice(0, 160) : '';
    const licencia = typeof data?.licencia === 'string' ? data.licencia.trim().toUpperCase().slice(0, 60) : '';
    const motivo = typeof data?.motivo === 'string' ? data.motivo.trim().slice(0, 500) : 'Solicitud desde app';

    if (!email && !licencia) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Debes incluir al menos correo o numero de licencia para procesar la solicitud.'
        );
    }

    const payload = {
        nombre: nombre || null,
        email: email || null,
        licencia: licencia || null,
        motivo,
        estatus: 'pendiente_validacion',
        origen: 'app_movil',
        fecha_creacion: admin.firestore.FieldValue.serverTimestamp(),
        contexto_auth_uid: context.auth?.uid || null,
    };

    try {
        const requestRef = await admin.firestore().collection('solicitudes_eliminacion').add(payload);

        const htmlSoporte = `
          <h2>Solicitud de eliminacion de cuenta - Bitacora57</h2>
          <p><strong>Folio:</strong> ${requestRef.id}</p>
          <p><strong>Nombre:</strong> ${nombre || 'No proporcionado'}</p>
          <p><strong>Email:</strong> ${email || 'No proporcionado'}</p>
          <p><strong>Licencia:</strong> ${licencia || 'No proporcionada'}</p>
          <p><strong>Motivo:</strong> ${motivo || 'No especificado'}</p>
          <p><strong>Fecha:</strong> ${new Date().toISOString()}</p>
          <hr />
          <p>Esta solicitud fue creada desde la app movil.</p>
        `;

        await transporter.sendMail({
            from: '"Soporte Bitácora 57" <soportebitacora57@gmail.com>',
            to: 'soportebitacora57@gmail.com',
            subject: `Solicitud de eliminacion de cuenta [${requestRef.id}]`,
            html: htmlSoporte
        });

        if (email) {
            const htmlConfirmacion = `
              <h2>Recibimos tu solicitud de eliminacion</h2>
              <p>Hola ${nombre || 'usuario'},</p>
              <p>Tu solicitud para eliminar cuenta y datos asociados fue registrada.</p>
              <p><strong>Folio:</strong> ${requestRef.id}</p>
              <p>Te contactaremos desde soporte para validar identidad y completar el proceso.</p>
              <p>Soporte Bitácora 57</p>
            `;

            try {
                await transporter.sendMail({
                    from: '"Soporte Bitácora 57" <soportebitacora57@gmail.com>',
                    to: email,
                    subject: 'Confirmacion de solicitud de eliminacion - Bitacora57',
                    html: htmlConfirmacion
                });
            } catch (mailError) {
                console.error('No se pudo enviar correo de confirmacion al usuario:', mailError);
            }
        }

        return { success: true, requestId: requestRef.id };
    } catch (error) {
        console.error('Error en solicitarEliminacionCuenta:', error);
        throw new functions.https.HttpsError('internal', 'No se pudo registrar la solicitud de eliminacion.');
    }
});
