import WebSocket from 'ws';
import axios from 'axios';

const ws = new WebSocket('wss://rpc.api-pump.fun/ws');
const bot = "Orca";

ws.on('open', function open() {

    let payload = {
        method: "subscribeAccount",
        params: ["orcACRJYTFjTeo2pV8TfYRTpmqfoYgbVi9GeANXTCc8"]
    }
    ws.send(JSON.stringify(payload));
});

ws.on('message', async function message(data) {
    const eventData = JSON.parse(data)
    const tokenCA = eventData.Mint;
    const txType = eventData.IsBuy ? 'buy' : 'sell';
    const tokenAmount = formatTokenAmount(eventData.TokenAmount);

    // Dividir por 1,000,000,000 para obtener el formato deseado
    const formattedNumber = eventData.SolAmount / 1000000000;

    // Redondear a 4 decimales
    const solAmount = formattedNumber.toFixed(4);
    await sendTokenInfoToAPI(tokenCA, txType, solAmount, tokenAmount);

    console.log(eventData);
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

async function sendTokenInfoToAPI(tokenCA, txType, solAmount, tokenAmount) {
    //const tokenInfo = await getTokenInfo(tokenCA);

    if (solAmount) {
        const tokenData = {
            bot: bot,
            tokenCA: tokenCA,
            txType: txType,
            solAmount: solAmount,
            tokenAmount: tokenAmount,
            name: "a",
            symbol: "a",
            description: "a",
            image: "a",
            showName: "a",
            createdOn: "a",
            twitter: "a",
            telegram: "a"
            // name: tokenInfo.data.name,
            // symbol: tokenInfo.data.symbol,
            // description: tokenInfo.data.description,
            // image: tokenInfo.data.image,
            // showName: tokenInfo.data.showName,
            // createdOn: tokenInfo.data.createdOn,
            // twitter: tokenInfo.data.twitter,
            // telegram: tokenInfo.data.telegram
        };

        try {
            const response = await axios.post('https://renton.com.ar/dotfunapi/createTx.php', tokenData);
            console.log('Data sent successfully:', response.data);
        } catch (error) {
            console.error('Error sending data to PHP API:', error);
        }
    }
}

function formatTokenAmount(tokenAmount) {
    // Dividimos el número por 1,000,000 para convertirlo a millones
    let millions = tokenAmount / 1_000_000;
    // Redondeamos el resultado a dos decimales
    return millions.toFixed(2);
  }
  