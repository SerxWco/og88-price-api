// server.js
import express from "express";
import { ethers } from "ethers";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// RPC and contract info
const RPC_URL = "https://rpc.w-chain.com";
const PAIR_ADDRESS = "0xC61856cdf226645eaB487352C031Ec4341993F87"; // OG88/WCO pool
const OG88_ADDRESS = "0xD1841fC048b488d92fdF73624a2128D10A847E88"; // OG88 token
const WCO_PRICE_API = "https://oracle.w-chain.com/api/price/wco";

const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const pairContract = new ethers.Contract(PAIR_ADDRESS, PAIR_ABI, provider);

// Keep last known good values
let lastPriceUSD = 0;
let lastPriceWCO = 0;
let lastMarketCap = 0;

app.get("/price", async (req, res) => {
  try {
    const DECIMALS = 18;

    // 1️⃣ Fetch reserves with try/catch
    let reserveOG88 = 0;
    let reserveWCO = 0;
    try {
      const [reserve0, reserve1] = await pairContract.getReserves();
      const token0 = await pairContract.token0();
      if (token0.toLowerCase() === OG88_ADDRESS.toLowerCase()) {
        reserveOG88 = Number(reserve0) / 10 ** DECIMALS;
        reserveWCO = Number(reserve1) / 10 ** DECIMALS;
      } else {
        reserveOG88 = Number(reserve1) / 10 ** DECIMALS;
        reserveWCO = Number(reserve0) / 10 ** DECIMALS;
      }
    } catch (err) {
      console.error("Failed to fetch reserves:", err.message);
    }

    // 2️⃣ Fetch WCO price with try/catch
    let wcoPriceUSD = 0;
    try {
      const wcoResponse = await fetch(WCO_PRICE_API);
      const wcoData = await wcoResponse.json();
      wcoPriceUSD = wcoData.price || 0;
    } catch (err) {
      console.error("Failed to fetch WCO price:", err.message);
    }

    // 3️⃣ Compute price and market cap if possible
    let priceWCO = reserveOG88 > 0 ? reserveWCO / reserveOG88 : lastPriceWCO;
    let priceUSD = priceWCO * wcoPriceUSD || lastPriceUSD;
    let marketCap = priceUSD * reserveOG88 || lastMarketCap;

    // 4️⃣ Save last known good values
    lastPriceUSD = priceUSD;
    lastPriceWCO = priceWCO;
    lastMarketCap = marketCap;

    // 5️⃣ Return JSON
    res.json({
      symbol: "OG88",
      price_usd: priceUSD.toFixed(6),
      price_wco: priceWCO.toFixed(6),
      volume_24h: 0, // keep zero for serverless
      market_cap: marketCap.toFixed(2),
      last_updated: new Date().toISOString()
    });

  } catch (err) {
    console.error("Unhandled error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 OG88 serverless price API running at http://localhost:${PORT}/price`);
});
