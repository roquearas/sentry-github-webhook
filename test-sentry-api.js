#!/usr/bin/env node

/**
 * Sentry API Test Script
 * Consulta eventos no Sentry para verificar captura de erros
 * 
 * Uso:
 *   SENTRY_AUTH_TOKEN="seu_token" node test-sentry-api.js
 *   
 * Ou com todas as variáveis customizáveis:
 *   SENTRY_AUTH_TOKEN="..." SENTRY_ORG="roque-e3" SENTRY_PROJECT="sentry-github-webhook" node test-sentry-api.js
 */

const https = require('https');
const url = require('url');

// Configuração
const SENTRY_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const ORG = process.env.SENTRY_ORG || 'roque-e3';
const PROJECT = process.env.SENTRY_PROJECT || 'sentry-github-webhook';
const QUERY = process.env.SENTRY_QUERY || 'error:Permission';

// Validação
if (!SENTRY_TOKEN) {
  console.error('\x1b[31m\u274c ERRO: SENTRY_AUTH_TOKEN não definido!\x1b[0m');
  console.error('\nUso: SENTRY_AUTH_TOKEN="seu_token" node test-sentry-api.js\n');
  process.exit(1);
}

console.log('\n\x1b[36m🔍 Consultando Sentry API...\x1b[0m');
console.log(`   Organização: ${ORG}`);
console.log(`   Projeto: ${PROJECT}`);
console.log(`   Query: ${QUERY}\n`);

// Função para fazer requisição HTTPS
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'sentry.io',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SENTRY_TOKEN}`,
        'User-Agent': 'Sentry-Webhook-Tester/1.0',
      },
    };

    https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (err) {
          resolve({ status: res.statusCode, data: data, error: true });
        }
      });
    }).on('error', reject).end();
  });
}

// Função para consultar eventos
async function getEvents() {
  const path = `/api/0/projects/${ORG}/${PROJECT}/events/?query=${encodeURIComponent(QUERY)}&limit=20&statsPeriod=24h`;
  return makeRequest(path);
}

// Função para obter detalhes da organização (valida token)
async function validateToken() {
  const path = `/api/0/organizations/${ORG}/`;
  return makeRequest(path);
}

// Função principal
async function main() {
  try {
    // 1. Valida token
    console.log('\x1b[33m⏳ Validando token...\x1b[0m');
    const orgRes = await validateToken();
    
    if (orgRes.status !== 200) {
      console.error(`\x1b[31m\u274c Token inválido ou organização não encontrada (${orgRes.status})\x1b[0m`);
      if (orgRes.data && orgRes.data.detail) {
        console.error(`Detalhe: ${orgRes.data.detail}`);
      }
      process.exit(1);
    }
    
    console.log(`\x1b[32m\u2705 Token válido! Organização: ${orgRes.data.name}\x1b[0m\n`);
    
    // 2. Consulta eventos
    console.log('\x1b[33m⏳ Consultando eventos...\x1b[0m');
    const eventsRes = await getEvents();
    
    if (eventsRes.status !== 200) {
      console.error(`\x1b[31m\u274c Erro ao consultar eventos (${eventsRes.status})\x1b[0m`);
      if (eventsRes.data && eventsRes.data.detail) {
        console.error(`Detalhe: ${eventsRes.data.detail}`);
      }
      process.exit(1);
    }
    
    const events = eventsRes.data;
    
    // 3. Exibe resultados
    if (!Array.isArray(events) || events.length === 0) {
      console.log(`\x1b[33m⚠ Nenhum evento encontrado com query: ${QUERY}\x1b[0m\n`);
      console.log('Possíveis razões:');
      console.log('  - Nenhum erro foi enviado ao Sentry neste período');
      console.log('  - Query não corresponde aos eventos capturados');
      console.log('  - Projeto não tem eventos ainda\n');
    } else {
      console.log(`\x1b[32m\u2705 ${events.length} evento(s) encontrado(s)!\x1b[0m\n`);
      
      events.forEach((event, index) => {
        const eventId = event.eventID || event.id || 'unknown';
        const title = event.title || 'No title';
        const level = event.level || 'unknown';
        const timestamp = event.dateCreated || 'unknown';
        const groupId = event.groupID || event.group?.id || 'unknown';
        
        console.log(`\x1b[36m[${index + 1}]\x1b[0m ${title}`);
        console.log(`    ID do Evento: ${eventId}`);
        console.log(`    Nível: ${level}`);
        console.log(`    Timestamp: ${timestamp}`);
        console.log(`    URL: https://sentry.io/organizations/${ORG}/issues/${groupId}/`);
        console.log('');
      });
      
      // Resumo
      console.log(`\x1b[32m\u2713 Total de eventos: ${events.length}\x1b[0m`);
      console.log(`\x1b[32m\u2713 Webhook está recebendo eventos! Próximo passo: debug GitHub issue creation\x1b[0m\n`);
    }
    
  } catch (error) {
    console.error(`\x1b[31m\u274c Erro ao consultar Sentry: ${error.message}\x1b[0m\n`);
    process.exit(1);
  }
}

main();
