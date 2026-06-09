type HandlerEvent = {
  queryStringParameters?: Record<string, string | undefined>;
};

const WA_NUMBER = "593985265183";

function getParam(
  params: Record<string, string | undefined>,
  key: string,
  fallback = ""
) {
  return String(params[key] ?? fallback).trim();
}

function emoji(...bytes: number[]) {
  return bytes
    .map((b) => "%" + b.toString(16).toUpperCase().padStart(2, "0"))
    .join("");
}

function enc(value: unknown) {
  return encodeURIComponent(String(value ?? "").normalize("NFC").trim());
}

export async function handler(event: HandlerEvent) {
  const params = event.queryStringParameters ?? {};
  
  const name = getParam(params, "name", "Cliente");
  const checkIn = getParam(params, "checkIn");
  const checkOut = getParam(params, "checkOut");
  const room = getParam(params, "room");
  const nights = getParam(params, "nights");
  const guests = getParam(params, "guests");
  const total = getParam(params, "total");
  const type = getParam(params, "type", "pre-reserva"); // pre-reserva or consulta
  const phone = getParam(params, "phone"); // specific to consulta form
  
  const E = {
    bell: emoji(0xf0, 0x9f, 0x94, 0x94),      // 🔔
    hotel: emoji(0xf0, 0x9f, 0x8f, 0xa8),     // 🏨
    calendar: emoji(0xf0, 0x9f, 0x93, 0x85),  // 📅
    moon: emoji(0xf0, 0x9f, 0x8c, 0x99),      // 🌙
    person: emoji(0xf0, 0x9f, 0x91, 0xa4),    // 👤
    money: emoji(0xf0, 0x9f, 0x92, 0xb5),     // 💵
    phone: emoji(0xf0, 0x9f, 0x93, 0x9e),     // 📞
    pin: emoji(0xf0, 0x9f, 0x93, 0x8c),       // 📌
  };

  let lines: string[] = [];

  if (type === "consulta") {
    lines = [
      `*NUEVA CONSULTA DE DISPONIBILIDAD* ${E.bell}`,
      "",
      `Hola Hostal Tambococha, soy *${enc(name)}* y quisiera saber si hay disponibilidad:`,
      "",
      `${E.pin} *Habitación:* ${enc(room)}`,
      `${E.calendar} *In:* ${enc(checkIn)}`,
      `${E.calendar} *Out:* ${enc(checkOut)}`,
      `${E.person} *Huéspedes:* ${enc(guests)}`,
      `${E.phone} *Teléfono:* ${enc(phone)}`,
    ];
  } else {
    // Default: pre-reserva (from modal)
    lines = [
      `*NUEVA PRE-RESERVA* ${E.bell}`,
      "",
      `Hola, soy *${enc(name)}* ${phone ? `(${enc(phone)})` : ""}.`,
      `Quiero confirmar:`,
      "",
      `${E.pin} *Hab:* ${enc(room)}`,
      `${E.calendar} *In:* ${enc(checkIn)}`,
      `${E.calendar} *Out:* ${enc(checkOut)}`,
      `${E.moon} *Noches:* ${enc(nights)}`,
      `${E.person} *Pax:* ${enc(guests)}`,
      "",
      `${E.money} *Total allá:* $${enc(total)} USD`,
    ];
  }

  const text = lines.join("%0A");
  const location = `https://api.whatsapp.com/send?phone=${WA_NUMBER}&text=${text}`;

  return {
    statusCode: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Content-Type": "text/plain; charset=UTF-8",
    },
    body: "",
  };
}
