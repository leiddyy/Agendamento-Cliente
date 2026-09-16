let adminToken = localStorage.getItem('adminToken') || '';
let currentTab = 'agenda';

document.addEventListener('DOMContentLoaded', () => {
  if (adminToken) {
    showAdminApp();
  } else {
    document.getElementById('loginModal').style.display = 'flex';
  }

  // Definir data padrão no filtro da agenda
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('filterDate').value = today;
});

async function handleLogin(event) {
  event.preventDefault();
  const u = document.getElementById('adminUsername').value.trim();
  const p = document.getElementById('adminPassword').value;

  const btn = document.getElementById('btnLoginSubmit');
  btn.disabled = true;
  btn.innerText = 'Entrando...';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Falha na autenticação');
      btn.disabled = false;
      btn.innerText = 'Entrar no Painel';
      return;
    }

    adminToken = data.token;
    localStorage.setItem('adminToken', adminToken);
    showAdminApp();
  } catch (err) {
    console.error(err);
    alert('Erro de conexão com o servidor.');
    btn.disabled = false;
    btn.innerText = 'Entrar no Painel';
  }
}

function logout() {
  localStorage.removeItem('adminToken');
  adminToken = '';
  document.getElementById('adminApp').style.display = 'none';
  document.getElementById('loginModal').style.display = 'flex';
}

function showAdminApp() {
  document.getElementById('loginModal').style.display = 'none';
  document.getElementById('adminApp').style.display = 'block';
  loadDashboardStats();
  loadAgenda();
}

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tabBtnAgenda').classList.remove('active');
  document.getElementById('tabBtnServices').classList.remove('active');
  document.getElementById('tabBtnSettings').classList.remove('active');

  document.getElementById('viewAgenda').style.display = 'none';
  document.getElementById('viewServices').style.display = 'none';
  document.getElementById('viewSettings').style.display = 'none';

  if (tab === 'agenda') {
    document.getElementById('tabBtnAgenda').classList.add('active');
    document.getElementById('viewAgenda').style.display = 'block';
    loadDashboardStats();
    loadAgenda();
  } else if (tab === 'services') {
    document.getElementById('tabBtnServices').classList.add('active');
    document.getElementById('viewServices').style.display = 'block';
    loadAdminServices();
  } else if (tab === 'settings') {
    document.getElementById('tabBtnSettings').classList.add('active');
    document.getElementById('viewSettings').style.display = 'block';
    loadAdminSettings();
  }
}

async function loadDashboardStats() {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!res.ok) return;

    const stats = await res.json();
    document.getElementById('statToday').innerText = stats.todayCount;
    document.getElementById('statMonth').innerText = stats.monthCount;
    document.getElementById('statPending').innerText = stats.pendingCount;
    document.getElementById('statRevenue').innerText = `R$ ${stats.monthRevenue.toFixed(2).replace('.', ',')}`;
  } catch (err) {
    console.error('Erro ao carregar estatísticas:', err);
  }
}

