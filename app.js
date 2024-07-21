const express = require("express");
const venom = require("venom-bot");
const axios = require("axios");
const fs = require('fs');
const path = require('path');
const cors = require('cors'); // Importando o módulo cors

const app = express();
const port = 3000;

let qrCode = "";
let clientInstance;

const sessionDir = path.join(__dirname, 'session_general');

const cleanSession = () => {
    if (fs.existsSync(sessionDir)) {
        fs.rmdirSync(sessionDir, { recursive: true });
        console.log('Sessão anterior removida.');
    }
};

const start = () => {
    cleanSession();

    venom.create({
        session: `session_general`,
        multidevice: true,
        headless: true
    }, (base64Qr, asciiQR) => {
        console.log("QR Code gerado, escaneie com seu WhatsApp:");
        qrCode = base64Qr;
        console.log(asciiQR);
    })
    .then(client => {
        clientInstance = client;
        console.log("WhatsApp conectado com sucesso!");

        client.onMessage((message) => {
            console.log('Mensagem recebida:', message.body);
            requestQueue.push({ client, message });
            processQueue();
        });
    })
    .catch(err => {
        console.error('Erro ao conectar com o WhatsApp:', err.message);
    });
};

const apiKey = "AIzaSyBbNTFE9gMdzBHtW5yfPV6SLeLmHbyG8_I";
const requestQueue = [];
let isProcessingQueue = false;

const sessions = {};

const basePromptParts = [
    // Suas partes de prompt aqui
];

const processQueue = () => {
    if (isProcessingQueue || requestQueue.length === 0) return;

    const { client, message } = requestQueue.shift();

    console.log(`Processando mensagem de ${message.from}`);

    const tryRequest = (retries) => {
        const session = sessions[message.from] || { history: [] };
        session.history.push(`Cliente: ${message.body}`);

        const fullPrompt = `${basePromptParts.join('\n')}\n\nHistórico da conversa:\n${session.history.join('\n')}`;

        console.log(`Enviando prompt para API: ${fullPrompt}`);

        axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            "contents": [{"parts": [{"text": fullPrompt}]}]
        })
        .then((response) => {
            console.log('Resposta completa da API:', response.data);

            if (response.data && response.data.candidates && response.data.candidates[0] && response.data.candidates[0].content) {
                const contentParts = response.data.candidates[0].content.parts;
                const reply = contentParts.map(part => part.text).join("\n");
                console.log('Resposta do Gemini:', reply);

                session.history.push(`IA: ${reply}`);
                sessions[message.from] = session;

                client.sendText(message.from, reply)
                    .then(() => {
                        console.log('Mensagem enviada com sucesso');
                        isProcessingQueue = false;
                        processQueue();
                    })
                    .catch((err) => {
                        console.log('Erro ao enviar mensagem:', err);
                        isProcessingQueue = false;
                        processQueue();
                    });
            } else {
                throw new Error('Estrutura da resposta inesperada');
            }
        })
        .catch((err) => {
            if (err.response && err.response.status === 429 && retries > 0) {
                console.log(`Erro 429 recebido. Tentando novamente em 10 segundos... (${retries} tentativas restantes)`);
                setTimeout(() => tryRequest(retries - 1), 10000);
            } else {
                console.log('Erro ao chamar API do Gemini:', err.message || err);
                isProcessingQueue = false;
                processQueue();
            }
        });
    };

    tryRequest(3);
};

// Configuração de CORS
app.use(cors({
  origin: 'https://primeiroback-frontseparado-8kusbcq9m-luizs-projects-1922f75a.vercel.app', // Substitua pelo domínio real do seu frontend
  optionsSuccessStatus: 200
}));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/qrcode', (req, res) => {
    if (qrCode) {
        res.send(`<img src="${qrCode}" alt="QR Code">`);
    } else {
        res.send("QR Code não disponível ainda. Por favor, recarregue a página em alguns segundos.");
    }
});

app.get('/start', (req, res) => {
    start();
    res.send("Iniciando conexão com o WhatsApp...");
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
