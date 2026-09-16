require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://sua-url-supabase.supabase.co') {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('⚡ Conexão com o Supabase estabelecida com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao inicializar o Supabase:', err.message);
  }
} else {
  console.log('ℹ SUPABASE_URL não configurado no .env. Utilizando modo de desenvolvimento com banco SQLite local.');
}

module.exports = {
  supabase,
  isSupabaseConfigured: () => !!supabase
};
