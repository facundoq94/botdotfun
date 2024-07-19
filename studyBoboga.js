import WebSocket from 'ws';

// Estructura de almacenamiento temporal para las transacciones
let trades = {};
let totalProfitPercentage = 0;

const ws = new WebSocket('wss://pumpportal.fun/api/data');

ws.on('open', function open() {
    // Subscribing to trades on tokens
    let payload = {
        method: "subscribeAccountTrade",
        keys: ["4quAnZe3giWzSj6KEfxkNr8Do62XP5AfaG6Q5pKfHrKj"]
    };
    ws.send(JSON.stringify(payload));
});

ws.on('message', function message(data) {
    const trade = JSON.parse(data);
    if (trade.signature && trade.mint && trade.txType && trade.marketCapSol) {
        const mint = trade.mint;

        if (!trades[mint]) {
            trades[mint] = { buys: [], sells: [] };
        }

        const timestamp = new Date(); // Utilizar la fecha y hora actual

        if (trade.txType === 'buy') {
            trades[mint].buys.push({ marketCapSol: trade.marketCapSol, timestamp });
        } else if (trade.txType === 'sell') {
            trades[mint].sells.push({ marketCapSol: trade.marketCapSol, timestamp });
        }

        // Si hay al menos una compra y una venta, mostramos los datos en la tabla
        if (trades[mint].buys.length > 0 && trades[mint].sells.length > 0) {
            const buy = trades[mint].buys.shift(); // Eliminar la compra más antigua
            const sell = trades[mint].sells.shift(); // Eliminar la venta más antigua

            const gainPercentage = ((sell.marketCapSol - buy.marketCapSol) / buy.marketCapSol) * 100;
            totalProfitPercentage += gainPercentage;
            const timeElapsed = (sell.timestamp - buy.timestamp) / 1000; // Tiempo en segundos

            console.table([{
                Mint: mint,
                'Market Cap Sol (Buy)': buy.marketCapSol,
                'Market Cap Sol (Sell)': sell.marketCapSol,
                'Gain %': gainPercentage.toFixed(2),
                'Time Elapsed (s)': timeElapsed.toFixed(2),
                'Total Profit %': totalProfitPercentage.toFixed(2)
            }]);
        }
    }
});