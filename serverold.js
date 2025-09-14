// server.js
import express from "express";
import { ethers } from "ethers";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIG ---
const RPC_URL = "https://rpc.w-chain.com"; // WChain RPC
const PAIR_ADDRESS = "0xC61856cdf226645eaB487352C031Ec4341993F87"; // OG88/WCO pair contract
const OG88_ADDRESS = "0xD1841fC048b488d92fdF73624a2128D10A847E88"; // OG88 token contract
const WCO_PRICE_API = "https://oracle.w-chain.com/api/price/wco"; // WCO → USDT price

// ABI to fetch reserves
const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const pairContract = new ethers.Contract(PAIR_ADDRESS, PAIR_ABI, provider);

app.get("/price", async (req, res) => {
  try {
    // Fetch reserves from the OG88/WCO pair
    const [reserve0, reserve1] = await pairContract.getReserves();
    const token0 = await pairContract.token0();
    const token1 = await pairContract.token1();

    // Determine which reserve is OG88 and which is WCO
    let reserveOG88, reserveWCO;
    if (token0.toLowerCase() === OG88_ADDRESS.toLowerCase()) {
      reserveOG88 = reserve0;
      reserveWCO = reserve1;
    } else {
      reserveOG88 = reserve1;
      reserveWCO = reserve0;
    }

    // Fetch WCO → USDT price
    const wcoResponse = await fetch(WCO_PRICE_API);
    const wcoData = await wcoResponse.json();
    // Adjust based on the API response format, example assuming { price: 20.5 }
    const wcoPriceUSD = wcoData.price || 0;

    // Calculate OG88 price
    const priceWCO = Number(reserveWCO) / Number(reserveOG88);
    const priceUSD = priceWCO * wcoPriceUSD;

    res.json({
      symbol: "OG88",
      address: OG88_ADDRESS,
      price_usd: priceUSD.toFixed(6),
      price_wco: priceWCO.toFixed(8),
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch OG88 price" });
  }
});

app.listen(PORT, () => {
  console.log(`OG88 price API running at http://localhost:${PORT}/price`);
});
