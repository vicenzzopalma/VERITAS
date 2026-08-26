# 🛡️ GISAIO — Cofre & Auditoria WhatsApp Enterprise

<div align="center">

![WhatsApp Vault](https://img.shields.io/badge/WhatsApp-Auditoria%20%26%20Cofre-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Engine](https://img.shields.io/badge/Engine-Baileys%20WebSocket-0284c7?style=for-the-badge&logo=node.js&logoColor=white)
![Compliance](https://img.shields.io/badge/Compliance-Anti--Delete%20100%25-dc2626?style=for-the-badge&logo=shield&logoColor=white)
![Architecture](https://img.shields.io/badge/Architecture-Zero--Chrome%20Ultralight-059669?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge)

**Plataforma Corporativa de Auditoria Passiva, Gravação Perpétua de Mensagens e Laudos Jurídicos para WhatsApp**

*Substituto Enterprise do Digisac — Economia Real de R$ 35.520,00 ao ano.*

</div>

---

## 📋 Índice
- [🎯 1. Visão Geral & Retorno de Investimento (ROI)](#-1-visão-geral--retorno-de-investimento-roi)
- [⚡ 2. Eficiência Arquitetural: Baileys vs Puppeteer](#-2-eficiência-arquitetural-baileys-vs-puppeteer)
- [🛡️ 3. Pilares de Engenharia e Regras de Compliance](#️-3-pilares-de-engenharia-e-regras-de-compliance)
- [🔍 4. Módulo: Cofre de Auditoria Unitária](#-4-módulo-cofre-de-auditoria-unitária)
- [🧠 5. Mecanismo de Busca Telefônica Inteligente (Omnisearch)](#-5-mecanismo-de-busca-telefônica-inteligente-omnisearch)
- [🏗️ 6. Diagrama de Arquitetura do Sistema](#️-6-diagrama-de-arquitetura-do-sistema)
- [🌐 7. Especificação de Rotas & Endpoints](#-7-especificação-de-rotas--endpoints)
- [🚀 8. Guia de Execução e Inicialização](#-8-guia-de-execução-e-inicialização)
- [👥 9. Matriz de Perfis e Permissões](#-9-matriz-de-perfis-e-permissões)
- [📄 10. Licença & Segurança](#-10-licença--segurança)

---

## 🎯 1. Visão Geral & Retorno de Investimento (ROI)

O **GISAIO** foi concebido para eliminar os custos abusivos de plataformas de Helpdesk por número conectado, oferecendo uma infraestrutura dedicada de **armazenamento forense, auditoria contínua e compliance de conversas**.

### 💰 Comparativo de Custo Operacional (20 Smartphones)

| Métrica | Plataforma Anterior (Digisac) | GISAIO (Nosso Cofre) |
| :--- | :--- | :--- |
| **Custo por Aparelho** | R$ 150,00 / mês por chip | **R$ 0,00** (Sem limites de conexão) |
| **Custo Mensal Total** | **R$ 3.000,00 / mês** | **~R$ 40,00 / mês** (VPS Hostinger) |
| **Custo Anual Total** | **R$ 36.000,00 / ano** | **~R$ 480,00 / ano** |
| **Economia Líquida Projetada** | — | **🔥 R$ 35.520,00 / ano de economia** |
| **Retenção de Mensagens Apagadas** | Limitada / Depende de Ticket | **100% Imutável & Perpétua (Anti-Delete)** |

---

## ⚡ 2. Eficiência Arquitetural: Baileys vs Puppeteer

Diferente de soluções legadas que abrem instâncias completas do Google Chrome no servidor, o GISAIO opera sobre a biblioteca **Baileys (WebSockets Puros)**:

| Característica | Puppeteer / WWebJS (Antigo) | Baileys WebSockets (GISAIO) |
| :--- | :--- | :--- |
| **Tecnologia de Conexão** | 1 Navegador Chromium Headless por chip | Conexão socket TCP/TLS nativa |
| **Consumo de Memória (RAM)** | 300MB a 500MB por celular | **~25MB a 30MB por celular** |
| **Uso Total para 20 Chips** | 8GB a 12GB RAM (Instável) | **~600MB RAM (Ultraleve)** |
| **Infraestrutura Necessária** | Servidor Dedicado / VPS Cara | **VPS Básica (2 vCPUs / 4GB RAM)** |
| **Resiliência de Rede** | Quedas frequentes por crash de render | **Reconexão automática silenciosa** |

---

## 🛡️ 3. Pilares de Engenharia e Regras de Compliance

### 1. 🔒 Imutabilidade Absoluta de Identidade e Nomes
* O nome atribuído pelo operador a um smartphone no pareamento (ex: `ANA 2255`, `BRUNA ANJOS - 6843`) torna-se **100% perpétuo e imutável**.
* Proibição total de renomeações em lote, resets de sessão ou sobrescrita automática por rotinas de sincronização.

### 2. 🔇 Modo "Auditor Silencioso" (Caixa Preta)
* Os atendentes utilizam os smartphones físicos ou WhatsApp Web normalmente.
* O sistema **não dispara saudações automáticas**, **não exige encerramento de tickets** e não interfere na experiência do operador ou do cliente.

### 3. 🚫 Mecanismo Anti-Delete Absoluto
* Mensagens de texto, notas de voz, fotos, comprovantes e documentos em PDF apagados no WhatsApp ("Apagar para todos") são **preservados intactos** no banco de dados e no disco.
* Destaque visual pericial: badge vermelho de auditoria `🚫 MENSAGEM APAGADA NO WHATSAPP (às HH:MM:SS)`.

### 4. ⏳ Sincronização Retroativa de Histórico
* Ao parear um novo celular via QR Code, o sistema intercepta os pacotes históricos do WhatsApp (`syncFullHistory: true`) para sincronizar retroativamente as conversas prévias.

---

## 🔍 4. Módulo: Cofre de Auditoria Unitária

O módulo de Auditoria (`/audit`) foi projetado especificamente para supervisão e auditoria forense:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🛡️ Auditoria   [ 🔍 Localizar número em qualquer celular (Omnisearch)... ]     [📥 Exportar] │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ 📱 ANA 2255  324 msgs ] [ 📱 BRUNA ANJOS  169 msgs ] [ 📱 LAIZ  20 msgs ] [ 📱 PAOLA... ] │
├───────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ 💬 Conversas do Aparelho      │ 🕒 Timeline Contínua & Filtros Avançados                    │
│ ┌───────────────────────────┐ │ [ 🔍 Buscar termo ] [ 📅 De: dd/mm/aaaa ] [ 📅 Até: ]       │
│ │ 👤 Eliane Kozoris         │ │ [🔴 Apenas Apagadas] [📁 Tipo de Mídia: Todos ▾]            │
│ │    554799151766           │ │───────────────────────────────────────────────────────────│
│ │    NF 1.pdf               │ │ 👤 Cliente: Segue o comprovante em anexo.                   │
│ ├───────────────────────────┤ │ 📱 Operador: Recebido com sucesso.                          │
│ │ 👤 Sandro Marcelo         │ │ 🚫 [MENSAGEM APAGADA]: Valor confirmado via PIX.           │
│ │    555599916869           │ │ 🎙️ [Áudio de Voz - 0:28] ▶ 🔘━━━━━━━━━━━ 🔊                │
└───────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

* **Filtro de Termos Globais**: Varredura instantânea por palavras-chave (*"PIX"*, *"acordo"*, *"comprovante"*, *"cancelamento"*, *"ameaça"*).
* **Player Nativo de Voz**: Reprodução contínua de áudios em `.ogg` e `.mp3`.
* **Exportação Pericial**: Emissão de relatórios nos formatos **PDF**, **CSV** e **TXT** formatados para fins jurídicos.

---

## 🧠 5. Mecanismo de Busca Telefônica Inteligente (Omnisearch)

O motor [`phoneSearchHelper.ts`](file:///d:/whaticket/backend/src/helpers/phoneSearchHelper.ts) implementa tolerância completa ao padrão de telefonia móvel brasileiro:

```mermaid
graph TD
    Input["Entrada do Usuário (ex: 4199118)"] --> Clean["Limpeza de Caracteres Especiais"]
    Clean --> P1["Variação COM 9º Dígito (4199118)"]
    Clean --> P2["Variação SEM 9º Dígito (419118)"]
    P1 --> D1["Com DDI 55 (554199118)"]
    P2 --> D2["Com DDI 55 (55419118)"]
    Clean --> Local["Variação Local (99118 / 9118)"]
    D1 & D2 & P1 & P2 & Local --> Match["Consulta Indexada no SQLite/Postgres"]
```

* ✅ **Busca sem o 9** (`419118`) ➡️ Encontra contatos gravados no formato 8 dígitos (`554191189892`).
* ✅ **Busca com o 9** (`4199118`) ➡️ Encontra contatos gravados no formato 8 dígitos e 9 dígitos.
* ✅ **Busca por DDD** (`479`, `4799`) ➡️ Localiza contatos de qualquer região do país.
* ✅ **Busca Formatada** (`+55 (41) 9 9118-9892`) ➡️ Higienizada e matched instantaneamente.

---

## 🏗️ 6. Diagrama de Arquitetura do Sistema

```mermaid
flowchart TB
    subgraph WhatsApp["Dispositivos Físicos"]
        W1[📱 Smartphone 01]
        W2[📱 Smartphone 02]
        Wn[📱 Smartphone 20]
    end

    subgraph Backend["Backend Node.js (Porta 6002)"]
        BW[Engine Baileys WebSocket]
        Auth[Auth & JWT Service]
        AuditSvc[Audit & Search Services]
        AntiDel[Mecanismo Anti-Delete]
    end

    subgraph Storage["Armazenamento & Mídias"]
        DB[(SQLite / PostgreSQL)]
        MediaFiles["Diretório /public/media"]
    end

    subgraph Frontend["Frontend React SPA + Proxy (Porta 6001)"]
        Proxy[Proxy Reverso Integrado]
        UI[Painel React / Material-UI]
    end

    subgraph Access["Acesso Seguro"]
        CF[Cloudflare Tunnel HTTPS]
        LocalNet[Rede Local Direta]
    end

    W1 & W2 & Wn <-->|WebSockets Nativos| BW
    BW --> AntiDel
    AntiDel --> DB
    BW --> MediaFiles
    Proxy <-->|HTTP / WS Relay| Backend
    UI <--> Proxy
    CF <-->|Túnel Seguro| Proxy
    LocalNet <--> Proxy
```

---

## 🌐 7. Especificação de Rotas & Endpoints

### Módulo de Auditoria Forense
| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `GET` | `/audit/devices` | Lista os smartphones com status de conexão e volume de mensagens |
| `GET` | `/audit/devices/:id/chats` | Lista as conversas do aparelho com busca telefônica inteligente |
| `GET` | `/audit/search-all` | Busca global de contatos em **todos os aparelhos simultaneamente** |
| `GET` | `/audit/messages` | Retorna mensagens com filtros (`search`, `startDate`, `endDate`, `onlyDeleted`, `mediaType`) |
| `GET` | `/audit/export` | Gera arquivo de exportação (PDF / CSV / TXT) de uma conversa |

### Módulo Tradicional de Atendimento
| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `GET` | `/tickets` | Listagem tradicional com filas e status |
| `POST` | `/tickets` | Criação manual de atendimento |
| `GET` | `/contacts` | Catálogo geral de contatos |
| `POST` | `/auth/login` | Autenticação e emissão de token JWT |

---

## 🚀 8. Guia de Execução e Inicialização

### Pré-requisitos
* Node.js `>= 14.x`
* `cloudflared` (Para túnel HTTPS externo)

---

### Execução Local (Ambiente Windows):

#### 1. Iniciar o Backend (Porta 6002)
```powershell
cd d:\whaticket\backend
npm run dev
```

#### 2. Iniciar o Frontend + Proxy Integrado (Porta 6001)
```powershell
cd d:\whaticket\frontend
node server.js
```

#### 3. Abrir o Acesso Seguro Externo (Cloudflare Tunnel)
```powershell
cloudflared tunnel --url http://localhost:6001
```

---

### Deploy em Nuvem / VPS (Docker Compose):

```bash
cd d:\whaticket
docker-compose up -d --build
```

---

## 👥 9. Matriz de Perfis e Permissões

| Usuário | Login | Perfil | Finalidade |
| :--- | :--- | :--- | :--- |
| **Yasmin** | `yasmin` | Administrador | Supervisão e Auditoria Geral |
| **Arthur Hille** | `arthur.hille` | Administrador | Gestão Técnica e Conexões |
| **Jana Juttel** | `jana.juttel` | Administrador | Supervisão de Atendimento |
| **Admin Master** | `admin@whaticket.com` | Administrador Master | Manutenção e Configuração do Sistema |

---

## 📄 10. Licença & Segurança

* Sistema desenvolvido e otimizado com foco em **Alta Performance (HPC)**, **Segurança Jurídica** e **Zero-Perda de Dados**.
* Todos os dados de mensagens, mídias e metadados pertencem 100% à infraestrutura privada da organização.
