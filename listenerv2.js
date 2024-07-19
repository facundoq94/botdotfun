import WebSocket from 'ws';
import axios from 'axios';

const ws = new WebSocket('wss://pumpportal.fun/api/data');
const bot = "Onix";
//abrir conexion con el websocket
ws.on('open', function open() {

    // Subscribing to trades on tokens
    let payload = {
        method: "subscribeAccountTrade",
        keys: ["onixWLeJwRXvJ1iSwReWnyPtT97jxxGtdxeG9eGL9WH"] // array of token CAs to watch
    }
    ws.send(JSON.stringify(payload));
});


//data recibida del websocket (eventos)
ws.on('message', async function message(data) {
    const eventData = JSON.parse(data);
    const tokenCA = eventData.mint;
    const txType = eventData.txType;
    const marketCapSol = eventData.marketCapSol;

    //obtener token data
    const tokenInfo = await getTokenInfo(tokenCA);
    await sendTokenInfoToAPI(tokenCA, txType, marketCapSol);
    console.log(tokenInfo);
});


//funciones
async function getTokenInfo(tokenCA) {
    try {
        const response = await axios.get(`https://pumpportal.fun/api/data/token-info?ca=${tokenCA}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching token info:', error);
    }
}

async function sendTokenInfoToAPI(tokenCA, txType, marketCapSol) {
    const tokenInfo = await getTokenInfo(tokenCA);

    if (tokenInfo && tokenInfo.data) {
        const tokenData = {
            bot: bot,
            tokenCA: tokenCA,
            txType: txType,
            marketCapSol: marketCapSol,
            name: tokenInfo.data.name,
            symbol: tokenInfo.data.symbol,
            description: tokenInfo.data.description,
            image: tokenInfo.data.image,
            showName: tokenInfo.data.showName,
            createdOn: tokenInfo.data.createdOn,
            twitter: tokenInfo.data.twitter,
            telegram: tokenInfo.data.telegram
        };

        try {
            const response = await axios.post('https://renton.com.ar/dotfunapi/api.php', tokenData);
            console.log('Data sent successfully:', response.data);
        } catch (error) {
            console.error('Error sending data to PHP API:', error);
        }
    }
}