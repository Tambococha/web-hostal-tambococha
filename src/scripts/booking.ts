import { getSupabase } from '../lib/supabase.js';
import { WA_NUMBER } from '../config/hotel.js';

export interface BookingConfig {
  precioNoche: number;
  precioFeriado: number;
  tipoHabitacion: string;
  inventarioMaximo?: number; // Para matrimonial/doble/familiar
}

export const initBookingLogic = async (config: BookingConfig) => {
  const checkin = document.getElementById('checkin') as HTMLInputElement;
  const checkout = document.getElementById('checkout') as HTMLInputElement;
  const huespedes = document.getElementById('huespedes') as HTMLInputElement;
  const btnPreReserva = document.getElementById('btn-pre-reserva');
  const btnText = document.getElementById('btn-text');
  const modal = document.getElementById('booking-modal');
  const modalContent = document.getElementById('modal-content');
  const clientNameInput = document.getElementById(
    'client-name'
  ) as HTMLInputElement;
  const clientPhoneInput = document.getElementById(
    'client-phone'
  ) as HTMLInputElement;

  if (
    !checkin ||
    !checkout ||
    !btnPreReserva ||
    btnPreReserva.dataset.initialized
  )
    return;
  btnPreReserva.dataset.initialized = 'true';

  // Inicializar intl-tel-input
  // @ts-ignore
  const iti = window.intlTelInput(clientPhoneInput, {
    initialCountry: 'ec',
    separateDialCode: true,
    utilsScript:
      'https://cdn.jsdelivr.net/npm/intl-tel-input@23.0.4/build/js/utils.js',
  });

  let totalNoches = 0;
  let totalPrecio = 0;

  // --- 1. OBTENER FERIADOS (Nager.Date) ---
  const FERIADOS = new Set<string>();
  try {
    const currentYear = new Date().getFullYear();
    const [resCurrent, resNext] = await Promise.all([
      fetch(`https://date.nager.at/api/v3/PublicHolidays/${currentYear}/EC`),
      fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${currentYear + 1}/EC`
      ),
    ]);
    if (resCurrent.ok && resNext.ok) {
      const allHolidays = [
        ...(await resCurrent.json()),
        ...(await resNext.json()),
      ];
      allHolidays.forEach((h: any) => {
        const dStr = h.date;
        FERIADOS.add(dStr);
        const date = new Date(dStr + 'T00:00:00');
        const day = date.getDay();
        if (day === 1) {
          FERIADOS.add(
            new Date(date.getTime() - 86400000).toISOString().split('T')[0]
          );
          FERIADOS.add(
            new Date(date.getTime() - 172800000).toISOString().split('T')[0]
          );
        } else if (day === 5) {
          FERIADOS.add(
            new Date(date.getTime() + 86400000).toISOString().split('T')[0]
          );
          FERIADOS.add(
            new Date(date.getTime() + 172800000).toISOString().split('T')[0]
          );
        }
      });
    }
  } catch (e) {
    console.error('Error API Feriados', e);
  }

  // ============================================================
  // --- 2. INVENTARIO — Consulta global de reservas ---
  // ============================================================
  let isDateBlockedForRoom = (dateKey: string): boolean => false;

  if (
    config.tipoHabitacion === 'Habitación Simple' ||
    config.tipoHabitacion === 'Habitación Matrimonial'
  ) {
    const TOTAL_SIMPLES = 1;
    const TOTAL_MATRIMONIALES = 4;
    const ocupSimples: Record<string, number> = {};
    const ocupMatrimoniales: Record<string, number> = {};

    const acumularDias = (res: any, map: Record<string, number>) => {
      let d = new Date(res.checkin + 'T00:00:00');
      const fin = new Date(res.checkout + 'T00:00:00');
      while (d < fin) {
        const key = d.toISOString().split('T')[0];
        map[key] = (map[key] || 0) + 1;
        d.setDate(d.getDate() + 1);
      }
    };

    try {
      const supabase = getSupabase();
      const { data: reservas, error } = await supabase
        .from('reservas')
        .select('checkin, checkout, habitacion_tipo')
        .in('habitacion_tipo', ['Habitación Simple', 'Habitación Matrimonial'])
        .neq('estado', 'cancelada');

      if (!error && reservas) {
        for (const res of reservas) {
          if (res.habitacion_tipo === 'Habitación Simple') {
            acumularDias(res, ocupSimples);
          } else {
            acumularDias(res, ocupMatrimoniales);
          }
        }
      }
    } catch (e) {
      console.error('Error leyendo Supabase', e);
    }

    isDateBlockedForRoom = (dateKey: string): boolean => {
      const rS = ocupSimples[dateKey] || 0;
      const rM = ocupMatrimoniales[dateKey] || 0;
      const simples_sobregiradas = Math.max(0, rS - TOTAL_SIMPLES);
      const matrimoniales_disponibles =
        TOTAL_MATRIMONIALES - rM - simples_sobregiradas;

      if (config.tipoHabitacion === 'Habitación Simple') {
        const simples_disponibles =
          (TOTAL_SIMPLES - rS > 0 ? 1 : 0) +
          Math.max(0, matrimoniales_disponibles);
        return simples_disponibles <= 0;
      } else {
        return matrimoniales_disponibles <= 0;
      }
    };
  } else {
    // Lógica estándar para las demás habitaciones
    const ocupacionPorDia: Record<string, number> = {};

    try {
      const supabase = getSupabase();
      const { data: reservas, error } = await supabase
        .from('reservas')
        .select('checkin, checkout')
        .eq('habitacion_tipo', config.tipoHabitacion)
        .neq('estado', 'cancelada');

      if (!error && reservas) {
        for (const res of reservas) {
          let d = new Date(res.checkin + 'T00:00:00');
          const fin = new Date(res.checkout + 'T00:00:00');
          while (d < fin) {
            const key = d.toISOString().split('T')[0];
            ocupacionPorDia[key] = (ocupacionPorDia[key] || 0) + 1;
            d.setDate(d.getDate() + 1);
          }
        }
      }
    } catch (e) {
      console.error('Error leyendo Supabase', e);
    }

    const maxInv = config.inventarioMaximo || 1;
    isDateBlockedForRoom = (dateKey: string): boolean => {
      return (ocupacionPorDia[dateKey] || 0) >= maxInv;
    };
  }

  // --- 3. CONFIGURAR FLATPICKR ---
  const configPicker = {
    locale: 'es',
    dateFormat: 'Y-m-d',
    minDate: 'today',
    disableMobile: true,
    disable: [
      function (date: Date) {
        const localDate = new Date(
          date.getTime() - date.getTimezoneOffset() * 60000
        )
          .toISOString()
          .split('T')[0];
        return isDateBlockedForRoom(localDate);
      },
    ],
    onDayCreate: function (
      dObj: any,
      dStr: any,
      fp: any,
      dayElem: HTMLElement
    ) {
      const day = dayElem as HTMLElement & { dateObj: Date };
      const localDate = new Date(
        day.dateObj.getTime() - day.dateObj.getTimezoneOffset() * 60000
      )
        .toISOString()
        .split('T')[0];
      if (
        FERIADOS.has(localDate) &&
        !dayElem.classList.contains('flatpickr-disabled')
      ) {
        dayElem.style.backgroundColor = 'rgba(217, 119, 6, 0.15)';
        dayElem.style.border = '1px solid rgba(217, 119, 6, 0.5)';
        dayElem.style.color = '#b45309';
        dayElem.style.fontWeight = '900';
      }
    },
    onChange: calcularEstadia,
  };

  // @ts-ignore
  if (window.flatpickr) {
    // @ts-ignore
    window.flatpickr(checkin, configPicker);
    // @ts-ignore
    window.flatpickr(checkout, configPicker);
  }

  // --- 4. LÓGICA DE PRECIOS Y MODAL ---
  function calcularEstadia() {
    if (!checkin.value || !checkout.value) return;
    const dateIn = new Date(checkin.value + 'T00:00:00');
    const dateOut = new Date(checkout.value + 'T00:00:00');
    const dayDiff = Math.round(
      (dateOut.getTime() - dateIn.getTime()) / (1000 * 3600 * 24)
    );

    if (dayDiff > 0) {
      totalNoches = dayDiff;
      totalPrecio = 0;
      const currentHuespedes = parseInt(huespedes.value, 10) || 1;

      for (let d = new Date(dateIn); d < dateOut; d.setDate(d.getDate() + 1)) {
        const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .split('T')[0];
        const basePrice = FERIADOS.has(localDate)
          ? config.precioFeriado
          : config.precioNoche;

        // Si el precio es "por persona" (caso doble/triple), multiplicar por huéspedes
        if (config.tipoHabitacion === 'Habitación Doble/Triple') {
          totalPrecio += basePrice * currentHuespedes;
        } else {
          totalPrecio += basePrice;
        }
      }
      if (btnText)
        btnText.textContent = `Confirmar ${totalNoches} Noche${totalNoches > 1 ? 's' : ''}`;
    } else {
      totalNoches = 0;
      if (btnText) btnText.textContent = 'Fechas Inválidas';
    }
  }

  // --- Stepper Adultos ---
  const btnDecrement = document.getElementById('btn-decrement');
  const btnIncrement = document.getElementById('btn-increment');

  function updateStepper(delta: number) {
    const min = parseInt(huespedes.min, 10) || 1;
    const max = parseInt(huespedes.max, 10) || 1;
    const current = parseInt(huespedes.value, 10);
    const next = Math.min(max, Math.max(min, current + delta));
    huespedes.value = String(next);
    if (btnDecrement)
      (btnDecrement as HTMLButtonElement).disabled = next <= min;
    if (btnIncrement)
      (btnIncrement as HTMLButtonElement).disabled = next >= max;
    calcularEstadia();
  }

  btnDecrement?.addEventListener('click', () => updateStepper(-1));
  btnIncrement?.addEventListener('click', () => updateStepper(1));
  updateStepper(0);

  function toggleModal(show: boolean) {
    if (show && totalNoches === 0) return alert('Selecciona fechas válidas.');
    if (show) {
      document.getElementById('modal-in')!.textContent = checkin.value;
      document.getElementById('modal-out')!.textContent = checkout.value;
      document.getElementById('modal-nights')!.textContent =
        `${totalNoches} noche${totalNoches > 1 ? 's' : ''}`;
      document.getElementById('modal-total')!.textContent = `$${totalPrecio}`;
      modal!.classList.remove('hidden');
      modal!.classList.add('flex');
      setTimeout(() => {
        modal!.classList.remove('opacity-0');
        modalContent!.classList.remove('scale-95');
      }, 10);
    } else {
      modal!.classList.add('opacity-0');
      modalContent!.classList.add('scale-95');
      setTimeout(() => {
        modal!.classList.add('hidden');
        modal!.classList.remove('flex');
      }, 300);
    }
  }

  btnPreReserva.addEventListener('click', (e) => {
    e.preventDefault();
    toggleModal(true);
  });
  document
    .getElementById('close-modal')!
    .addEventListener('click', () => toggleModal(false));
  document
    .getElementById('modal-backdrop')!
    .addEventListener('click', () => toggleModal(false));

  // --- 5. ENVIAR A SUPABASE Y WHATSAPP ---
  document
    .getElementById('btn-confirm-wa')!
    .addEventListener('click', async () => {
      const clientName = clientNameInput.value.trim();

      if (!clientName) {
        alert('Por favor, ingresa tu nombre.');
        clientNameInput.focus();
        return;
      }

      if (!iti.isValidNumber()) {
        alert('Por favor, ingresa un número de teléfono válido.');
        clientPhoneInput.focus();
        clientPhoneInput.classList.remove(
          'border-earth/20',
          'focus:ring-primary',
          'focus:border-primary'
        );
        clientPhoneInput.classList.add(
          'border-red-500',
          'ring-2',
          'ring-red-500'
        );
        setTimeout(() => {
          clientPhoneInput.classList.remove(
            'border-red-500',
            'ring-2',
            'ring-red-500'
          );
          clientPhoneInput.classList.add(
            'border-earth/20',
            'focus:ring-primary',
            'focus:border-primary'
          );
        }, 2500);
        return;
      }

      const clientPhone = iti.getNumber();

      const btnWa = document.getElementById(
        'btn-confirm-wa'
      ) as HTMLButtonElement;
      const originalText = btnWa.innerHTML;
      btnWa.innerHTML = 'Procesando...';
      btnWa.style.opacity = '0.7';
      btnWa.style.pointerEvents = 'none';

      try {
        const supabase = getSupabase();
        await supabase.from('reservas').insert([
          {
            cliente_nombre: clientName,
            telefono: clientPhone,
            habitacion_tipo: config.tipoHabitacion,
            checkin: checkin.value,
            checkout: checkout.value,
            noches: totalNoches,
            huespedes: parseInt(huespedes.value, 10),
            total_usd: totalPrecio,
            estado: 'pendiente',
          },
        ]);
      } catch (err) {
        console.error(err);
      }

      const shortName = config.tipoHabitacion.replace('Habitación ', '');
      const msg = `*NUEVA PRE-RESERVA* \u{1F514}\n\nHola, soy *${clientName}* (${clientPhone}).\nQuiero confirmar:\n\n\u{1F4CC} *Hab:* ${shortName}\n\u{1F4C5} *In:* ${checkin.value}\n\u{1F4C5} *Out:* ${checkout.value}\n\u{1F4C5} *Noches:* ${totalNoches}\n\u{1F465} *Pax:* ${huespedes.value}\n\n\u{1F4B0} *Total allá:* $${totalPrecio} USD`;

      btnWa.innerHTML = originalText;
      btnWa.style.opacity = '1';
      btnWa.style.pointerEvents = 'auto';
      window.open(
        `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`,
        '_blank'
      );
      toggleModal(false);
      setTimeout(() => window.location.reload(), 1500);
    });
};
