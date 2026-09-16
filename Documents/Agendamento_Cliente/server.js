const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const { runAsync, getAsync, allAsync } = require('./database');
const { supabase, isSupabaseConfigured } = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'studio_secret_key_2026_super_secure';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de Autenticação Admin
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso não autorizado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão expirada ou token inválido' });
  }
}

// Helpers de Horário
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function getLocalDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper Multi-tenant para buscar dados do Salão
async function fetchSalonData(slug = 'eduarda-souza') {
  if (isSupabaseConfigured()) {
    let { data: salon } = await supabase
      .from('salons')
      .select('*')
      .eq('slug', slug)
      .single();

    if (!salon && slug !== 'eduarda-souza') {
      // Fallback para o salão padrão se a slug não for encontrada
      const { data: defaultSalon } = await supabase
        .from('salons')
        .select('*')
        .eq('slug', 'eduarda-souza')
        .single();
      salon = defaultSalon;
    }

    if (salon) {
      const { data: settings } = await supabase
        .from('salon_settings')
        .select('*')
        .eq('salon_id', salon.id)
        .single();

      return {
        id: salon.id,
        slug: salon.slug,
        studio_name: salon.name,
        logo_url: salon.logo_url || '/images/logo.jpg',
        primary_color: salon.primary_color || '#8A676A',
        whatsapp_number: salon.whatsapp_number || '5511999999999',
        opening_time: settings?.opening_time || '08:00',
        closing_time: settings?.closing_time || '19:00',
        lunch_start: settings?.lunch_start || '12:00',
        lunch_end: settings?.lunch_end || '13:00',
        working_days: settings?.working_days || '1,2,3,4,5,6'
      };
    }
  }

  // Fallback para SQLite local
  const settingsRows = await allAsync(`SELECT key, value FROM settings`);
  const settingsMap = {};
  settingsRows.forEach(row => {
    settingsMap[row.key] = row.value;
  });

  return {
    id: 'local',
    slug: 'eduarda-souza',
    studio_name: settingsMap.studio_name || 'Eduarda Souza Estética',
    logo_url: '/images/logo.jpg',
    primary_color: '#8A676A',
    whatsapp_number: settingsMap.whatsapp_number || '5511999999999',
    opening_time: settingsMap.opening_time || '08:00',
    closing_time: settingsMap.closing_time || '19:00',
    lunch_start: settingsMap.lunch_start || '12:00',
    lunch_end: settingsMap.lunch_end || '13:00',
    working_days: settingsMap.working_days || '1,2,3,4,5,6'
  };
}

// Helper para enviar notificação no Telegram
async function sendTelegramNotification(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });
  } catch (err) {
    console.error('Erro ao enviar Telegram:', err);
  }
}


// ==========================================
// ROTAS PÚBLICAS (CLIENTE)
// ==========================================

