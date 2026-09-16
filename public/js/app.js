let allServices = [];
let studioSettings = {};
let selectedService = null;
let selectedDate = '';
let selectedSlot = '';

function getSalonSlug() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('salon') || urlParams.get('s') || 'eduarda-souza';
}

document.addEventListener('DOMContentLoaded', async () => {
  await fetchSettings();
  await fetchServices();
  setupDatePickerMin();
});

async function fetchSettings() {
  try {
    const slug = getSalonSlug();
    const res = await fetch(`/api/settings?salon=${encodeURIComponent(slug)}`);
    if (res.ok) {
      studioSettings = await res.json();
      if (studioSettings.studio_name) {
        const titleEl = document.getElementById('studioName');
        if (titleEl) titleEl.innerText = studioSettings.studio_name;
      }
      if (studioSettings.logo_url) {
        const logoEl = document.querySelector('.brand-logo');
        if (logoEl) logoEl.src = studioSettings.logo_url;
      }
      if (studioSettings.primary_color) {
        document.documentElement.style.setProperty('--primary-color', studioSettings.primary_color);
      }
    }
  } catch (err) {
    console.error('Erro ao carregar configurações do salão:', err);
  }
}

async function fetchServices() {
  try {
    const slug = getSalonSlug();
    const res = await fetch(`/api/services?salon=${encodeURIComponent(slug)}`);
    if (res.ok) {
      allServices = await res.json();
      renderServices(allServices);
    }
  } catch (err) {
    console.error('Erro ao buscar serviços:', err);
  }
}

function renderServices(services) {
  const container = document.getElementById('servicesContainer');
  container.innerHTML = '';

  if (services.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #888; padding: 20px;">Nenhum serviço disponível no momento.</div>';
    return;
  }

  services.forEach(s => {
    const isSelected = selectedService && selectedService.id === s.id;
    const card = document.createElement('div');
    card.className = `service-card ${isSelected ? 'selected' : ''}`;
    card.onclick = () => selectService(s);

    card.innerHTML = `
      <div>
        <div class="service-name">${s.name}</div>
        <div class="service-desc">${s.description || ''}</div>
      </div>
      <div class="service-meta">
        <span class="service-price">R$ ${Number(s.price).toFixed(2).replace('.', ',')}</span>
        <span class="service-time"><i class="fa-regular fa-clock"></i> ${s.duration_minutes} min</span>
      </div>
    `;

    container.appendChild(card);
  });
}

