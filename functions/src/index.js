const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");

admin.initializeApp();

let _stripe;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

let _sb;
function getSb() {
  if (!_sb) _sb = createClient(
    "https://sbpyojhuihdpzxgrgmid.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  return _sb;
}

// ── Mapeo Price ID → Plan ──
const PRICE_PLAN_MAP = {
  "price_1TSlO0KFJQ0hIbWh6uNWSblT": { plan: "basico",     nombre: "Básico",    unidades: 10  },
  "price_1TSlQQKFJQ0hIbWhDwnOrAji": { plan: "profesional", nombre: "Pro",       unidades: 30  },
  "price_1TSlRcKFJQ0hIbWhHAH5hX0r": { plan: "empresarial", nombre: "Empresa",   unidades: 100 },
};

// ── Generar password temporal ──
function genPassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

// ── Enviar email de bienvenida ──
async function sendWelcomeEmail(email, empresaNombre, password, plan) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const dashboardUrl = "https://bitacora57.com/demo-dashboard.html";

  await transporter.sendMail({
    from: `"Bitácora 57" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `✅ Acceso activado — Bitácora 57 Panel de Flota`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#060d16;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060d16;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0f1e2e;border:1px solid #1a2d42;border-radius:12px;overflow:hidden;">
        
        <!-- HEADER -->
        <tr><td style="background:#0b1622;padding:28px 36px;border-bottom:1px solid #1a2d42;">
          <div style="font-family:Arial Black,sans-serif;font-size:26px;letter-spacing:3px;color:#f59e0b;">
            BITÁCORA <span style="color:#f0f4f8;">57</span>
          </div>
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5a7a94;margin-top:4px;">
            Panel de Flota Empresarial
          </div>
        </td></tr>

        <!-- STRIPE TOP -->
        <tr><td style="height:3px;background:linear-gradient(90deg,#f59e0b,#d97706);"></td></tr>

        <!-- BODY -->
        <tr><td style="padding:36px;">
          <div style="font-size:28px;font-weight:900;color:#f0f4f8;letter-spacing:1px;margin-bottom:6px;">
            ¡Tu acceso está listo! 🚛
          </div>
          <div style="font-size:14px;color:#5a7a94;margin-bottom:28px;">
            ${empresaNombre} — Plan ${plan}
          </div>

          <div style="background:#060d16;border:1px solid #223448;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
            <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#5a7a94;margin-bottom:12px;">
              TUS CREDENCIALES DE ACCESO
            </div>
            <div style="margin-bottom:8px;">
              <span style="font-size:11px;color:#5a7a94;">Usuario:</span><br/>
              <span style="font-family:monospace;font-size:15px;color:#f0f4f8;">${email}</span>
            </div>
            <div>
              <span style="font-size:11px;color:#5a7a94;">Contraseña temporal:</span><br/>
              <span style="font-family:monospace;font-size:18px;color:#f59e0b;letter-spacing:2px;">${password}</span>
            </div>
          </div>

          <div style="background:#0f2a1a;border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:12px;color:#22c55e;">
            ⚠️ Cambia tu contraseña al primer ingreso desde el botón <strong>"🔑 Password"</strong> en el panel.
          </div>

          <a href="${dashboardUrl}" style="display:block;background:#f59e0b;color:#060d16;text-align:center;padding:16px;border-radius:8px;font-weight:900;font-size:16px;letter-spacing:2px;text-decoration:none;margin-bottom:24px;">
            ENTRAR AL PANEL →
          </a>

          <div style="font-size:12px;color:#3d5a72;line-height:1.6;">
            URL directa: <a href="${dashboardUrl}" style="color:#f59e0b;">${dashboardUrl}</a><br/>
            ¿Problemas? Escríbenos por WhatsApp o a soporte@bitacora57.com
          </div>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#0b1622;padding:20px 36px;border-top:1px solid #1a2d42;text-align:center;">
          <div style="font-size:11px;color:#3d5a72;">
            © 2026 Bitácora 57 · bitacora57.com<br/>
            Este correo es generado automáticamente, no respondas a él.
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

// ══════════════════════════════════════════════
// 1. CREAR PAYMENT INTENT
// Llamado desde el frontend al seleccionar plan
// ══════════════════════════════════════════════
exports.crearPaymentIntent = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://bitacora57.com");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  try {
    const { priceId, empresaId, email, empresaNombre } = req.body;
    if (!priceId || !empresaId || !email) {
      res.status(400).json({ error: "Faltan parámetros." });
      return;
    }

    const planInfo = PRICE_PLAN_MAP[priceId];
    if (!planInfo) {
      res.status(400).json({ error: "Plan no válido." });
      return;
    }

    // Crear o recuperar customer en Stripe
    const customers = await getStripe().customers.list({ email, limit: 1 });
    let customer = customers.data[0];
    if (!customer) {
      customer = await getStripe().customers.create({
        email,
        name: empresaNombre,
        metadata: { empresa_id: empresaId, supabase_email: email },
      });
    }

    // Crear suscripción con pago inmediato
    const subscription = await getStripe().subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        empresa_id: empresaId,
        empresa_nombre: empresaNombre,
        email,
        plan: planInfo.plan,
      },
    });

    const paymentIntent = subscription.latest_invoice.payment_intent;

    res.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
    });

  } catch (e) {
    console.error("crearPaymentIntent error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════
// 2. WEBHOOK DE STRIPE
// Activa empresa automáticamente al pago exitoso
// ══════════════════════════════════════════════
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.error("Webhook signature error:", e.message);
    res.status(400).send(`Webhook Error: ${e.message}`);
    return;
  }

  // Solo procesar pagos exitosos de suscripción
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    const sub = await getStripe().subscriptions.retrieve(invoice.subscription);
    const meta = sub.metadata;

    if (!meta.empresa_id || !meta.email) {
      console.log("Sin metadata, ignorando.");
      res.json({ received: true }); return;
    }

    const planInfo = PRICE_PLAN_MAP[sub.items.data[0]?.price?.id];
    if (!planInfo) {
      console.log("Plan no reconocido.");
      res.json({ received: true }); return;
    }

    try {
      // Generar password temporal
      const tempPassword = genPassword();

      // Crear usuario en Supabase Auth
      const { data: authData, error: authErr } = await getSb().auth.admin.createUser({
        email: meta.email,
        password: tempPassword,
        email_confirm: true,
      });

      let authId = authData?.user?.id || null;

      // Si ya existe el usuario en Auth, solo actualizamos
      if (authErr && authErr.message.includes("already been registered")) {
        const { data: existing } = await getSb().auth.admin.listUsers();
        const found = existing?.users?.find(u => u.email === meta.email);
        authId = found?.id || null;
      }

      // Activar empresa en Supabase
      const { error: empErr } = await getSb().from("empresas").update({
        activa: true,
        plan: planInfo.plan,
        activada_at: new Date().toISOString(),
        auth_id: authId,
        stripe_customer_id: sub.customer,
        stripe_subscription_id: sub.id,
      }).eq("id", meta.empresa_id);

      if (empErr) throw empErr;

      // Crear entrada en empresa_usuarios
      if (authId) {
        await getSb().from("empresa_usuarios").upsert({
          empresa_id: meta.empresa_id,
          auth_id: authId,
          email: meta.email,
          nombre: meta.empresa_nombre || meta.email.split("@")[0],
          rol: "admin",
          activo: true,
        }, { onConflict: "email,empresa_id" });
      }

      // Enviar email de bienvenida
      await sendWelcomeEmail(
        meta.email,
        meta.empresa_nombre || "tu empresa",
        tempPassword,
        planInfo.nombre
      );

      console.log(`✅ Empresa ${meta.empresa_nombre} activada. Plan: ${planInfo.plan}`);

    } catch (e) {
      console.error("Error activando empresa:", e);
    }
  }

  // Suscripción cancelada → desactivar empresa
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    if (sub.metadata.empresa_id) {
      await getSb().from("empresas").update({
        activa: false,
        plan: "cancelado",
      }).eq("id", sub.metadata.empresa_id);
      console.log(`❌ Empresa ${sub.metadata.empresa_id} desactivada por cancelación.`);
    }
  }

  res.json({ received: true });
});

// ══════════════════════════════════════════════
// 3. PORTAL DE CLIENTE (cancelar/cambiar plan)
// ══════════════════════════════════════════════
exports.portalCliente = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://bitacora57.com");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  try {
    const { empresaId } = req.body;
    const { data: emp } = await getSb().from("empresas").select("stripe_customer_id").eq("id", empresaId).single();
    if (!emp?.stripe_customer_id) {
      res.status(404).json({ error: "Sin suscripción activa." }); return;
    }
    const session = await getStripe().billingPortal.sessions.create({
      customer: emp.stripe_customer_id,
      return_url: "https://bitacora57.com/demo-dashboard.html",
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});