// Obter dados e identidade do estúdio pelo slug
app.get('/api/settings', async (req, res) => {
  try {
    const slug = req.query.salon || 'eduarda-souza';
    const salonData = await fetchSalonData(slug);
    res.json(salonData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar configurações do salão' });
  }
});

// Listar serviços ativos do salão
app.get('/api/services', async (req, res) => {
  try {
    const slug = req.query.salon || 'eduarda-souza';
    if (isSupabaseConfigured()) {
      const salon = await fetchSalonData(slug);
      const { data: services, error } = await supabase
        .from('services')
        .select('id, name, category, price, duration_minutes, description')
        .eq('salon_id', salon.id)
        .eq('active', 1)
        .order('category')
        .order('name');

      if (error) throw error;
      // =========================================================
      // CÓDIGO NOVO: MONTAR E ENVIAR NOTIFICAÇÃO PARA O TELEGRAM
      // =========================================================
      const dataFormatada = date.split('-').reverse().join('/');
      const msg = `📅 *Novo Agendamento!*\n\n*Cliente:* ${client_name}\n*Serviço:* ${service.name}\n*Data:* ${dataFormatada}\n*Horário:* ${start_time}\n*WhatsApp:* [${client_phone}](https://wa.me/55${client_phone.replace(/\D/g, '')})`;

      sendTelegramNotification(msg);
      // =========================================================

      return res.status(201).json({
        message: 'Agendamento realizado com sucesso!',
        appointment: { ...newApp, service_name: service.name, price: service.price }
      });
      return res.json(services || []);
    }

    // SQLite Local
    const services = await allAsync(
      `SELECT id, name, category, price, duration_minutes, description FROM services WHERE active = 1 ORDER BY category, name`
    );
    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar serviços' });
  }
});

// Consultar Horários Disponíveis para uma data e serviço
app.get('/api/available-slots', async (req, res) => {
  try {
    const { date, serviceId, salon: slug = 'eduarda-souza' } = req.query;
    if (!date || !serviceId) {
      return res.status(400).json({ error: 'Data e ID do serviço são obrigatórios' });
    }

    const salonData = await fetchSalonData(slug);

    let service = null;
    let existingAppointments = [];

    if (isSupabaseConfigured()) {
      const { data: s } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .eq('active', 1)
        .single();

      service = s;

      const { data: apps } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('salon_id', salonData.id)
        .eq('date', date)
        .neq('status', 'cancelado');

      existingAppointments = apps || [];
    } else {
      service = await getAsync(`SELECT * FROM services WHERE id = ? AND active = 1`, [serviceId]);
      existingAppointments = await allAsync(
        `SELECT start_time, end_time FROM appointments WHERE date = ? AND status != 'cancelado'`,
        [date]
      );
    }

    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    // Verificar se o dia da semana é um dia útil do estúdio
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 1 = Segunda...

    const workingDays = (salonData.working_days || '1,2,3,4,5,6').split(',').map(Number);
    if (!workingDays.includes(dayOfWeek)) {
      return res.json({ availableSlots: [], reason: 'O estúdio não abre nesta data.' });
    }

    const openingMins = timeToMinutes(salonData.opening_time);
    const closingMins = timeToMinutes(salonData.closing_time);
    const lunchStartMins = salonData.lunch_start ? timeToMinutes(salonData.lunch_start) : null;
    const lunchEndMins = salonData.lunch_end ? timeToMinutes(salonData.lunch_end) : null;

    const bookedIntervals = existingAppointments.map(app => ({
      start: timeToMinutes(app.start_time),
      end: timeToMinutes(app.end_time)
    }));

    const serviceDuration = Number(service.duration_minutes);
    const slotStep = 30; // intervalos base de 30 min
    const availableSlots = [];

    // Verificação da hora atual se a data selecionada for HOJE
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const currentMins = now.getHours() * 60 + now.getMinutes();

    for (let current = openingMins; current + serviceDuration <= closingMins; current += slotStep) {
      const slotStart = current;
      const slotEnd = current + serviceDuration;

      // 1. Filtrar horários passados se for o dia de HOJE
      if (date === todayStr && slotStart <= currentMins) {
        continue;
      }

      // 2. Verificar conflito com intervalo de almoço
      if (lunchStartMins !== null && lunchEndMins !== null) {
        if (slotStart < lunchEndMins && slotEnd > lunchStartMins) {
          continue;
        }
      }

      // 3. Verificar conflito com agendamentos já marcados
      const hasConflict = bookedIntervals.some(b => slotStart < b.end && slotEnd > b.start);
      if (!hasConflict) {
        availableSlots.push(minutesToTime(slotStart));
      }
    }

    res.json({ availableSlots, duration: serviceDuration });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao calcular horários disponíveis' });
  }
});

// Criar Agendamento pelo Cliente
app.post('/api/appointments', async (req, res) => {
  try {
    const { client_name, client_phone, service_id, date, start_time, notes, salon_slug = 'eduarda-souza' } = req.body;

    if (!client_name || !client_phone || !service_id || !date || !start_time) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
    }

    const salonData = await fetchSalonData(salon_slug);

    let service = null;
    let existing = [];

    if (isSupabaseConfigured()) {
      const { data: s } = await supabase
        .from('services')
        .select('*')
        .eq('id', service_id)
        .eq('active', 1)
        .single();
      service = s;

      const { data: apps } = await supabase
        .from('appointments')
        .select('*')
        .eq('salon_id', salonData.id)
        .eq('date', date)
        .neq('status', 'cancelado');

      existing = apps || [];
    } else {
      service = await getAsync(`SELECT * FROM services WHERE id = ? AND active = 1`, [service_id]);
      existing = await allAsync(
        `SELECT * FROM appointments WHERE date = ? AND status != 'cancelado'`,
        [date]
      );
    }

    if (!service) {
      return res.status(404).json({ error: 'Serviço selecionado é inválido' });
    }

    const startMins = timeToMinutes(start_time);
    const endMins = startMins + Number(service.duration_minutes);
    const end_time = minutesToTime(endMins);

    // Validação de horário passado se for hoje
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const currentMins = now.getHours() * 60 + now.getMinutes();

    if (date === todayStr && startMins <= currentMins) {
      return res.status(400).json({ error: 'Não é possível agendar em um horário que já passou.' });
    }

    const conflict = existing.some(app => {
      const existingStart = timeToMinutes(app.start_time);
      const existingEnd = timeToMinutes(app.end_time);
      return startMins < existingEnd && endMins > existingStart;
    });

    if (conflict) {
      return res.status(400).json({ error: 'Desculpe, este horário acabou de ser reservado por outro cliente.' });
    }

    if (isSupabaseConfigured()) {
      const { data: newApp, error } = await supabase
        .from('appointments')
        .insert([{
          salon_id: salonData.id,
          service_id: service.id,
          client_name: client_name.trim(),
          client_phone: client_phone.trim(),
          date,
          start_time,
          end_time,
          status: 'confirmado',
          notes: notes ? notes.trim() : ''
        }])
        .select('*')
        .single();

      if (error) throw error;

      return res.status(201).json({
        message: 'Agendamento realizado com sucesso!',
        appointment: { ...newApp, service_name: service.name, price: service.price }
      });
    }

    // SQLite Fallback
    const result = await runAsync(
      `INSERT INTO appointments (client_name, client_phone, service_id, date, start_time, end_time, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'confirmado', ?)`,
      [client_name.trim(), client_phone.trim(), service_id, date, start_time, end_time, notes ? notes.trim() : '']
    );

    const newAppointment = await getAsync(
      `SELECT a.*, s.name as service_name, s.price, s.duration_minutes
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       WHERE a.id = ?`,
      [result.lastID]
    );

    res.status(201).json({
      message: 'Agendamento realizado com sucesso!',
      appointment: newAppointment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});


// ==========================================
// ROTAS DE ADMINISTRAÇÃO (/api/admin)
// ==========================================

// Login do Admin
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Informe usuário e senha' });
    }

    let admin = null;
    if (isSupabaseConfigured()) {
      const { data } = await supabase
        .from('admins')
        .select('*')
        .eq('username', username.trim())
        .single();
      admin = data;
    } else {
      admin = await getAsync(`SELECT * FROM admins WHERE username = ?`, [username.trim()]);
    }

    if (!admin) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, name: admin.name, salon_id: admin.salon_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, name: admin.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao realizar login' });
  }
});

