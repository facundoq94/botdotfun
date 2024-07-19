import WebSocket from 'ws';
import axios from 'axios';
import Table from 'cli-table3';

// Dynamic import for ansi-escapes
const ansiEscapes = await import('ansi-escapes');

const ws = new WebSocket('wss://pumpportal.fun/api/data');
const apiKey = '6hx46u2kedt6ajaddrt3cp9rf12k8hu369un6c9hcwrkambpdrvmrykp9tn6ehk9ct5n0w1q94t4mt2me1gkakudc95n8w9bb56qgcbua4t34xu58hq7anaecn0nep3gf4nm2khnewyku5drm2w3bdhvp2v37d16jpbvu60f5hm2cbr8hupwn27at458ck3c926rbu2690kuf8'; // Replace with your actual API key
const userPrivateKey = '4McRK4mWcxMWrm5nqutvKW67urERmggDjh839eUKw4zERCuh2wzqxAfHPMfBXGwiSutiM2i9WwoxhWm6G6tG5G18';
let tokenMetadataCache = {};
let tokenTransactionCache = {}; // To store transaction status of tokens
let pendingBuys = {}; // To store pending buy transactions

const profitTable = new Table({
    head: ['Token Name', 'Current Profit/Loss (SOL)', 'MarketCap at Buy (SOL)', 'MarketCap at Sell (SOL)', 'Current MarketCap (SOL)', 'Sold'],
    colWidths: [30, 30, 30, 30, 30, 10]
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

            // Check if the token has the required social media data
            if (!tokenMetadata.telegram || !tokenMetadata.twitter || !tokenMetadata.website) {
                console.log(`Token ${tokenCA} does not have all required social media information. Skipping.`);
                return;
            }

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
                lastProfitLoss: 0, // Initialize last profit/loss
                tokenAmount: null // Initialize tokenAmount
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
            const tokenAmount = eventData.tokenAmount;

            // Check if token metadata and transaction status are cached
            if (tokenMetadataCache[tokenCA] && tokenTransactionCache[tokenCA]) {
                const tokenName = tokenMetadataCache[tokenCA].name;
                const transactionStatus = tokenTransactionCache[tokenCA];

                // Check if market cap is above 28 SOL and below 33 SOL and the token hasn't been bought yet
                if (marketCapSol > 36 && !transactionStatus.bought && !pendingBuys[tokenCA]) {
                    console.log(`Market cap of ${tokenName} is between 28 and 33 SOL: ${marketCapSol}. BUYING.`);
                    pendingBuys[tokenCA] = true;

                    // Execute your buy logic here
                    const buyResponse = await buyTokenPumpPortal(tokenCA);

                    if (buyResponse && buyResponse.signature) {
                        pendingBuys[buyResponse.signature] = tokenCA;
                    }

                    // Check if market cap is above 80 SOL and the token has been bought but not yet sold
                } else if (marketCapSol > transactionStatus.marketCapAtBuy * 2 && transactionStatus.bought && !transactionStatus.sold) {
                    console.log(`Market cap of ${tokenName} is above 80 SOL: ${marketCapSol}. SELLING.`);
                    transactionStatus.sold = true;
                    transactionStatus.marketCapAtSell = marketCapSol;

                    // Execute your sell logic here
                    await sellTokenPumpapi(tokenCA, transactionStatus.tokenAmount);

                    // Calculate and log profit
                    const profit = marketCapSol - transactionStatus.initialBuyPrice;
                    transactionStatus.lastProfitLoss = profit; // Update last profit/loss
                    console.log(`Profit made: ${profit} SOL`);

                    // Check if market cap is 1 SOL below the buy price for stop-loss
                } else if (marketCapSol < transactionStatus.initialBuyPrice * 1.02 && transactionStatus.bought && !transactionStatus.sold) {
                    console.log(`Market cap of ${tokenName} is 1 SOL below buy price: ${marketCapSol}. SELLING (STOP-LOSS).`);
                    transactionStatus.sold = true;
                    transactionStatus.marketCapAtSell = marketCapSol;

                    // Execute your stop-loss sell logic here
                    //await sellTokenPumpapi(tokenCA, transactionStatus.tokenAmount);

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

        // Handle buy transaction responses
        if (eventData.signature && pendingBuys[eventData.signature]) {
            const tokenCA = pendingBuys[eventData.signature];
            const transactionStatus = tokenTransactionCache[tokenCA];

            if (transactionStatus && !transactionStatus.bought) {
                transactionStatus.bought = true;
                transactionStatus.initialBuyPrice = eventData.marketCapSol;
                transactionStatus.marketCapAtBuy = eventData.marketCapSol;
                transactionStatus.currentMarketCap = eventData.marketCapSol;
                transactionStatus.tokenAmount = eventData.tokenAmount;
                console.log(`Successfully bought ${transactionStatus.tokenAmount} of ${tokenCA}`);
                delete pendingBuys[eventData.signature];
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
            profitTable.push([
                tokenMetadata.name,
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
        if (transactionStatus && transactionStatus.bought) {
            totalProfitLoss += transactionStatus.lastProfitLoss;
        }
    }

    console.log(`Total Profit/Loss: ${totalProfitLoss.toFixed(2)} SOL`);
}

async function buyTokenPumpPortal(tokenCA) {
    const amount = 0.008; // Example amount, adjust as per your strategy
    const slippage = 25; // Example slippage, adjust as per your strategy
    const priorityFee = 0.001; // Example priority fee, adjust as per your strategy

    try {
        const response = await axios.post(`https://pumpportal.fun/api/trade?api-key=${apiKey}`, {
            action: "buy",
            mint: tokenCA,
            amount: amount,
            denominatedInSol: "true",
            slippage: slippage,
            priorityFee: priorityFee
        });

        return response.data;
    } catch (error) {
        console.error(`Error buying token ${tokenCA}:`, error);
        return null;
    }
}

/* async function sellTokenPumpPortal(tokenCA, tokenAmount) {
    try {
        const response = await axios.post('https://pumpportal.fun/api/transactions', {
            apiKey: apiKey,
            action: 'sell',
            ca: tokenCA,
            tokenAmount: tokenAmount,
            userPrivateKey: userPrivateKey
        });

        return response.data;
    } catch (error) {
        console.error(`Error selling token ${tokenCA}:`, error);
        return null;
    }
} */

async function sellTokenPumpapi(tokenCA, tokenAmount, maxRetries = 5) {
    const slippage = 5; // Example slippage, adjust as per your strategy
    const priorityFee = 0.003; // Example priority fee, adjust as per your strategy
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const sellRequestBody = {
                trade_type: "sell",
                mint: tokenCA,
                amount: tokenAmount,
                slippage: slippage,
                priorityFee: priorityFee,
                userPrivateKey: userPrivateKey
            };
            console.log('Sell request body:', sellRequestBody);

            const response = await axios.post('https://pumpapi.fun/api/trade', sellRequestBody);

            const data = response.data;
            console.log('Sell response:', data);

            if (response.status === 200 && data.tx_hash) {
                // If no errors, break the loop
                break;
            } else {
                // Log the error and retry
                console.error('Sell response contained errors:', data);
            }

        } catch (error) {
            if (error.response) {
                // Server responded with a status code out of the range of 2xx
                console.error('Error response:', error.response.data);
                console.error('Error status:', error.response.status);
                console.error('Error headers:', error.response.headers);
            } else if (error.request) {
                // No response received
                console.error('Error request:', error.request);
            } else {
                // Something else happened
                console.error('Error message:', error.message);
            }
        }
    }
}