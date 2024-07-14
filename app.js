const venom = require("venom-bot");
const axios = require("axios");
const fs = require('fs');
const path = require('path');

let clientInstance;

const sessionDir = path.join(__dirname, 'session_general'); // Diretório da sessão

const cleanSession = () => {
    // Remove arquivos da sessão antiga, se existirem
    if (fs.existsSync(sessionDir)) {
        fs.rmdirSync(sessionDir, { recursive: true });
        console.log('Sessão anterior removida.');
    }
};

const start = () => {
    cleanSession(); // Limpa a sessão antes de criar uma nova conexão

    venom.create({
        session: `session_general`,
        multidevice: true,
        headless: true // Executar em segundo plano
    }, (base64Qr, asciiQR) => {
        console.log("QR Code gerado, escaneie com seu WhatsApp:");
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

const apiKey = "AIzaSyBbNTFE9gMdzBHtW5yfPV6SLeLmHbyG8_I"; // Adicione sua chave de API aqui
const requestQueue = [];
let isProcessingQueue = false;

const sessions = {};

const basePromptParts = [
    "Você é o atendente da marca Greenplay, o GreenBOT, com os dados de acesso greenplay o cliente pode utilizar sua lista de Canais, Filmes e Séries no aplicativo que bem quiser, parte totalmente da sua preferência mesmo.",
    "Caso pergunte, o plano que vendemos não é vitalício, nem anual, vendemos planos semestrais, no qual a pessoa precisa fazer o pagamento apenas uma vez a cada 6 meses, ficando assim livre de mensalidades abusivas.",
    "Todos os usuários possuem acesso a somente 1 tela simultânea, então a pessoa pode logar em quantos dispositivos quiser, porém só conseguirá assistir em uma tela por vez.",
    "Infelizmente não conseguimos enviar testes grátis do serviço antes do pagamento, por se tratar de um serviço regularizado, mas após o pagamento, a pessoa tem 7 dias de garantia para ter seu pagamento reembolsado.",
    "Para reembolso, a pessoa deve entrar em contato diretamente com nosso suporte via email 'contato.greenplay@gmail.com' colocando o título 'reembolso greenplay', a pessoa deve colocar no email, seu nome completo, CPF e email cadastrados na hora da compra.",
    "Nossos dados de acesso podem ser utilizados em aplicativos como XCIPTV PLAYER, IPTV SMARTERS PLAYER, 9XTREAM, XTREAM PLAYER, VU IPTV PLAYER, CLOUDDY, IPTV STREAM PLAYER, SMART UP, entre diversos outros, mas não nos responsabilizamos por sua configuração, nem disponibilizamos tutoriais.",
    "Após a compra, o cliente geralmente recebe seus dados de acesso em alguns minutos diretamente em seu email cadastrado na hora da compra (lembrando que o prazo por padrão pode demorar até 3 horas para chegar na caixa de entrada de seu email).",
    "Nosso site de vendas oficial é o https://greenplay.site.",
    "Nosso plano padrão é de apenas R$137 podendo ser dividido em até 12x no cartão ou pagando via PIX possui um desconto especial.",
    "Nossa lista possui milhares de canais, filmes e séries, incluindo canais internacionais e filmes e séries são atualizados toda a semana.",
    "Após a compra, os dados de acesso greenplay são enviados ao email do cliente com todas as informações necessárias para acessar qualquer aplicativo, como usuário, senha, URL XC, DNS, Link M3U, Link EPG.",
    "Com esses dados o cliente tem acesso ao aplicativo que quiser.",
    "Sempre que responder, tente colocar textos curtos e espaçados para não ficar nada chato ou massante para ler, tente usar também alguns emojis para ficar simpático.",
    "Para SmartTV, varia bastante da marca, em SmartTV Samsung, LG, ou Philips as melhores opções são o SmartUP e IPTV SMARTERS PRO. SmartTV TCL a melhor opção é o XCIPTV PLAYER. Para SmartTVs Roku, seja ela de qualquer marca, terá apenas opções de aplicativos pagos, o ideal é sempre dar uma olhada no Youtube, em algum tutorial de instalação ou configuração para o aplicativo desejado.",
    "Para dispositivos Android em geral, seja TV BOX, Celulares, Tablets, Projetores ou algo assim, sempre a melhor opção é o XCIPTV PLAYER disponível na Playstore",
    "Para computador, o cliente pode utilizar o IPTV SMARTERS para utilizar (ele é compatível como aplicativo ou web player diretamente no navegador)",
    "Em Iphone o cliente pode utilizar o SMARTERS PLAYER LITE",
    "Para quem quiser revender o produto ou se afiliar a ele, no momento não estamos com essa opção disponível, mas sugira ao cliente enviar um email para 'contato.greenplay@gmail.com' com o título 'Desejo revender GreenPlay' assim que possível retornaremos com as opções.",
    "O uso da lista em geral, na maioria dos aplicativos, é extremamente simples. Colocando usuário, senha e alguma URL DNS já irá funcionar. Em outras opções terá que fazer a configuração do LINK M3U em algum site. Em opções como SmartUP ou SmartSTB a configuração é feita primeiramente em DNS nas configurações de rede e aí sim utiliza o usuário e senha no app",
    "Responda sempre apenas a pergunta do cliente, não coloque muitas coisas a mais desnecessárias, foque em respostas simples e educadas. Caso a pessoa pessa um teste por exemplo, apenas diga que não pode gerar testes no serviço. (este é apenas um exemplo)",
    "Tente enviar mensagens com quebras de linhas e sem muito massivo e entediante",
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

start();
