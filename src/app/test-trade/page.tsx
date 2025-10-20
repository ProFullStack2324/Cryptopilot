//src/app/test-trade/page.tsx
'use client';

import React, { useState, useEffect } from 'react';

interface TradeRequest {
  symbol: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
}

export default function TestTradePage() {
  const [balance, setBalance] = useState<Record<string, any> | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  const [tradeParams, setTradeParams] = useState<TradeRequest>({
    symbol: 'BTC/USDT',
    type: 'market',
    side: 'buy',
    amount: 0.000001, // Se inicializa >0 para no invalidar
  });

  // Obtener balance Mainnet al cargar
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch('/api/binance/trade-mainnet?balance=true');
        const data = await res.json();
        if (res.ok && data.balance) {
          setBalance(data.balance);
        } else {
          console.error('Error al obtener balance:', data);
          setError(data);
        }
      } catch (err: any) {
        console.error('Error al obtener balance:', err);
        setError({ message: err.message });
      }
    };
    fetchBalance();
  }, []);

  const handleTestTrade = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      console.log('Enviando POST a /api/binance/trade-testnet con:', tradeParams);
      const res = await fetch('/api/binance/trade-testnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeParams),
      });
      const data = await res.json();
      console.log('Respuesta orden Mainnet:', data);
      if (!res.ok) {
        setError(data);
      } else {
        setResponse(data);
        // Refrescar balance tras la orden
        const balRes = await fetch('/api/binance/trade-testnet?balance=true');
        const balData = await balRes.json();
        if (balRes.ok && balData.balance) setBalance(balData.balance);
      }
    } catch (err: any) {
      console.error('Error al enviar orden:', err);
      setError({ message: err.message || 'Error de red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Pruebas de Trading en Binance Mainnet</h1>

      {balance ? (
        <div style={{ marginBottom: '20px' }}>
          <h3>Balance Mainnet:</h3>
          <pre style={{ backgroundColor: '#f0f0f0', padding: '10px' }}>
            {JSON.stringify(balance, null, 2)}
          </pre>
        </div>
      ) : (
        <p>Cargando balance...</p>
      )}

      <div style={{ marginBottom: '20px', padding: '15px', borderRadius: '8px', border: '1px solid #ccc' }}>
        <h3>Parámetros de Orden:</h3>
        <div>
          <label>Símbolo:</label>
          <input
            type="text"
            value={tradeParams.symbol}
            onChange={(e) => setTradeParams({ ...tradeParams, symbol: e.target.value })}
            placeholder="BTC/USDT"
          />
        </div>
        <div>
          <label>Tipo:</label>
          <select
            value={tradeParams.type}
            onChange={(e) => setTradeParams({ ...tradeParams, type: e.target.value as 'market' | 'limit' })}
          >
            <option value="market">market</option>
            <option value="limit">limit</option>
          </select>
        </div>
        <div>
          <label>Buy/Sell:</label>
          <select
            value={tradeParams.side}
            onChange={(e) => setTradeParams({ ...tradeParams, side: e.target.value as 'buy' | 'sell' })}
          >
            <option value="buy">buy</option>
            <option value="sell">sell</option>
          </select>
        </div>
        <div>
          <label>Cantidad:</label>
          <input
            type="number"
            step="0.00000001"
            value={tradeParams.amount}
            onChange={(e) => setTradeParams({ ...tradeParams, amount: parseFloat(e.target.value) })}
          />
        </div>
        {tradeParams.type === 'limit' && (
          <div>
            <label>Precio:</label>
            <input
              type="number"
              step="0.01"
              value={tradeParams.price ?? ''}
              onChange={(e) => setTradeParams({ ...tradeParams, price: parseFloat(e.target.value) })}
            />
          </div>
        )}
        <pre>{JSON.stringify(tradeParams, null, 2)}</pre>
      </div>

      <button
        onClick={handleTestTrade}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: loading ? '#ccc' : '#0070f3',
          color: '#fff',
          border: 'none',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Enviando...' : 'Enviar Orden Real'}
      </button>

      {error && (
        <div style={{ marginTop: '20px', color: 'red', border: '1px solid red', padding: '10px', borderRadius: '5px' }}>
          <h2>Error:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}

      {response && (
        <div style={{ marginTop: '20px', border: '1px solid #eee', padding: '10px', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
          <h2>Respuesta de la Orden:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
