import express from "express";
import fetch from "node-fetch";
import { ethers } from "ethers";

const app = express();
const PORT = process.env.PORT || 8080;

// OG88/WCO pair contract
const PAIR_ADDRESS = "0xC61856cdf226645eaB487352C031Ec4341993F87";
const OG88_ADDRESS = "0xD1841fC048b488d92fdF73624a2128D10A847E88";

// Circulating supply
const CIRCULATING_SUPPLY = 8800000;

// W-Chain RPC & WCO price API
const RPC_URL = "https://rpc.w-chain.com";
const WCO_PRICE_API = "https://oracle.w-chain.com/api/price/wco";

// ABI fragment for getReserves()
const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const pairContract = new ethers.Contract(PAIR_ADDRESS, PAIR_ABI, provider);

async function getOG88Price() {
  try {
    // Fetch reserves
    const reserves = await pairContract.getReserves();
    const reserveOG88 = Number(reserves[0]);
    const reserveWCO = Number(reserves[1]);

    // Fetch WCO price in USD
    const wcoResponse = await fetch(WCO_PRICE_API);
    const wcoData = await wcoResponse.json();
    const wcoPrice = Number(wcoData.price);

    // Calculate OG88 price
    const priceUSD = (reserveWCO / reserveOG88) * wcoPrice;

    // Calculate liquidity
    const liquidityUSD = reserveWCO * wcoPrice;

    // Market cap
    const marketCap = CIRCULATING_SUPPLY * priceUSD;

    // Return JSON
    return {
      symbol: "OG88",
      address: OG88_ADDRESS,
      price_usd: priceUSD,
      price_wco: reserveWCO / reserveOG88,
      liquidity_usd: liquidityUSD,
      volume_24h_usd: 0, // optional, can add later
      market_cap: marketCap,
      last_updated: new Date().toISOString()
    };
  } catch (err) {
    console.error("Error fetching price:", err);
    return {
      symbol: "OG88",
      price_usd: 0,
      price_wco: 0,
      liquidity_usd: 0,
      volume_24h_usd: 0,
      market_cap: 0,
      last_updated: new Date().toISOString()
    };
  }
}

app.get("/price", async (req, res) => {
  const data = await getOG88Price();
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`OG88 price API running at http://localhost:${PORT}/price`);
});