// Listar todos os agendamentos no Admin
app.get('/api/admin/appointments', authenticateAdmin, async (req, res) => {
  try {
    const { date, month } = req.query;

    if (isSupabaseConfigured()) {
      let query = supabase
        .from('appointments')
        .select('*, services(name, price, duration_minutes, category)')
        .eq('salon_id', req.admin.salon_id)
        .order('date', { ascending: false })
        .order('start_time', { ascending: true });

      if (date) {
        query = query.eq('date', date);
      } else if (month) {
        query = query.gte('date', `${month}-01`).lte('date', `${month}-31`);
      }

      const { data: apps, error } = await query;
      if (error) throw error;

      const formatted = (apps || []).map(a => ({
        ...a,
        service_name: a.services?.name || 'Serviço',
        price: a.services?.price || 0,
        duration_minutes: a.services?.duration_minutes || 0,
        category: a.services?.category || ''
      }));

      return res.json(formatted);
    }

    // SQLite Fallback
    let sql = `
      SELECT a.*, s.name as service_name, s.price, s.duration_minutes, s.category
      FROM appointments a
      JOIN services s ON a.service_id = s.id
    `;
    const params = [];

    if (date) {
      sql += ` WHERE a.date = ?`;
      params.push(date);
    } else if (month) {
      sql += ` WHERE a.date LIKE ?`;
      params.push(`${month}%`);
    }

    sql += ` ORDER BY a.date DESC, a.start_time ASC`;

    const appointments = await allAsync(sql, params);
    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar agendamentos' });
  }
});