async function loadAgenda() {
  const dateVal = document.getElementById('filterDate').value;
  const tbody = document.getElementById('agendaTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #888;">Carregando agenda...</td></tr>';

  try {
    const res = await fetch(`/api/admin/appointments?date=${dateVal}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (!res.ok) {
      if (res.status === 401) logout();
      return;
    }

    const appointments = await res.json();

    if (appointments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #888; padding: 25px;">Nenhum agendamento para esta data.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    appointments.forEach(app => {
      const tr = document.createElement('tr');
      
      const statusBadge = `<span class="badge-status badge-${app.status}">${app.status}</span>`;
      
      const cleanPhone = app.client_phone.replace(/\D/g, '');
      const waLink = `https://wa.me/55${cleanPhone}`;

      tr.innerHTML = `
        <td style="font-weight: 600; color: #2b262d;">${app.start_time} - ${app.end_time}</td>
        <td><strong>${app.client_name}</strong>${app.notes ? `<br><small style="color: #888;">${app.notes}</small>` : ''}</td>
        <td>
          <a href="${waLink}" target="_blank" style="color: #25d366; text-decoration: none; font-weight: 500;">
            <i class="fa-brands fa-whatsapp"></i> ${app.client_phone}
          </a>
        </td>
        <td>${app.service_name}</td>
        <td style="font-weight: 600;">R$ ${app.price.toFixed(2).replace('.', ',')}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display: flex; gap: 5px;">
            ${app.status !== 'concluido' ? `<button class="btn btn-secondary" onclick="updateStatus(${app.id}, 'concluido')" title="Concluir" style="padding: 4px 8px; font-size: 0.8rem; background: #e8f5e9; color: #2e7d32;"><i class="fa-solid fa-check"></i></button>` : ''}
            ${app.status !== 'cancelado' ? `<button class="btn btn-secondary" onclick="updateStatus(${app.id}, 'cancelado')" title="Cancelar" style="padding: 4px 8px; font-size: 0.8rem; background: #ffebee; color: #c62828;"><i class="fa-solid fa-xmark"></i></button>` : ''}
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Erro ao carregar dados da agenda.</td></tr>';
  }
}

async function updateStatus(id, newStatus) {
  if (!confirm(`Deseja alterar o status deste agendamento para "${newStatus}"?`)) return;

  try {
    const res = await fetch(`/api/admin/appointments/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.ok) {
      loadDashboardStats();
      loadAgenda();
    } else {
      alert('Erro ao atualizar status.');
    }
  } catch (err) {
    console.error(err);
  }
}

// Gestão de Serviços
async function loadAdminServices() {
  const tbody = document.getElementById('servicesTableBody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #888;">Carregando serviços...</td></tr>';

  try {
    const res = await fetch('/api/admin/services', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const services = await res.json();

    tbody.innerHTML = '';
    services.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${s.name}</strong><br><small style="color: #888;">${s.description || ''}</small></td>
        <td>${s.category}</td>
        <td>${s.duration_minutes} min</td>
        <td style="font-weight: 600;">R$ ${s.price.toFixed(2).replace('.', ',')}</td>
        <td>
          <span class="badge-status ${s.active ? 'badge-concluido' : 'badge-cancelado'}">
            ${s.active ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 5px;">
            <button class="btn btn-secondary" onclick='editService(${JSON.stringify(s)})' style="padding: 4px 8px; font-size: 0.8rem;"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-secondary" onclick="deleteService(${s.id})" style="padding: 4px 8px; font-size: 0.8rem; color: #c62828;"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

function openNewServiceModal() {
  document.getElementById('serviceModalTitle').innerText = 'Novo Serviço';
  document.getElementById('serviceForm').reset();
  document.getElementById('serviceId').value = '';
  document.getElementById('serviceModal').style.display = 'flex';
}

function closeServiceModal() {
  document.getElementById('serviceModal').style.display = 'none';
}

function editService(s) {
  document.getElementById('serviceModalTitle').innerText = 'Editar Serviço';
  document.getElementById('serviceId').value = s.id;
  document.getElementById('serviceName').value = s.name;
  document.getElementById('serviceCategory').value = s.category;
  document.getElementById('serviceDuration').value = s.duration_minutes;
  document.getElementById('servicePrice').value = s.price;
  document.getElementById('serviceDesc').value = s.description || '';
  document.getElementById('serviceModal').style.display = 'flex';
}

async function saveService(event) {
  event.preventDefault();
  const id = document.getElementById('serviceId').value;
  const body = {
    name: document.getElementById('serviceName').value.trim(),
    category: document.getElementById('serviceCategory').value,
    duration_minutes: document.getElementById('serviceDuration').value,
    price: document.getElementById('servicePrice').value,
    description: document.getElementById('serviceDesc').value.trim(),
    active: 1
  };

  const url = id ? `/api/admin/services/${id}` : '/api/admin/services';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      closeServiceModal();
      loadAdminServices();
    } else {
      alert('Erro ao salvar serviço.');
    }
  } catch (err) {
    console.error(err);
  }
}

async function deleteService(id) {
  if (!confirm('Deseja realmente excluir este serviço?')) return;

  try {
    const res = await fetch(`/api/admin/services/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (res.ok) {
      loadAdminServices();
    }
  } catch (err) {
    console.error(err);
  }
}

// Configurações
async function loadAdminSettings() {
  try {
    const res = await fetch('/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const settings = await res.json();

    document.getElementById('setStudioName').value = settings.studio_name || '';
    document.getElementById('setWhatsapp').value = settings.whatsapp_number || '';
    document.getElementById('setOpening').value = settings.opening_time || '08:00';
    document.getElementById('setClosing').value = settings.closing_time || '19:00';
    document.getElementById('setLunchStart').value = settings.lunch_start || '12:00';
    document.getElementById('setLunchEnd').value = settings.lunch_end || '13:00';
  } catch (err) {
    console.error(err);
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const settings = {
    studio_name: document.getElementById('setStudioName').value.trim(),
    whatsapp_number: document.getElementById('setWhatsapp').value.trim(),
    opening_time: document.getElementById('setOpening').value,
    closing_time: document.getElementById('setClosing').value,
    lunch_start: document.getElementById('setLunchStart').value,
    lunch_end: document.getElementById('setLunchEnd').value
  };

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(settings)
    });

    if (res.ok) {
      alert('Configurações salvas com sucesso!');
    } else {
      alert('Erro ao salvar configurações.');
    }
  } catch (err) {
    console.error(err);
  }
}
