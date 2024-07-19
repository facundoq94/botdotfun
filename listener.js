import WebSocket from 'ws';

const ws = new WebSocket('wss://pumpportal.fun/api/data');

ws.on('open', function open() {

    // Subscribing to trades on tokens
    let payload = {
        method: "subscribeTokenTrade",
        keys: ["DejeaQBtAnx7KkvndmZBgXtyNZHZWXxUemaZpgZZpump"] // array of token CAs to watch
    }
    ws.send(JSON.stringify(payload));
});

ws.on('message', function message(data) {
    console.log(JSON.parse(data));
});