function filterCategory(category) {
  const tabs = document.querySelectorAll('.category-tab');
  tabs.forEach(tab => {
    if (tab.innerText.trim() === category || (category === 'Todos' && tab.innerText.trim() === 'Todos')) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  if (category === 'Todos') {
    renderServices(allServices);
  } else {
    const filtered = allServices.filter(s => s.category.toLowerCase() === category.toLowerCase());
    renderServices(filtered);
  }
}

function selectService(service) {
  selectedService = service;
  const currentTabActive = document.querySelector('.category-tab.active').innerText;
  filterCategory(currentTabActive);

  document.getElementById('btnGoToStep2').disabled = false;
}

function setupDatePickerMin() {
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('appointmentDate');
  dateInput.min = today;
  dateInput.value = today;
  selectedDate = today;
}

async function onDateChanged() {
  const dateInput = document.getElementById('appointmentDate');
  selectedDate = dateInput.value;
  selectedSlot = '';
  document.getElementById('btnGoToStep3').disabled = true;

  if (!selectedDate || !selectedService) return;

  await fetchSlots();
}

async function fetchSlots() {
  const slotsContainer = document.getElementById('slotsContainer');
  slotsContainer.innerHTML = '<div style="color: #666;"><i class="fa-solid fa-spinner fa-spin"></i> Buscando horários disponíveis...</div>';

  try {
    const slug = getSalonSlug();
    const res = await fetch(`/api/available-slots?date=${selectedDate}&serviceId=${selectedService.id}&salon=${encodeURIComponent(slug)}`);
    const data = await res.json();

    if (!res.ok || data.reason) {
      slotsContainer.innerHTML = `<div class="no-slots">${data.reason || 'Nenhum horário disponível para a data selecionada.'}</div>`;
      return;
    }

    if (data.availableSlots.length === 0) {
      slotsContainer.innerHTML = `<div class="no-slots">Todos os horários para este dia já estão preenchidos. Por favor, escolha outra data.</div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'slots-grid';

    data.availableSlots.forEach(slot => {
      const btn = document.createElement('button');
      btn.className = `slot-btn ${selectedSlot === slot ? 'selected' : ''}`;
      btn.innerText = slot;
      btn.onclick = () => selectSlot(slot, btn);
      grid.appendChild(btn);
    });

    slotsContainer.innerHTML = '';
    slotsContainer.appendChild(grid);
  } catch (err) {
    console.error(err);
    slotsContainer.innerHTML = `<div class="no-slots">Erro ao carregar horários. Tente novamente.</div>`;
  }
}

function selectSlot(slot, element) {
  selectedSlot = slot;
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  element.classList.add('selected');
  document.getElementById('btnGoToStep3').disabled = false;
}

function goToStep(step) {
  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display = 'none';
  document.getElementById('step3').style.display = 'none';
  document.getElementById('stepSuccess').style.display = 'none';

  document.getElementById('stepIndicator1').classList.remove('active');
  document.getElementById('stepIndicator2').classList.remove('active');
  document.getElementById('stepIndicator3').classList.remove('active');

  if (step === 1) {
    document.getElementById('step1').style.display = 'block';
    document.getElementById('stepIndicator1').classList.add('active');
  } else if (step === 2) {
    document.getElementById('step2').style.display = 'block';
    document.getElementById('stepIndicator1').classList.add('active');
    document.getElementById('stepIndicator2').classList.add('active');
    
    document.getElementById('selectedServiceSummary').innerHTML = `
      <div class="summary-row"><span class="summary-label">Serviço:</span><span class="summary-val">${selectedService.name}</span></div>
      <div class="summary-row"><span class="summary-label">Valor:</span><span class="summary-val">R$ ${Number(selectedService.price).toFixed(2).replace('.', ',')}</span></div>
      <div class="summary-row"><span class="summary-label">Duração estimada:</span><span class="summary-val">${selectedService.duration_minutes} min</span></div>
    `;

    if (selectedDate && selectedService) {
      fetchSlots();
    }
  } else if (step === 3) {
    document.getElementById('step3').style.display = 'block';
    document.getElementById('stepIndicator1').classList.add('active');
    document.getElementById('stepIndicator2').classList.add('active');
    document.getElementById('stepIndicator3').classList.add('active');

    const formattedDate = formatDateBR(selectedDate);
    document.getElementById('finalSummaryBox').innerHTML = `
      <div class="summary-row"><span class="summary-label">Procedimento:</span><span class="summary-val">${selectedService.name}</span></div>
      <div class="summary-row"><span class="summary-label">Data:</span><span class="summary-val">${formattedDate}</span></div>
      <div class="summary-row"><span class="summary-label">Horário:</span><span class="summary-val">${selectedSlot}</span></div>
      <div class="summary-row"><span class="summary-label">Valor Total:</span><span class="summary-val" style="color: var(--primary-color);">R$ ${Number(selectedService.price).toFixed(2).replace('.', ',')}</span></div>
    `;
  }
}

async function submitBooking(event) {
  event.preventDefault();

  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  const notes = document.getElementById('clientNotes').value.trim();

  const btnSubmit = document.getElementById('btnSubmitBooking');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Confirmando...';

  try {
    const slug = getSalonSlug();
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salon_slug: slug,
        client_name: name,
        client_phone: phone,
        service_id: selectedService.id,
        date: selectedDate,
        start_time: selectedSlot,
        notes: notes
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Erro ao realizar agendamento.');
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fa-solid fa-check-circle"></i> Confirmar Agendamento';
      return;
    }

    // Sucesso!
    document.getElementById('step3').style.display = 'none';
    document.getElementById('stepSuccess').style.display = 'block';

    const formattedDate = formatDateBR(selectedDate);
    document.getElementById('successSummary').innerHTML = `
      <div class="summary-row"><span class="summary-label">Cliente:</span><span class="summary-val">${name}</span></div>
      <div class="summary-row"><span class="summary-label">Procedimento:</span><span class="summary-val">${selectedService.name}</span></div>
      <div class="summary-row"><span class="summary-label">Data e Hora:</span><span class="summary-val">${formattedDate} às ${selectedSlot}</span></div>
      <div class="summary-row"><span class="summary-label">Valor:</span><span class="summary-val" style="color: var(--primary-color);">R$ ${Number(selectedService.price).toFixed(2).replace('.', ',')}</span></div>
    `;

    // Formatar Telefone do WhatsApp do Estúdio
    let studioPhone = studioSettings.whatsapp_number || '5511999999999';
    studioPhone = studioPhone.replace(/\D/g, '');
    if (!studioPhone.startsWith('55') && studioPhone.length <= 11) {
      studioPhone = '55' + studioPhone;
    }

    const waText = encodeURIComponent(
      `Olá! Fiz um agendamento pelo site:\n\n` +
      `👤 *Cliente:* ${name}\n` +
      `✨ *Serviço:* ${selectedService.name}\n` +
      `📅 *Data:* ${formattedDate}\n` +
      `⏰ *Horário:* ${selectedSlot}\n` +
      `💰 *Valor:* R$ ${Number(selectedService.price).toFixed(2).replace('.', ',')}\n\n` +
      `Gostaria de confirmar meu horário!`
    );

    document.getElementById('btnWhatsAppDirect').href = `https://api.whatsapp.com/send?phone=${studioPhone}&text=${waText}`;

  } catch (err) {
    console.error(err);
    alert('Ocorreu um erro inesperado ao salvar o agendamento.');
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fa-solid fa-check-circle"></i> Confirmar Agendamento';
  }
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function resetForm() {
  selectedService = null;
  selectedSlot = '';
  document.getElementById('bookingForm').reset();
  document.getElementById('btnGoToStep2').disabled = true;
  document.getElementById('btnGoToStep3').disabled = true;
  setupDatePickerMin();
  goToStep(1);
  fetchServices();
}
