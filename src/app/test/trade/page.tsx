'use client';

import React, { useEffect, useState } from 'react';

interface BalanceItem {
  free: number;
  locked: number;
}

type Balance = {
  [asset: string]: BalanceItem;
};

const BinanceTrade = () => {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [minAmount, setMinAmount] = useState<number | null>(null); // 🆕 nuevo estado para mínimo
  const [tradeParams, setTradeParams] = useState({
    symbol: 'BTCUSDT',
    type: 'market',
    side: 'BUY',
    amount: 0.001, // valor inicial
  });

  useEffect(() => {
    const fetchBalanceAndMin = async () => {
      try {
        const res = await fetch('/api/binance/trade?balance=true');
        const data = await res.json();

        if (res.ok) {
          if (data.balance) setBalance(data.balance);
          if (data.minAmount) setMinAmount(data.minAmount); // 🆕 extrae el mínimo
        } else {
          setError(data);
        }
      } catch (err: any) {
        setError({ message: err.message });
      }
    };
    fetchBalanceAndMin();
  }, []);

  const handleTestTrade = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch('/api/binance/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeParams),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data);
        if (data.minAmount) setMinAmount(data.minAmount); 
      } else {
        setResponse(data);
        // refresca balance
        const balRes = await fetch('/api/binance/trade?balance=true');
        const balData = await balRes.json();
        if (balRes.ok && balData.balance) {
          setBalance(balData.balance);
          if (balData.minAmount) setMinAmount(balData.minAmount); // 🆕 refresca mínimo también
        }
      }
    } catch (err: any) {
      setError({ message: err.message || 'Error de red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Simulador de Microtrading BTC/USDT</h2>

      {/* Mostrar balance */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Balance:</h3>
        {balance ? (
          Object.entries(balance)
            .filter(([_, val]) => val.free > 0)
            .map(([asset, val]) => (
              <div key={asset}>
                <strong>{asset}</strong>: {val.free}
              </div>
            ))
        ) : (
          <p>Cargando balance...</p>
        )}
      </div>

      {/* Muestra el mínimo */}
      {minAmount && (
        <div style={{ marginBottom: '10px' }}>
          <strong>Monto mínimo permitido:</strong> {minAmount}
        </div>
      )}

      {/* Formulario */}
      <div style={{ marginBottom: '20px' }}>
        <label>Símbolo:</label>
        <input
          value={tradeParams.symbol}
          onChange={(e) => setTradeParams({ ...tradeParams, symbol: e.target.value })}
        />
        <label>Side:</label>
        <select
          value={tradeParams.side}
          onChange={(e) => setTradeParams({ ...tradeParams, side: e.target.value })}
        >
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <label>Cantidad:</label>
        <input
          type="number"
          value={tradeParams.amount}
          onChange={(e) => setTradeParams({ ...tradeParams, amount: parseFloat(e.target.value) })}
          min={minAmount ?? 0}
        />
        <button
          onClick={handleTestTrade}
          disabled={loading || (minAmount !== null && tradeParams.amount < minAmount)}
        >
          {loading ? 'Enviando...' : 'Probar Orden'}
        </button>
      </div>

      {/* Mensaje si no cumple mínimo */}
      {minAmount !== null && tradeParams.amount < minAmount && (
        <p style={{ color: 'red' }}>
          El monto debe ser al menos {minAmount}
        </p>
      )}

      {/* Resultado */}
      {response && (
        <div style={{ backgroundColor: '#e0ffe0', padding: '10px' }}>
          <h4>Orden realizada:</h4>
          <pre>{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}
      {error && (
        <div style={{ backgroundColor: '#ffe0e0', padding: '10px' }}>
          <h4>Error:</h4>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default BinanceTrade;