// Atualizar Status do Agendamento
app.patch('/api/admin/appointments/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['confirmado', 'concluido', 'cancelado'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      return res.json({ message: 'Status atualizado com sucesso' });
    }

    await runAsync(`UPDATE appointments SET status = ? WHERE id = ?`, [status, id]);
    res.json({ message: 'Status atualizado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// Gestão de Serviços (CRUD)
app.get('/api/admin/services', authenticateAdmin, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data: salon } = await supabase.from('salons').select('*').eq('id', req.admin.salon_id).single();
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('salon_id', salon.id)
        .order('category')
        .order('name');
      if (error) throw error;
      return res.json(data || []);
    }

    const services = await allAsync(`SELECT * FROM services ORDER BY category, name`);
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar serviços' });
  }
});

app.post('/api/admin/services', authenticateAdmin, async (req, res) => {
  try {
    const { name, category, price, duration_minutes, description } = req.body;
    if (!name || !category || !price || !duration_minutes) {
      return res.status(400).json({ error: 'Dados incompletos do serviço' });
    }

    if (isSupabaseConfigured()) {
      const { data: salon } = await supabase.from('salons').select('*').eq('id', req.admin.salon_id).single();
      const { data, error } = await supabase
        .from('services')
        .insert([{
          salon_id: salon.id,
          name,
          category,
          price: parseFloat(price),
          duration_minutes: parseInt(duration_minutes),
          description: description || '',
          active: 1
        }])
        .select('id')
        .single();
      if (error) throw error;
      return res.status(201).json({ message: 'Serviço cadastrado com sucesso', id: data.id });
    }

    const result = await runAsync(
      `INSERT INTO services (name, category, price, duration_minutes, description, active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [name, category, parseFloat(price), parseInt(duration_minutes), description || '']
    );

    res.status(201).json({ message: 'Serviço cadastrado com sucesso', id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao cadastrar serviço' });
  }
});

app.put('/api/admin/services/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, duration_minutes, description, active } = req.body;

    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('services')
        .update({
          name,
          category,
          price: parseFloat(price),
          duration_minutes: parseInt(duration_minutes),
          description: description || '',
          active: active ? 1 : 0
        })
        .eq('id', id);
      if (error) throw error;
      return res.json({ message: 'Serviço atualizado com sucesso' });
    }

    await runAsync(
      `UPDATE services SET name = ?, category = ?, price = ?, duration_minutes = ?, description = ?, active = ?
       WHERE id = ?`,
      [name, category, parseFloat(price), parseInt(duration_minutes), description || '', active ? 1 : 0, id]
    );

    res.json({ message: 'Serviço atualizado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar serviço' });
  }
});

app.delete('/api/admin/services/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      return res.json({ message: 'Serviço excluído' });
    }

    await runAsync(`DELETE FROM services WHERE id = ?`, [id]);
    res.json({ message: 'Serviço excluído' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir serviço' });
  }
});

// Configurações do Estúdio no Admin
// Configurações do Estúdio no Admin
app.get('/api/admin/settings', authenticateAdmin, async (req, res) => {
  try {
    let slug = 'eduarda-souza';
    if (isSupabaseConfigured()) {
      const { data: salon } = await supabase.from('salons').select('slug').eq('id', req.admin.salon_id).single();
      if (salon) slug = salon.slug;
    }
    const salonData = await fetchSalonData(slug);
    res.json(salonData);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar configurações' });
  }
});

app.put('/api/admin/settings', authenticateAdmin, async (req, res) => {
  try {
    const settingsObj = req.body;
    if (isSupabaseConfigured()) {
      const { data: salon } = await supabase.from('salons').select('*').eq('id', req.admin.salon_id).single();

      if (settingsObj.studio_name || settingsObj.whatsapp_number) {
        await supabase
          .from('salons')
          .update({
            name: settingsObj.studio_name,
            whatsapp_number: settingsObj.whatsapp_number
          })
          .eq('id', salon.id);
      }

      await supabase
        .from('salon_settings')
        .upsert({
          salon_id: salon.id,
          opening_time: settingsObj.opening_time || '08:00',
          closing_time: settingsObj.closing_time || '19:00',
          lunch_start: settingsObj.lunch_start || '12:00',
          lunch_end: settingsObj.lunch_end || '13:00'
        }, { onConflict: 'salon_id' });

      return res.json({ message: 'Configurações atualizadas com sucesso no Supabase' });
    }

    // SQLite Fallback
    for (const [key, value] of Object.entries(settingsObj)) {
      await runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`,
        [key, value.toString(), value.toString()]
      );
    }
    res.json({ message: 'Configurações atualizadas com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
});

// Estatísticas Rápidas do Dashboard
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const today = getLocalDateString();
    const currentMonth = today.substring(0, 7);

    if (isSupabaseConfigured()) {
      const { data: salon } = await supabase.from('salons').select('*').eq('id', req.admin.salon_id).single();

      const { count: todayCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salon.id)
        .eq('date', today)
        .neq('status', 'cancelado');

      const { data: monthApps } = await supabase
        .from('appointments')
        .select('services(price)')
        .eq('salon_id', salon.id)
        .gte('date', `${currentMonth}-01`)
        .lte('date', `${currentMonth}-31`)
        .neq('status', 'cancelado');

      let monthRevenue = 0;
      (monthApps || []).forEach(a => {
        if (a.services?.price) monthRevenue += Number(a.services.price);
      });

      const { count: pendingCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salon.id)
        .gte('date', today)
        .eq('status', 'confirmado');

      return res.json({
        todayCount: todayCount || 0,
        monthCount: (monthApps || []).length,
        monthRevenue,
        pendingCount: pendingCount || 0
      });
    }

    // SQLite Fallback
    const todayAppointments = await getAsync(
      `SELECT COUNT(*) as count FROM appointments WHERE date = ? AND status != 'cancelado'`,
      [today]
    );

    const monthAppointments = await getAsync(
      `SELECT COUNT(*) as count, SUM(s.price) as total_revenue
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       WHERE a.date LIKE ? AND a.status != 'cancelado'`,
      [`${currentMonth}%`]
    );

    const pendingAppointments = await getAsync(
      `SELECT COUNT(*) as count FROM appointments WHERE date >= ? AND status = 'confirmado'`,
      [today]
    );

    res.json({
      todayCount: todayAppointments.count || 0,
      monthCount: monthAppointments.count || 0,
      monthRevenue: monthAppointments.total_revenue || 0,
      pendingCount: pendingAppointments.count || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao carregar estatísticas' });
  }
});

// Iniciar Servidor Express
app.listen(PORT, () => {
  console.log(`🚀 Servidor de agendamentos rodando na porta ${PORT}`);
  console.log(`📱 Cliente (Eduarda Souza Estética): http://localhost:${PORT}/?salon=eduarda-souza`);
  console.log(`👑 Admin: http://localhost:${PORT}/admin.html`);
});
