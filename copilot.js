import WebSocket from 'ws';
import axios from 'axios';
import Table from 'cli-table3';

// Usa import dinámico para ansi-escapes
const ansiEscapes = await import('ansi-escapes');

const ws = new WebSocket('wss://pumpportal.fun/api/data');

let tokenMetadataCache = {};
let tokenTransactionCache = {}; // To store transaction status of tokens

const profitTable = new Table({
    head: ['Name', 'Pump', 'Current Profit/Loss (SOL)', 'MarketCap at Buy (SOL)', 'MarketCap at Sell (SOL)', 'Current MarketCap (SOL)', 'Sold'],
    colWidths: [20, 73, 15, 15, 15, 15, 10]
});

let totalProfitLoss = 0; // Variable to store total profit/loss

ws.on('open', function open() {
    console.log('Connected to WebSocket');

    // Subscribing to token creation events
    const payload = {
        method: "subscribeNewToken"
    };

    ws.send(JSON.stringify(payload));
    console.log('Subscribed to new token events');
});

ws.on('message', async function message(data) {
    try {
        const eventData = JSON.parse(data);
        // console.log('Received data:', eventData); // Optional: comment this out to reduce clutter

        if (eventData.txType === 'create') {
            const tokenCA = eventData.mint;

            // Fetch token metadata
            if (!tokenCA) {
                console.log('Token CA is undefined');
                return;
            }

            const response = await axios.get(`https://pumpportal.fun/api/data/token-info?ca=${tokenCA}`);
            const tokenMetadata = response.data.data;
            // console.log('Token Metadata:', tokenMetadata); // Optional: comment this out to reduce clutter

            // Cache token metadata
            tokenMetadataCache[tokenCA] = tokenMetadata;

            // Initialize transaction status for the token
            tokenTransactionCache[tokenCA] = {
                bought: false,
                sold: false,
                initialBuyPrice: null,
                marketCapAtBuy: null,
                marketCapAtSell: null,
                currentMarketCap: null,
                lastProfitLoss: 0 // Initialize last profit/loss
            };

            // Subscribe to trades on the newly created token
            const tradePayload = {
                method: "subscribeTokenTrade",
                keys: [tokenCA]
            };

            ws.send(JSON.stringify(tradePayload));
            console.log(`Subscribed to trades for token: ${tokenMetadata.name}`);

        } else if (eventData.txType === 'buy' || eventData.txType === 'sell') {
            const tokenCA = eventData.mint;
            const marketCapSol = eventData.marketCapSol;

            // Check if token metadata and transaction status are cached
            if (tokenMetadataCache[tokenCA] && tokenTransactionCache[tokenCA]) {
                const tokenName = tokenMetadataCache[tokenCA].name;
                const transactionStatus = tokenTransactionCache[tokenCA];

                // Check if market cap is above 28 SOL and the token hasn't been bought yet
                if ((marketCapSol > 28 && marketCapSol < 50) && !transactionStatus.bought) {
                    console.log(`Market cap of ${tokenName} is above 30 SOL: ${marketCapSol}. BUYING.`);
                    transactionStatus.bought = true;
                    transactionStatus.initialBuyPrice = marketCapSol;
                    transactionStatus.marketCapAtBuy = marketCapSol;
                    transactionStatus.currentMarketCap = marketCapSol;

                    // Placeholder for the buy action
                    // Execute your buy logic here

                    // Check if market cap is above 50 SOL and the token has been bought but not yet sold
                } else if (marketCapSol > 100 && transactionStatus.bought && !transactionStatus.sold) {
                    console.log(`Market cap of ${tokenName} is above 65 SOL: ${marketCapSol}. SELLING.`);
                    transactionStatus.sold = true;
                    transactionStatus.marketCapAtSell = marketCapSol;

                    // Placeholder for the sell action
                    // Execute your sell logic here

                    // Calculate and log profit
                    const profit = marketCapSol - transactionStatus.initialBuyPrice;
                    transactionStatus.lastProfitLoss = profit; // Update last profit/loss
                    console.log(`Profit made: ${profit} SOL`);

                    // Check if market cap is 5 SOL below the buy price for stop-loss
                } else if (marketCapSol < transactionStatus.initialBuyPrice - 5 && transactionStatus.bought && !transactionStatus.sold) {
                    console.log(`Market cap of ${tokenName} is 5 SOL below buy price: ${marketCapSol}. SELLING (STOP-LOSS).`);
                    transactionStatus.sold = true;
                    transactionStatus.marketCapAtSell = marketCapSol;

                    // Placeholder for the stop-loss sell action
                    // Execute your sell logic here

                    // Calculate and log loss
                    const loss = transactionStatus.initialBuyPrice - marketCapSol;
                    transactionStatus.lastProfitLoss = -loss; // Update last profit/loss (negative for loss)
                    console.log(`Loss incurred: ${loss} SOL`);
                }

                // Update the current market cap in the cache
                transactionStatus.currentMarketCap = marketCapSol;

                // Update the profit/loss table and total
                updateProfitTable();
                updateTotalProfitLoss();
            } else {
                console.log('Token metadata or transaction status not found in cache');
            }
        }

    } catch (error) {
        console.error('Error processing message:', error);
    }
});

ws.on('close', function close() {
    console.log('Disconnected from WebSocket');
});

ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
});

function updateProfitTable() {
    profitTable.splice(0, profitTable.length); // Clear the table

    for (const tokenCA in tokenTransactionCache) {
        const tokenMetadata = tokenMetadataCache[tokenCA];
        const transactionStatus = tokenTransactionCache[tokenCA];

        if (tokenMetadata && transactionStatus.bought) {
            const soldStatus = transactionStatus.sold ? 'Yes' : 'No';
            const tokenUrl = `https://pump.fun/${tokenCA}`;
            profitTable.push([
                tokenMetadata.name,
                tokenUrl,
                transactionStatus.lastProfitLoss.toFixed(2),
                transactionStatus.marketCapAtBuy ? transactionStatus.marketCapAtBuy.toFixed(2) : 'N/A',
                transactionStatus.marketCapAtSell ? transactionStatus.marketCapAtSell.toFixed(2) : 'N/A',
                transactionStatus.currentMarketCap ? transactionStatus.currentMarketCap.toFixed(2) : 'N/A',
                soldStatus
            ]);
        }
    }

    // Clear the console and move cursor to the top-left corner
    process.stdout.write(ansiEscapes.default.clearScreen);
    process.stdout.write(ansiEscapes.default.cursorTo(0, 0));

    console.log(profitTable.toString());
}

function updateTotalProfitLoss() {
    totalProfitLoss = 0;

    for (const tokenCA in tokenTransactionCache) {
        const transactionStatus = tokenTransactionCache[tokenCA];
        if (transactionStatus.sold) {
            totalProfitLoss += transactionStatus.lastProfitLoss;
        }
    }

    console.log(`Total Profit/Loss (SOL): ${totalProfitLoss.toFixed(2)}`);
}